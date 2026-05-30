package usecase

import (
	"context"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"
)

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
	if runType != "manual" && runType != "scheduled" && runType != "perception" {
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

	if runType == "perception" {
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
			usedCredits := s.currentMonthlyCreditUsageLocked(input.OrganizationID, now)
			if usedCredits+requestedCredits > monthlyQuota {
				s.mu.Unlock()
				return StartAnalysisResult{}, fmt.Errorf(
					"%w: monthly credit quota reached (%d/%d)",
					ErrQuotaExceeded,
					usedCredits,
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
		if run == nil || run.RunType != "perception" {
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
		out = append(out, copyAnalysisRun(run))
	}
	return out, nil
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
	dashboard, err := s.GetDashboard(ctx, projectID, organizationID)
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
	perception, err := s.buildPerceptionFromDashboard(ctx, projectID, organizationID, dashboard)
	if err != nil {
		return PerceptionWithDashboardData{}, err
	}
	return PerceptionWithDashboardData{
		PerceptionData: perception,
		Dashboard:      dashboard,
	}, nil
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
	result.TopErrors = []PerceptionError{}
	result.Metadata = map[string]any{
		"projectId":     projectID,
		"generatedAt":   time.Now().UTC().Format(time.RFC3339Nano),
		"models":        []string{},
		"projectModels": append([]string(nil), projectModels...),
		"competitors":   append([]string(nil), competitors...),
	}
	responses := dashboard.Responses
	if hasProjectModels {
		responses = filterResponsesByModelIDs(responses, projectModels)
	}
	perceptionResponses := filterResponsesByRunType(responses, "perception")
	monitoringResponsesUsed := 0
	sourceMode := "fallback_all"
	if len(perceptionResponses) > 0 {
		monitoringResponsesUsed = 0
		responses = perceptionResponses
		sourceMode = "perception_primary"
	} else {
		monitoringResponsesUsed = len(responses)
	}
	if !dashboard.HasData || len(responses) == 0 {
		result.Metadata["responses"] = 0
		result.Metadata["analyzedResponses"] = 0
		result.Metadata["perceptionResponses"] = 0
		result.Metadata["monitoringResponsesUsed"] = 0
		result.Metadata["sourceMode"] = sourceMode
		return result, nil
	}

	metrics := make([]perceptionResponseMetrics, 0, len(responses))
	modelsSet := make(map[string]struct{}, len(responses))
	metricsByModel := make(map[string][]perceptionResponseMetrics)
	for _, response := range responses {
		responseMetrics := buildPerceptionResponseMetrics(response, brandCanon, competitors)
		metrics = append(metrics, responseMetrics)
		modelID := strings.TrimSpace(response.ModelID)
		if modelID != "" {
			modelsSet[modelID] = struct{}{}
			metricsByModel[modelID] = append(metricsByModel[modelID], responseMetrics)
		}
	}

	models := make([]string, 0, len(modelsSet))
	for modelID := range modelsSet {
		models = append(models, modelID)
	}
	sort.Strings(models)

	result.Scores = derivePerceptionScoresFromMetrics(metrics)
	result.Radar = derivePerceptionRadarFromMetrics(metrics)
	result.TopErrors = derivePerceptionTopErrors(brandCanon, result.Scores, result.Radar, metricsByModel)
	result.Metadata["models"] = models
	result.Metadata["latestRunId"] = ""
	if dashboard.LatestRun != nil {
		result.Metadata["latestRunId"] = dashboard.LatestRun.ID
	}
	result.Metadata["windowLabel"] = derivePerceptionWindowLabel(responses, time.Now().UTC())
	result.Metadata["responses"] = len(responses)
	result.Metadata["analyzedResponses"] = len(responses)
	result.Metadata["perceptionResponses"] = len(perceptionResponses)
	result.Metadata["monitoringResponsesUsed"] = monitoringResponsesUsed
	result.Metadata["sourceMode"] = sourceMode
	result.Metadata["visibilityScore"] = dashboard.VisibilityScore
	return result, nil
}

func filterResponsesByRunType(responses []AIResponse, runType string) []AIResponse {
	out := make([]AIResponse, 0, len(responses))
	for _, response := range responses {
		if strings.TrimSpace(response.RunType) == runType {
			out = append(out, response)
		}
	}
	return out
}
