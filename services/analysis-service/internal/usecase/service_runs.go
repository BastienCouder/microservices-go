package usecase

import (
	"context"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"
)

const (
	promptKindMonitoring    = "monitoring"
	promptKindPerception    = "perception"
	analysisRunStalledAfter = 30 * time.Minute
)

func normalizePromptKind(raw string) string {
	if strings.TrimSpace(strings.ToLower(raw)) == promptKindPerception {
		return promptKindPerception
	}
	return promptKindMonitoring
}

func allPromptsHaveKind(prompts []PromptText, kind string) bool {
	if len(prompts) == 0 {
		return false
	}
	normalizedKind := normalizePromptKind(kind)
	for _, prompt := range prompts {
		if normalizePromptKind(prompt.Kind) != normalizedKind {
			return false
		}
	}
	return true
}

func normalizeStringIDs(values []string) []string {
	normalized := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	return normalized
}

func analysisRunAcceptsResponses(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "failed", "errored", "cancelled", "cancelled_due_to_timeout", "cancelled_due_to_limits", "cancelled_by_user", "completed":
		return false
	default:
		return true
	}
}

func (s *Service) StartAnalysis(ctx context.Context, input StartAnalysisInput) (StartAnalysisResult, error) {
	requestID := strings.TrimSpace(input.RequestID)
	projectID := strings.TrimSpace(input.ProjectID)
	if projectID == "" {
		return StartAnalysisResult{}, fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if err := s.verifyProjectAccess(ctx, projectID, input.OrganizationID); err != nil {
		return StartAnalysisResult{}, err
	}

	if len(input.PromptTexts) == 0 {
		return StartAnalysisResult{}, fmt.Errorf("%w: promptTexts cannot be empty", ErrValidation)
	}
	if len(input.ModelIDs) == 0 {
		return StartAnalysisResult{}, fmt.Errorf("%w: modelIds cannot be empty", ErrValidation)
	}

	runType := strings.TrimSpace(input.RunType)
	if runType == "" {
		runType = "manual"
	}
	if runType != "manual" && runType != "scheduled" && runType != promptKindPerception {
		return StartAnalysisResult{}, fmt.Errorf("%w: invalid runType", ErrValidation)
	}

	normalizedPrompts := make([]PromptText, 0, len(input.PromptTexts))
	for _, prompt := range input.PromptTexts {
		promptID := strings.TrimSpace(prompt.ID)
		if promptID == "" {
			return StartAnalysisResult{}, fmt.Errorf("%w: prompt id is required", ErrValidation)
		}
		normalizedPrompts = append(normalizedPrompts, PromptText{
			ID:   promptID,
			Text: strings.TrimSpace(prompt.Text),
			Kind: normalizePromptKind(prompt.Kind),
		})
	}

	normalizedModels := make([]string, 0, len(input.ModelIDs))
	seenModel := make(map[string]bool)
	for _, modelID := range input.ModelIDs {
		trimmed := strings.TrimSpace(modelID)
		if trimmed == "" {
			return StartAnalysisResult{}, fmt.Errorf("%w: modelId cannot be empty", ErrValidation)
		}
		if seenModel[trimmed] {
			continue
		}
		seenModel[trimmed] = true
		normalizedModels = append(normalizedModels, trimmed)
	}
	if len(normalizedModels) == 0 {
		return StartAnalysisResult{}, fmt.Errorf("%w: modelIds cannot be empty", ErrValidation)
	}

	s.mu.Lock()

	if err := s.reloadLocked(ctx); err != nil {
		s.mu.Unlock()
		return StartAnalysisResult{}, err
	}

	if requestID != "" {
		requestKey := projectID + "|" + requestID
		if existingRunID, ok := s.runByRequest[requestKey]; ok {
			run := s.runs[existingRunID]
			if run == nil {
				s.mu.Unlock()
				return StartAnalysisResult{}, fmt.Errorf("%w: run", ErrNotFound)
			}
			promptRuns := s.promptRunsForRunLocked(existingRunID)
			s.mu.Unlock()
			log.Printf(
				"analysis_run.replayed run_id=%s project_id=%s request_id=%s status=%s completed=%d expected=%d",
				run.ID,
				projectID,
				requestID,
				run.Status,
				run.CompletedResponses,
				run.ExpectedResponses,
			)
			return StartAnalysisResult{
				AnalysisRun: copyAnalysisRun(run),
				PromptRuns:  promptRuns,
			}, nil
		}
	}

	requestsPerception := allPromptsHaveKind(normalizedPrompts, promptKindPerception)
	if requestsPerception && !input.Force {
		if existing := s.latestFreshPerceptionRunLocked(projectID, s.now().UTC()); existing != nil {
			promptRuns := s.promptRunsForRunLocked(existing.ID)
			s.mu.Unlock()
			log.Printf(
				"analysis_run.perception_reused run_id=%s project_id=%s completed=%d expected=%d",
				existing.ID,
				projectID,
				existing.CompletedResponses,
				existing.ExpectedResponses,
			)
			return StartAnalysisResult{
				AnalysisRun: copyAnalysisRun(existing),
				PromptRuns:  promptRuns,
			}, nil
		}
	}

	now := s.now().UTC()
	requestedCredits := requestedCreditCount(len(normalizedPrompts), input.ModelCreditCostSum, input.RequestedCredits)
	if s.billingQuota != nil {
		monthlyQuota, found, err := s.billingQuota.GetMonthlyQuota(ctx, input.OrganizationID)
		if err != nil {
			s.mu.Unlock()
			return StartAnalysisResult{}, err
		}
		if found && monthlyQuota > 0 {
			reservedCredits := s.currentMonthlyReservedCreditUsageLocked(input.OrganizationID, now)
			if reservedCredits+requestedCredits > monthlyQuota {
				s.mu.Unlock()
				return StartAnalysisResult{}, fmt.Errorf(
					"%w: monthly credit quota reached (%d/%d)",
					ErrQuotaExceeded,
					reservedCredits,
					monthlyQuota,
				)
			}
		}
	}

	backup := s.snapshotLocked()
	expectedResponses := len(normalizedPrompts) * len(normalizedModels)
	run := &AnalysisRun{
		ID:                 s.nextID("run"),
		ProjectID:          projectID,
		OrganizationID:     input.OrganizationID,
		CreatedBy:          input.CreatedBy,
		RunType:            runType,
		Status:             "running",
		PromptsCount:       len(normalizedPrompts),
		ModelsCount:        len(normalizedModels),
		CreditsCount:       requestedCredits,
		ExpectedResponses:  expectedResponses,
		CompletedResponses: 0,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
	s.runs[run.ID] = run
	s.runsByProject[projectID] = append(s.runsByProject[projectID], run.ID)
	s.responseIndexByRun[run.ID] = make(map[string]string)
	if requestID != "" {
		s.runByRequest[projectID+"|"+requestID] = run.ID
	}

	promptRuns := make([]PromptRun, 0, len(normalizedPrompts))
	for _, prompt := range normalizedPrompts {
		promptRun := &PromptRun{
			ID:         s.nextID("prun"),
			RunID:      run.ID,
			PromptID:   prompt.ID,
			PromptText: prompt.Text,
			Kind:       normalizePromptKind(prompt.Kind),
			CreatedAt:  now,
		}
		s.promptRuns[promptRun.ID] = promptRun
		s.promptRunsByRun[run.ID] = append(s.promptRunsByRun[run.ID], promptRun.ID)
		promptRuns = append(promptRuns, copyPromptRun(promptRun))
	}

	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		s.mu.Unlock()
		return StartAnalysisResult{}, err
	}

	dashboard := s.dashboardDataLocked(projectID)
	result := StartAnalysisResult{
		AnalysisRun: copyAnalysisRun(run),
		PromptRuns:  promptRuns,
	}
	s.mu.Unlock()

	s.storeDashboardInCache(ctx, projectID, input.OrganizationID, dashboard)

	log.Printf(
		"analysis_run.created run_id=%s project_id=%s organization_id=%d run_type=%s request_id=%s prompts=%d models=%d expected_responses=%d",
		run.ID,
		projectID,
		input.OrganizationID,
		runType,
		requestID,
		len(normalizedPrompts),
		len(normalizedModels),
		expectedResponses,
	)

	return result, nil
}

func (s *Service) latestFreshPerceptionRunLocked(projectID string, now time.Time) *AnalysisRun {
	cutoff := now.AddDate(0, 0, -7)
	runIDs := s.runsByProject[projectID]
	for i := len(runIDs) - 1; i >= 0; i-- {
		run := s.runs[runIDs[i]]
		if run == nil || !s.runHasPromptKindLocked(run.ID, promptKindPerception) {
			continue
		}
		if run.CreatedAt.Before(cutoff) {
			return nil
		}
		if run.CompletedResponses > 0 || run.Status == "running" {
			return run
		}
	}
	return nil
}

func (s *Service) runHasPromptKindLocked(runID string, kind string) bool {
	for _, promptRunID := range s.promptRunsByRun[runID] {
		promptRun := s.promptRuns[promptRunID]
		if promptRun == nil {
			continue
		}
		if normalizePromptKind(promptRun.Kind) == normalizePromptKind(kind) {
			return true
		}
	}
	return false
}

func (s *Service) RecordResponse(ctx context.Context, input ResponseInput) error {
	runID := strings.TrimSpace(input.RunID)
	promptRunID := strings.TrimSpace(input.PromptRunID)
	modelID := strings.TrimSpace(input.ModelID)
	if runID == "" || promptRunID == "" || modelID == "" {
		return fmt.Errorf("%w: runId, promptRunId and modelId are required", ErrValidation)
	}

	s.mu.Lock()

	if err := s.reloadLocked(ctx); err != nil {
		s.mu.Unlock()
		return err
	}

	backup := s.snapshotLocked()

	run, ok := s.runs[runID]
	if !ok {
		s.mu.Unlock()
		return fmt.Errorf("%w: run", ErrNotFound)
	}
	if !analysisRunAcceptsResponses(run.Status) {
		s.mu.Unlock()
		return fmt.Errorf("%w: analysis run is not accepting responses", ErrValidation)
	}
	promptRun, ok := s.promptRuns[promptRunID]
	if !ok {
		s.mu.Unlock()
		return fmt.Errorf("%w: promptRun", ErrNotFound)
	}
	if promptRun.RunID != runID {
		s.mu.Unlock()
		return fmt.Errorf("%w: promptRun does not belong to run", ErrValidation)
	}

	if s.responseIndexByRun[runID] == nil {
		s.responseIndexByRun[runID] = make(map[string]string)
	}
	responseKey := promptRunID + "|" + modelID
	if existingID, exists := s.responseIndexByRun[runID][responseKey]; exists {
		existing := s.responses[existingID]
		existing.ModelID = modelID
		existing.RawResponse = strings.TrimSpace(input.RawResponse)
		existing.BrandMentioned = input.BrandMentioned
		existing.BrandPosition = normalizeBrandPosition(input.BrandPosition)
		existing.CitationFound = input.CitationFound
		existing.CitedURLs = append([]string(nil), input.CitedURLs...)
		existing.Sentiment = normalizeSentiment(input.Sentiment)
		existing.DeletedAt = nil
	} else {
		response := &AIResponse{
			ID:             s.nextID("resp"),
			RunID:          runID,
			PromptRunID:    promptRunID,
			ModelID:        modelID,
			RawResponse:    strings.TrimSpace(input.RawResponse),
			BrandMentioned: input.BrandMentioned,
			BrandPosition:  normalizeBrandPosition(input.BrandPosition),
			CitationFound:  input.CitationFound,
			CitedURLs:      append([]string(nil), input.CitedURLs...),
			Sentiment:      normalizeSentiment(input.Sentiment),
			CreatedAt:      s.now().UTC(),
		}

		s.responses[response.ID] = response
		s.responsesByRun[runID] = append(s.responsesByRun[runID], response.ID)
		s.responseIndexByRun[runID][responseKey] = response.ID
		run.CompletedResponses++
	}

	run.VisibilityScore = s.calculateVisibilityScoreLocked(runID)
	if run.ExpectedResponses > 0 && run.CompletedResponses >= run.ExpectedResponses {
		run.Status = "completed"
	} else {
		run.Status = "running"
	}
	run.UpdatedAt = s.now().UTC()

	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		s.mu.Unlock()
		return err
	}
	projectID := run.ProjectID
	organizationID := run.OrganizationID
	status := run.Status
	completedResponses := run.CompletedResponses
	expectedResponses := run.ExpectedResponses
	visibilityScore := run.VisibilityScore
	dashboard := s.dashboardDataLocked(projectID)
	s.mu.Unlock()

	s.storeDashboardInCache(ctx, projectID, organizationID, dashboard)

	log.Printf(
		"analysis_response.recorded run_id=%s project_id=%s prompt_run_id=%s model_id=%s status=%s completed=%d expected=%d visibility_score=%d brand_mentioned=%t sentiment=%s response_chars=%d",
		runID,
		projectID,
		promptRunID,
		modelID,
		status,
		completedResponses,
		expectedResponses,
		visibilityScore,
		input.BrandMentioned,
		input.Sentiment,
		len(strings.TrimSpace(input.RawResponse)),
	)

	return nil
}

