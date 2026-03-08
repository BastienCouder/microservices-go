package usecase

import (
	"context"
	"fmt"
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
	if runType != "manual" && runType != "scheduled" {
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
			return StartAnalysisResult{
				AnalysisRun: copyAnalysisRun(run),
				PromptRuns:  promptRuns,
			}, nil
		}
	}

	backup := s.snapshotLocked()
	now := s.now().UTC()
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

	return result, nil
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
	dashboard := s.dashboardDataLocked(projectID)
	s.mu.Unlock()

	s.storeDashboardInCache(ctx, projectID, organizationID, dashboard)

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

func (s *Service) GetPerception(ctx context.Context, projectID string, organizationID int64) (PerceptionData, error) {
	dashboard, err := s.GetDashboard(ctx, projectID, organizationID)
	if err != nil {
		return PerceptionData{}, err
	}

	var result PerceptionData
	result.Metadata = map[string]any{
		"projectId":   projectID,
		"generatedAt": time.Now().UTC().Format(time.RFC3339Nano),
	}
	if !dashboard.HasData || len(dashboard.Responses) == 0 {
		return result, nil
	}

	analyzed := float64(len(dashboard.Responses))
	mentions := 0
	citations := 0
	positive := 0
	neutral := 0
	negative := 0

	for _, response := range dashboard.Responses {
		if response.BrandMentioned {
			mentions++
		}
		if response.CitationFound {
			citations++
		}
		switch response.Sentiment {
		case "positive":
			positive++
		case "negative":
			negative++
		default:
			neutral++
		}
	}

	result.Scores.PositioningAccuracy = clampToPercent(float64(mentions) / analyzed * 100)
	result.Scores.FactualAccuracy = clampToPercent(float64(citations) / analyzed * 100)
	sentimentWeighted := (float64(positive*100) + float64(neutral*60) + float64(negative*25)) / analyzed
	result.Scores.SentimentScore = clampToPercent(sentimentWeighted)

	result.Metadata["responses"] = len(dashboard.Responses)
	result.Metadata["visibilityScore"] = dashboard.VisibilityScore
	return result, nil
}