func (s *Service) DeleteResponse(ctx context.Context, responseID string, organizationID int64) error {
	responseID = strings.TrimSpace(responseID)
	if responseID == "" {
		return fmt.Errorf("%w: responseId is required", ErrValidation)
	}

	s.mu.Lock()
	if err := s.reloadLocked(ctx); err != nil {
		s.mu.Unlock()
		return err
	}
	response, ok := s.responses[responseID]
	if !ok {
		s.mu.Unlock()
		return fmt.Errorf("%w: response", ErrNotFound)
	}
	run := s.runs[response.RunID]
	if run == nil {
		s.mu.Unlock()
		return fmt.Errorf("%w: run", ErrNotFound)
	}
	projectID := run.ProjectID
	s.mu.Unlock()

	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return err
	}

	s.mu.Lock()
	if err := s.reloadLocked(ctx); err != nil {
		s.mu.Unlock()
		return err
	}
	response, ok = s.responses[responseID]
	if !ok {
		s.mu.Unlock()
		return fmt.Errorf("%w: response", ErrNotFound)
	}
	run = s.runs[response.RunID]
	if run == nil {
		s.mu.Unlock()
		return fmt.Errorf("%w: run", ErrNotFound)
	}
	if run.ProjectID != projectID {
		s.mu.Unlock()
		return fmt.Errorf("%w: response project changed", ErrValidation)
	}
	if response.DeletedAt != nil {
		s.mu.Unlock()
		return nil
	}

	backup := s.snapshotLocked()
	deletedAt := s.now().UTC()
	response.DeletedAt = &deletedAt
	run.VisibilityScore = s.calculateVisibilityScoreLocked(run.ID)
	run.UpdatedAt = deletedAt
	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		s.mu.Unlock()
		return err
	}

	dashboard := s.dashboardDataLocked(projectID)
	organizationID = run.OrganizationID
	s.mu.Unlock()

	s.storeDashboardInCache(ctx, projectID, organizationID, dashboard)
	return nil
}

func (s *Service) CancelAnalysisRun(ctx context.Context, runID string, organizationID int64) (AnalysisRun, error) {
	runID = strings.TrimSpace(runID)
	if runID == "" {
		return AnalysisRun{}, fmt.Errorf("%w: runId is required", ErrValidation)
	}

	s.mu.Lock()
	if err := s.reloadLocked(ctx); err != nil {
		s.mu.Unlock()
		return AnalysisRun{}, err
	}
	run, ok := s.runs[runID]
	if !ok {
		s.mu.Unlock()
		return AnalysisRun{}, fmt.Errorf("%w: run", ErrNotFound)
	}
	projectID := run.ProjectID
	s.mu.Unlock()

	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return AnalysisRun{}, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return AnalysisRun{}, err
	}
	run, ok = s.runs[runID]
	if !ok {
		return AnalysisRun{}, fmt.Errorf("%w: run", ErrNotFound)
	}
	if !analysisRunAcceptsResponses(run.Status) {
		return copyAnalysisRun(run), nil
	}

	backup := s.snapshotLocked()
	run.Status = "cancelled_by_user"
	run.UpdatedAt = s.now().UTC()
	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return AnalysisRun{}, err
	}
	return copyAnalysisRun(run), nil
}

func (s *Service) FailAnalysisRun(ctx context.Context, runID string, organizationID int64) (AnalysisRun, error) {
	runID = strings.TrimSpace(runID)
	if runID == "" {
		return AnalysisRun{}, fmt.Errorf("%w: runId is required", ErrValidation)
	}

	s.mu.Lock()
	if err := s.reloadLocked(ctx); err != nil {
		s.mu.Unlock()
		return AnalysisRun{}, err
	}
	run, ok := s.runs[runID]
	if !ok {
		s.mu.Unlock()
		return AnalysisRun{}, fmt.Errorf("%w: run", ErrNotFound)
	}
	projectID := run.ProjectID
	s.mu.Unlock()

	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return AnalysisRun{}, err
	}

	return s.ReleaseCreditUsage(ctx, runID)
}

func (s *Service) ListAnalysisRuns(ctx context.Context, projectID string, organizationID int64, limit int) ([]AnalysisRun, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return nil, fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 10
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}
	if s.failStalledAnalysisRunsLocked(s.now().UTC()) {
		if err := s.persistLocked(ctx); err != nil {
			return nil, err
		}
	}

	ids := s.runsByProject[projectID]
	if len(ids) == 0 {
		return []AnalysisRun{}, nil
	}

	out := make([]AnalysisRun, 0, min(limit, len(ids)))
	for i := len(ids) - 1; i >= 0 && len(out) < limit; i-- {
		run := s.runs[ids[i]]
		if run == nil {
			continue
		}
		out = append(out, s.copyAnalysisRunWithDerivedKindLocked(run))
	}
	return out, nil
}

func (s *Service) copyAnalysisRunWithDerivedKindLocked(run *AnalysisRun) AnalysisRun {
	out := copyAnalysisRun(run)
	if s.runHasPromptKindLocked(out.ID, promptKindPerception) {
		out.RunType = promptKindPerception
	}
	return out
}

func (s *Service) failStalledAnalysisRunsLocked(now time.Time) bool {
	changed := false
	for _, run := range s.runs {
		if run == nil || strings.TrimSpace(strings.ToLower(run.Status)) != "running" {
			continue
		}
		if run.UpdatedAt.IsZero() || now.Sub(run.UpdatedAt) < analysisRunStalledAfter {
			continue
		}
		run.Status = "failed"
		run.UpdatedAt = now
		changed = true
	}
	return changed
}

func (s *Service) ListMissingAnalysisPromptIDs(ctx context.Context, projectID string, organizationID int64, promptIDs []string, modelIDs []string, runType string) ([]string, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return nil, fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return nil, err
	}

	normalizedPrompts := normalizeStringIDs(promptIDs)
	if len(normalizedPrompts) == 0 {
		return []string{}, nil
	}
	normalizedModels := normalizeStringIDs(modelIDs)
	normalizedRunType := strings.TrimSpace(runType)
	if normalizedRunType == "" {
		normalizedRunType = "manual"
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	var candidate *AnalysisRun
	ids := s.runsByProject[projectID]
	for i := len(ids) - 1; i >= 0; i-- {
		run := s.runs[ids[i]]
		if run == nil || run.RunType != normalizedRunType {
			continue
		}
		status := strings.ToLower(strings.TrimSpace(run.Status))
		if status != "failed" && status != "errored" {
			continue
		}
		if run.CompletedResponses <= 0 || (run.ExpectedResponses > 0 && run.CompletedResponses >= run.ExpectedResponses) {
			continue
		}
		candidate = run
		break
	}
	if candidate == nil {
		return normalizedPrompts, nil
	}

	expectedModels := len(normalizedModels)
	if expectedModels == 0 {
		expectedModels = max(1, candidate.ModelsCount)
	}
	promptRunByPromptID := make(map[string]PromptRun)
	for _, promptRun := range s.promptRunsForRunLocked(candidate.ID) {
		promptRunByPromptID[promptRun.PromptID] = promptRun
	}
	responsesByPromptRunID := make(map[string]map[string]struct{})
	for _, response := range s.responsesForRunLocked(candidate.ID) {
		if responsesByPromptRunID[response.PromptRunID] == nil {
			responsesByPromptRunID[response.PromptRunID] = make(map[string]struct{})
		}
		responsesByPromptRunID[response.PromptRunID][response.ModelID] = struct{}{}
	}

	missing := make([]string, 0, len(normalizedPrompts))
	for _, promptID := range normalizedPrompts {
		promptRun, ok := promptRunByPromptID[promptID]
		if !ok {
			missing = append(missing, promptID)
			continue
		}
		if len(responsesByPromptRunID[promptRun.ID]) < expectedModels {
			missing = append(missing, promptID)
		}
	}
	return missing, nil
}

func (s *Service) GetAnalysisRun(ctx context.Context, runID string, organizationID int64) (AnalysisRunDetails, error) {
	runID = strings.TrimSpace(runID)
	if runID == "" {
		return AnalysisRunDetails{}, fmt.Errorf("%w: runId is required", ErrValidation)
	}

	s.mu.Lock()
	if err := s.reloadLocked(ctx); err != nil {
		s.mu.Unlock()
		return AnalysisRunDetails{}, err
	}
	run, ok := s.runs[runID]
	if !ok {
		s.mu.Unlock()
		return AnalysisRunDetails{}, fmt.Errorf("%w: run", ErrNotFound)
	}
	projectID := run.ProjectID
	s.mu.Unlock()

	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return AnalysisRunDetails{}, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return AnalysisRunDetails{}, err
	}

	run, ok = s.runs[runID]
	if !ok {
		return AnalysisRunDetails{}, fmt.Errorf("%w: run", ErrNotFound)
	}
	promptRuns := s.promptRunsForRunLocked(runID)
	responses := s.responsesForRunLocked(runID)
	return AnalysisRunDetails{
		AnalysisRun: copyAnalysisRun(run),
		PromptRuns:  promptRuns,
		Responses:   responses,
	}, nil
}

func (s *Service) GetDashboard(ctx context.Context, projectID string, organizationID int64) (DashboardData, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return DashboardData{}, fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return DashboardData{}, err
	}
	if dashboard, ok := s.loadDashboardFromCache(ctx, projectID, organizationID); ok {
		return dashboard, nil
	}

	s.mu.Lock()
	if err := s.reloadLocked(ctx); err != nil {
		s.mu.Unlock()
		return DashboardData{}, err
	}
	dashboard := s.dashboardDataLocked(projectID)
	s.mu.Unlock()

	s.storeDashboardInCache(ctx, projectID, organizationID, dashboard)
	return dashboard, nil
}

func (s *Service) GetPromptQuotaUsage(ctx context.Context, projectID string, organizationID int64) (PromptQuotaUsage, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return PromptQuotaUsage{}, fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return PromptQuotaUsage{}, err
	}

	now := s.now().UTC()
	monthlyQuota := 0
	hasQuota := false
	if s.billingQuota != nil {
		var err error
		monthlyQuota, hasQuota, err = s.billingQuota.GetMonthlyQuota(ctx, organizationID)
		if err != nil {
			return PromptQuotaUsage{}, err
		}
		if monthlyQuota <= 0 {
			monthlyQuota = 0
			hasQuota = false
		}
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return PromptQuotaUsage{}, err
	}

	usedCredits := s.currentMonthlyCreditUsageLocked(organizationID, now)
	remainingCredits := 0
	if hasQuota {
		remainingCredits = max(0, monthlyQuota-usedCredits)
	}

	return PromptQuotaUsage{
		HasQuota:         hasQuota,
		UsedPrompts:      usedCredits,
		UsedCredits:      usedCredits,
		MonthlyQuota:     monthlyQuota,
		MonthlyCredits:   monthlyQuota,
		RemainingPrompts: remainingCredits,
		RemainingCredits: remainingCredits,
		CurrentMonth:     now.Format("2006-01"),
		IsLimitReached:   hasQuota && usedCredits >= monthlyQuota,
	}, nil
}

func (s *Service) GetPerception(ctx context.Context, projectID string, organizationID int64) (PerceptionData, error) {
	dashboard, err := s.getProjectDashboardData(ctx, projectID, organizationID)
	if err != nil {
		return PerceptionData{}, err
	}
	return s.buildPerceptionFromDashboard(ctx, projectID, organizationID, dashboard)
}

func (s *Service) GetPerceptionWithDashboard(ctx context.Context, projectID string, organizationID int64) (PerceptionWithDashboardData, error) {
	dashboard, err := s.GetDashboard(ctx, projectID, organizationID)
	if err != nil {
		return PerceptionWithDashboardData{}, err
	}
	perceptionDashboard, err := s.getProjectDashboardData(ctx, projectID, organizationID)
	if err != nil {
		return PerceptionWithDashboardData{}, err
	}
	perception, err := s.buildPerceptionFromDashboard(ctx, projectID, organizationID, perceptionDashboard)
	if err != nil {
		return PerceptionWithDashboardData{}, err
	}
	return PerceptionWithDashboardData{
		PerceptionData: perception,
		Dashboard:      dashboard,
	}, nil
}

func (s *Service) getProjectDashboardData(ctx context.Context, projectID string, organizationID int64) (DashboardData, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return DashboardData{}, fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return DashboardData{}, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return DashboardData{}, err
	}
	return s.projectDashboardDataLocked(projectID), nil
}

func (s *Service) buildPerceptionFromDashboard(
	ctx context.Context,
	projectID string,
	organizationID int64,
	dashboard DashboardData,
) (PerceptionData, error) {
	projectModels, hasProjectModels, err := s.listProjectEnabledModels(ctx, projectID, organizationID)
	if err != nil {
		return PerceptionData{}, err
	}
	competitors, err := s.listProjectCompetitors(ctx, projectID, organizationID)
	if err != nil {
		return PerceptionData{}, err
	}
	brandCanon, err := s.GetBrandCanon(ctx, projectID, organizationID)
	if err != nil {
		return PerceptionData{}, err
	}

	var result PerceptionData
	result.BrandCanon = brandCanon
	result.Radar = []PerceptionRadarPoint{}
	result.Responses = []AIResponse{}
	result.Metadata = map[string]any{
		"projectId":     projectID,
		"generatedAt":   time.Now().UTC().Format(time.RFC3339Nano),
		"models":        []string{},
		"projectModels": append([]string(nil), projectModels...),
		"competitors":   append([]string(nil), competitors...),
	}
	brandReadiness := buildPerceptionBrandReadiness(brandCanon, competitors)
	result.Metadata["brandReadiness"] = perceptionReadinessMetadata(brandReadiness)
	responses := dashboard.Responses
	if hasProjectModels {
		responses = filterResponsesByModelIDs(responses, projectModels)
	}
	perceptionResponses := filterResponsesByPromptKind(responses, promptKindPerception)
	monitoringResponsesUsed := 0
	responses = perceptionResponses
	sourceMode := "perception_primary"
	if len(perceptionResponses) == 0 {
		sourceMode = "perception_empty"
	}
	if !dashboard.HasData || len(responses) == 0 {
		result.Responses = []AIResponse{}
		result.Metadata["responses"] = 0
		result.Metadata["analyzedResponses"] = 0
		result.Metadata["perceptionResponses"] = 0
		result.Metadata["monitoringResponsesUsed"] = 0
		result.Metadata["sourceMode"] = sourceMode
		return result, nil
	}
	if !isPerceptionBrandContextReady(brandCanon) {
		sourceMode = "brand_context_missing"
	}

	metrics := make([]perceptionResponseMetrics, 0, len(responses))
	responsesWithMetrics := make([]AIResponse, 0, len(responses))
	modelsSet := make(map[string]struct{}, len(responses))
	for _, response := range responses {
		responseMetrics := buildPerceptionResponseMetrics(response, brandCanon, competitors)
		responseMetrics = applyPerceptionReadinessToMetrics(responseMetrics, brandReadiness)
		metrics = append(metrics, responseMetrics)
		axisMetrics := perceptionResponseAxisMetrics(responseMetrics)
		response.Metrics = &axisMetrics
		responsesWithMetrics = append(responsesWithMetrics, response)
		modelID := strings.TrimSpace(response.ModelID)
		if modelID != "" {
			modelsSet[modelID] = struct{}{}
		}
	}

	models := make([]string, 0, len(modelsSet))
	for modelID := range modelsSet {
		models = append(models, modelID)
	}
	sort.Strings(models)

	result.Scores = capPerceptionScoresForBrandReadiness(
		derivePerceptionScoresFromMetrics(metrics),
		brandReadiness,
	)
	result.Radar = capPerceptionRadarForBrandReadiness(
		derivePerceptionRadarFromMetrics(metrics),
		brandReadiness,
	)
	result.Responses = responsesWithMetrics
	result.Metadata["models"] = models
	result.Metadata["latestRunId"] = latestResponseRunID(responses)
	result.Metadata["windowLabel"] = derivePerceptionWindowLabel(responses, time.Now().UTC())
	result.Metadata["responses"] = len(responses)
	result.Metadata["analyzedResponses"] = len(responses)
	result.Metadata["perceptionResponses"] = len(perceptionResponses)
	result.Metadata["monitoringResponsesUsed"] = monitoringResponsesUsed
	result.Metadata["sourceMode"] = sourceMode
	result.Metadata["visibilityScore"] = dashboard.VisibilityScore
	return result, nil
}

func normalizeResponsePromptKind(response AIResponse) string {
	if normalizePromptKind(response.RunType) == promptKindPerception {
		return promptKindPerception
	}
	if normalizePromptKind(response.PromptKind) == promptKindPerception {
		return promptKindPerception
	}
	return promptKindMonitoring
}

func filterResponsesByPromptKind(responses []AIResponse, kind string) []AIResponse {
	out := make([]AIResponse, 0, len(responses))
	for _, response := range responses {
		if normalizeResponsePromptKind(response) == normalizePromptKind(kind) {
			out = append(out, response)
		}
	}
	return out
}

func latestResponseRunID(responses []AIResponse) string {
	latestRunID := ""
	var latestCreatedAt time.Time
	for _, response := range responses {
		if strings.TrimSpace(response.RunID) == "" {
			continue
		}
		if latestRunID == "" || response.CreatedAt.After(latestCreatedAt) {
			latestRunID = response.RunID
			latestCreatedAt = response.CreatedAt
		}
	}
	return latestRunID
}
