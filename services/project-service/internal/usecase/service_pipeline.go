package usecase

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"
)

func (s *Service) ListOutboxEventsToPublish(ctx context.Context, limit int) ([]OutboxEvent, error) {
	if limit <= 0 {
		limit = 50
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	out := make([]OutboxEvent, 0, limit)
	for _, eventID := range s.outboxOrder {
		event, ok := s.outbox[eventID]
		if !ok {
			continue
		}
		if event.Status != OutboxStatusPending {
			continue
		}
		out = append(out, copyOutboxEvent(event))
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}

func (s *Service) MarkOutboxEventPublished(ctx context.Context, eventID string) error {
	eventID = strings.TrimSpace(eventID)
	if eventID == "" {
		return fmt.Errorf("%w: eventId is required", ErrValidation)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return err
	}

	event, ok := s.outbox[eventID]
	if !ok {
		return fmt.Errorf("%w: outbox event", ErrNotFound)
	}
	if event.Status == OutboxStatusPublished || event.Status == OutboxStatusProcessed {
		return nil
	}

	backup := s.snapshotLocked()
	event.Status = OutboxStatusPublished
	event.UpdatedAt = s.now().UTC()
	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return err
	}
	return nil
}

func (s *Service) ProcessFinalizedProjectOutboxEvent(ctx context.Context, eventID string) error {
	eventID = strings.TrimSpace(eventID)
	if eventID == "" {
		return fmt.Errorf("%w: eventId is required", ErrValidation)
	}

	payload, err := s.beginOutboxProcessing(ctx, eventID)
	if err != nil {
		return err
	}
	if payload == nil {
		return nil
	}

	err = s.runInitialAnalysis(ctx, payload.Project, payload.Prompts, payload.ModelIDs, payload.Competitors)
	if err != nil {
		log.Printf(
			"prompt_analysis.initial_failed event_id=%s project_id=%s prompts=%d models=%v error=%v",
			eventID,
			payload.Project.ID,
			len(payload.Prompts),
			payload.ModelIDs,
			err,
		)
		_ = s.markOutboxProcessingFailed(context.Background(), eventID)
		return err
	}
	log.Printf(
		"prompt_analysis.initial_completed event_id=%s project_id=%s prompts=%d models=%v",
		eventID,
		payload.Project.ID,
		len(payload.Prompts),
		payload.ModelIDs,
	)
	if err := s.markOutboxProcessed(ctx, eventID); err != nil {
		return err
	}
	return nil
}

func (s *Service) beginOutboxProcessing(ctx context.Context, eventID string) (*FinalizePipelinePayload, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	event, ok := s.outbox[eventID]
	if !ok {
		return nil, fmt.Errorf("%w: outbox event", ErrNotFound)
	}
	if event.EventType != OutboxEventTypeProjectFinalized {
		return nil, fmt.Errorf("%w: unsupported outbox event type", ErrValidation)
	}
	switch event.Status {
	case OutboxStatusProcessed, OutboxStatusProcessing:
		return nil, nil
	case OutboxStatusPending, OutboxStatusPublished:
		// continue
	default:
		return nil, fmt.Errorf("%w: unsupported outbox event status", ErrValidation)
	}

	backup := s.snapshotLocked()
	event.Status = OutboxStatusProcessing
	event.UpdatedAt = s.now().UTC()
	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return nil, err
	}

	payload := event.Payload
	payload.Prompts = append([]AnalysisPromptText(nil), payload.Prompts...)
	payload.ModelIDs = append([]string(nil), payload.ModelIDs...)
	payload.Competitors = append([]string(nil), payload.Competitors...)
	return &payload, nil
}

func (s *Service) markOutboxProcessed(ctx context.Context, eventID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return err
	}

	event, ok := s.outbox[eventID]
	if !ok {
		return fmt.Errorf("%w: outbox event", ErrNotFound)
	}
	if event.Status == OutboxStatusProcessed {
		return nil
	}

	backup := s.snapshotLocked()
	event.Status = OutboxStatusProcessed
	event.UpdatedAt = s.now().UTC()
	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return err
	}
	return nil
}

func (s *Service) markOutboxProcessingFailed(ctx context.Context, eventID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return err
	}

	event, ok := s.outbox[eventID]
	if !ok {
		return nil
	}
	if event.Status != OutboxStatusProcessing {
		return nil
	}

	backup := s.snapshotLocked()
	event.Status = OutboxStatusPublished
	event.UpdatedAt = s.now().UTC()
	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return err
	}
	return nil
}

func (s *Service) runInitialAnalysis(ctx context.Context, project Project, prompts []AnalysisPromptText, modelIDs []string, competitors []string) error {
	requestID := fmt.Sprintf("%s-%d", project.ID, time.Now().UTC().UnixNano())
	_, err := s.runAnalysis(ctx, project, prompts, modelIDs, competitors, requestID, "manual", false)
	return err
}

func (s *Service) RunManualAnalysis(ctx context.Context, projectID string, organizationID int64, createdBy int64, input RunManualAnalysisInput) (AnalysisStartResponse, error) {
	projectID = strings.TrimSpace(projectID)
	modelIDs := normalizeModelIDs(input.ModelIDs)
	if projectID == "" {
		return AnalysisStartResponse{}, fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if len(input.PromptTexts) == 0 {
		return AnalysisStartResponse{}, fmt.Errorf("%w: promptTexts cannot be empty", ErrValidation)
	}
	if len(modelIDs) == 0 {
		return AnalysisStartResponse{}, fmt.Errorf("%w: modelIds cannot be empty", ErrValidation)
	}

	s.mu.Lock()
	if err := s.reloadLocked(ctx); err != nil {
		s.mu.Unlock()
		return AnalysisStartResponse{}, err
	}

	project, err := s.getProjectForOrganizationLocked(projectID, organizationID)
	if err != nil {
		s.mu.Unlock()
		return AnalysisStartResponse{}, err
	}
	projectCopy := s.effectiveProjectLocked(project)
	if createdBy > 0 {
		projectCopy.CreatedBy = createdBy
	}

	enabledModelIDs := filterEnabledModels(s.projectModels, s.models, projectID)
	if _, err := validatePromptModelIDs(modelIDs, enabledModelIDs); err != nil {
		s.mu.Unlock()
		return AnalysisStartResponse{}, err
	}

	promptTexts := make([]AnalysisPromptText, 0, len(input.PromptTexts))
	for _, item := range input.PromptTexts {
		promptID := strings.TrimSpace(item.ID)
		if promptID == "" {
			s.mu.Unlock()
			return AnalysisStartResponse{}, fmt.Errorf("%w: prompt id is required", ErrValidation)
		}

		prompt, ok := s.prompts[promptID]
		if !ok || prompt.ProjectID != projectID {
			s.mu.Unlock()
			return AnalysisStartResponse{}, fmt.Errorf("%w: prompt %s", ErrNotFound, promptID)
		}
		if normalizePromptKind(prompt.Kind) != PromptKindMonitoring {
			s.mu.Unlock()
			return AnalysisStartResponse{}, fmt.Errorf("%w: prompt %s is not a monitoring prompt", ErrValidation, promptID)
		}
		if !prompt.IsActive {
			s.mu.Unlock()
			return AnalysisStartResponse{}, fmt.Errorf("%w: prompt %s is not active", ErrValidation, promptID)
		}

		promptModelIDs := modelIDs
		if len(item.ModelIDs) > 0 {
			normalized, err := validatePromptModelIDs(item.ModelIDs, enabledModelIDs)
			if err != nil {
				s.mu.Unlock()
				return AnalysisStartResponse{}, err
			}
			promptModelIDs = normalized
		}

		text := strings.TrimSpace(item.Text)
		if text == "" {
			text = prompt.Text
		}
		if text == "" {
			s.mu.Unlock()
			return AnalysisStartResponse{}, fmt.Errorf("%w: prompt text is required", ErrValidation)
		}

		promptTexts = append(promptTexts, AnalysisPromptText{
			ID:       promptID,
			Text:     text,
			Kind:     normalizePromptKind(prompt.Kind),
			Language: prompt.Language,
			ModelIDs: append([]string(nil), promptModelIDs...),
		})
	}
	competitors := filterActiveCompetitorsByProject(s.competitors, projectID)
	s.mu.Unlock()

	runType := strings.TrimSpace(input.RunType)
	if runType == "" {
		runType = "manual"
	}
	return s.runAnalysis(ctx, projectCopy, promptTexts, modelIDs, competitors, input.RequestID, runType, false)
}

func buildExecutionPromptText(prompt AnalysisPromptText) string {
	baseText := strings.TrimSpace(prompt.Text)
	language, ok := normalizePromptLanguage(prompt.Language)
	if !ok || baseText == "" {
		return baseText
	}

	instruction := "Answer in English."
	if language == "fr" {
		instruction = "Reponds en francais."
	}

	if strings.Contains(strings.ToLower(baseText), strings.ToLower(instruction)) {
		return baseText
	}

	return strings.TrimSpace(baseText + "\n\n" + instruction)
}

func (s *Service) runAnalysis(ctx context.Context, project Project, prompts []AnalysisPromptText, modelIDs []string, competitors []string, requestID string, runType string, force bool) (AnalysisStartResponse, error) {
	if s.analysisClient == nil || s.iaClient == nil {
		return AnalysisStartResponse{}, fmt.Errorf("%w: analysis and ia clients are required", ErrValidation)
	}

	effectiveModelIDs := normalizeModelIDs(modelIDs)
	if len(effectiveModelIDs) == 0 {
		for _, prompt := range prompts {
			effectiveModelIDs = append(effectiveModelIDs, prompt.ModelIDs...)
		}
		effectiveModelIDs = normalizeModelIDs(effectiveModelIDs)
	}
	if len(effectiveModelIDs) == 0 {
		return AnalysisStartResponse{}, fmt.Errorf("%w: modelIds cannot be empty", ErrValidation)
	}
	runType = strings.TrimSpace(runType)
	if runType == "" {
		runType = "manual"
	}
	modelCreditCosts, err := s.modelCreditCosts(ctx, effectiveModelIDs)
	if err != nil {
		return AnalysisStartResponse{}, err
	}
	modelCreditCostTotal := modelCreditCostSum(effectiveModelIDs, modelCreditCosts)
	requestedCredits := requestedCreditsForRun(runType, prompts, effectiveModelIDs, modelCreditCosts)

	log.Printf(
		"prompt_analysis.start project_id=%s organization_id=%d run_type=%s request_id=%s prompts=%d models=%v competitors=%d",
		project.ID,
		project.OrganizationID,
		runType,
		strings.TrimSpace(requestID),
		len(prompts),
		effectiveModelIDs,
		len(competitors),
	)

	startResp, err := s.analysisClient.StartAnalysis(ctx, AnalysisStartRequest{
		RequestID:          requestID,
		OrganizationID:     project.OrganizationID,
		CreatedBy:          project.CreatedBy,
		ProjectID:          project.ID,
		PromptTexts:        prompts,
		ModelIDs:           effectiveModelIDs,
		ModelCreditCostSum: modelCreditCostTotal,
		RequestedCredits:   requestedCredits,
		RunType:            runType,
		Force:              force,
	})
	if err != nil {
		log.Printf(
			"prompt_analysis.start_failed project_id=%s run_type=%s prompts=%d models=%v error=%v",
			project.ID,
			runType,
			len(prompts),
			effectiveModelIDs,
			err,
		)
		return AnalysisStartResponse{}, fmt.Errorf("start analysis run: %w", err)
	}
	if startResp.RunID == "" {
		return AnalysisStartResponse{}, fmt.Errorf("start analysis run: empty run id")
	}
	startResp.RequestedCredits = requestedCredits
	log.Printf(
		"prompt_analysis.run_created run_id=%s project_id=%s run_type=%s prompt_runs=%d models=%v",
		startResp.RunID,
		project.ID,
		runType,
		len(startResp.PromptRuns),
		effectiveModelIDs,
	)

	if len(startResp.PromptRuns) == 0 {
		startResp.PromptRuns = make([]AnalysisPromptRun, 0, len(prompts))
		for _, prompt := range prompts {
			startResp.PromptRuns = append(startResp.PromptRuns, AnalysisPromptRun{ID: prompt.ID, PromptID: prompt.ID, PromptText: prompt.Text})
		}
	}

	runCtx := context.WithoutCancel(ctx)
	asyncStartResp := startResp
	asyncProject := project
	asyncPrompts := append([]AnalysisPromptText(nil), prompts...)
	asyncModelIDs := append([]string(nil), effectiveModelIDs...)
	asyncCompetitors := append([]string(nil), competitors...)
	go func() {
		if err := s.executeAnalysisRun(runCtx, asyncProject, asyncPrompts, asyncModelIDs, asyncCompetitors, asyncStartResp, runType); err != nil {
			log.Printf(
				"prompt_analysis.async_failed run_id=%s project_id=%s run_type=%s error=%v",
				asyncStartResp.RunID,
				asyncProject.ID,
				runType,
				err,
			)
		}
	}()

	return startResp, nil
}

func (s *Service) executeAnalysisRun(ctx context.Context, project Project, prompts []AnalysisPromptText, effectiveModelIDs []string, competitors []string, startResp AnalysisStartResponse, runType string) error {
	for _, promptRun := range startResp.PromptRuns {
		cancelled, err := s.analysisClient.IsAnalysisRunCancelled(ctx, startResp.RunID, project.OrganizationID)
		if err != nil {
			s.failAnalysisRunAfterPipelineError(ctx, startResp.RunID, project.OrganizationID, err)
			return fmt.Errorf("check analysis cancellation: %w", err)
		}
		if cancelled {
			log.Printf(
				"prompt_analysis.cancelled run_id=%s project_id=%s before_prompt_id=%s",
				startResp.RunID,
				project.ID,
				promptRun.PromptID,
			)
			return nil
		}

		promptModelIDs := effectiveModelIDs
		for _, prompt := range prompts {
			if prompt.ID == promptRun.PromptID {
				if normalized := normalizeModelIDs(prompt.ModelIDs); len(normalized) > 0 {
					promptModelIDs = normalized
				}
				break
			}
		}

		for _, modelID := range promptModelIDs {
			cancelled, err := s.analysisClient.IsAnalysisRunCancelled(ctx, startResp.RunID, project.OrganizationID)
			if err != nil {
				s.failAnalysisRunAfterPipelineError(ctx, startResp.RunID, project.OrganizationID, err)
				return fmt.Errorf("check analysis cancellation: %w", err)
			}
			if cancelled {
				log.Printf(
					"prompt_analysis.cancelled run_id=%s project_id=%s prompt_id=%s before_model_id=%s",
					startResp.RunID,
					project.ID,
					promptRun.PromptID,
					modelID,
				)
				return nil
			}

			credential, err := s.resolveProviderCredentialForModel(ctx, project.ID, project.OrganizationID, modelID)
			if err != nil {
				log.Printf(
					"prompt_analysis.credential_failed run_id=%s project_id=%s prompt_id=%s model_id=%s error=%v",
					startResp.RunID,
					project.ID,
					promptRun.PromptID,
					modelID,
					err,
				)
				s.failAnalysisRunAfterPipelineError(ctx, startResp.RunID, project.OrganizationID, err)
				return fmt.Errorf("resolve ia provider credential for %s: %w", modelID, err)
			}

			execStart := time.Now()
			log.Printf(
				"prompt_analysis.model_start run_id=%s project_id=%s prompt_id=%s prompt_run_id=%s model_id=%s provider_id=%s provider_model_id=%s",
				startResp.RunID,
				project.ID,
				promptRun.PromptID,
				promptRun.ID,
				modelID,
				credential.ProviderID,
				credential.ProviderModelID,
			)
			executionPromptText := promptRun.PromptText
			for _, prompt := range prompts {
				if prompt.ID == promptRun.PromptID {
					executionPromptText = buildExecutionPromptText(prompt)
					break
				}
			}
			iaResult, err := s.iaClient.ExecutePrompt(ctx, IAExecutePromptInput{
				PromptID:       promptRun.PromptID,
				PromptText:     executionPromptText,
				ModelID:        credential.ProviderModelID,
				ProviderID:     credential.ProviderID,
				ProviderAPIKey: credential.ProviderAPIKey,
				PromptMode:     PromptModeOrganic,
				BrandName:      project.BrandName,
				Competitors:    competitors,
			})
			if err != nil {
				log.Printf(
					"prompt_analysis.model_failed run_id=%s project_id=%s prompt_id=%s prompt_run_id=%s model_id=%s provider_id=%s duration_ms=%d error=%v",
					startResp.RunID,
					project.ID,
					promptRun.PromptID,
					promptRun.ID,
					modelID,
					credential.ProviderID,
					time.Since(execStart).Milliseconds(),
					err,
				)
				s.failAnalysisRunAfterPipelineError(ctx, startResp.RunID, project.OrganizationID, err)
				return fmt.Errorf("%w: execute ia prompt %s on %s: %v", ErrDependencyUnavailable, promptRun.PromptID, modelID, err)
			}
			cancelled, err = s.analysisClient.IsAnalysisRunCancelled(ctx, startResp.RunID, project.OrganizationID)
			if err != nil {
				s.failAnalysisRunAfterPipelineError(ctx, startResp.RunID, project.OrganizationID, err)
				return fmt.Errorf("check analysis cancellation: %w", err)
			}
			if cancelled {
				log.Printf(
					"prompt_analysis.cancelled run_id=%s project_id=%s prompt_id=%s model_id=%s before_record_response=true",
					startResp.RunID,
					project.ID,
					promptRun.PromptID,
					modelID,
				)
				return nil
			}
			err = s.analysisClient.RecordResponse(ctx, startResp.RunID, AnalysisRecordResponseInput{
				PromptRunID:    promptRun.ID,
				ModelID:        modelID,
				RawResponse:    iaResult.RawResponse,
				BrandMentioned: iaResult.Analysis.BrandMentioned,
				BrandPosition:  iaResult.Analysis.BrandPosition,
				CitationFound:  iaResult.Analysis.CitationFound,
				CitedURLs:      iaResult.Analysis.CitedURLs,
				Sentiment:      iaResult.Analysis.Sentiment,
			})
			if err != nil {
				log.Printf(
					"prompt_analysis.record_failed run_id=%s project_id=%s prompt_id=%s prompt_run_id=%s model_id=%s duration_ms=%d error=%v",
					startResp.RunID,
					project.ID,
					promptRun.PromptID,
					promptRun.ID,
					modelID,
					time.Since(execStart).Milliseconds(),
					err,
				)
				s.failAnalysisRunAfterPipelineError(ctx, startResp.RunID, project.OrganizationID, err)
				return fmt.Errorf("record analysis response: %w", err)
			}
			log.Printf(
				"prompt_analysis.model_completed run_id=%s project_id=%s prompt_id=%s prompt_run_id=%s model_id=%s duration_ms=%d brand_mentioned=%t brand_position=%s citation_found=%t sentiment=%s response_chars=%d",
				startResp.RunID,
				project.ID,
				promptRun.PromptID,
				promptRun.ID,
				modelID,
				time.Since(execStart).Milliseconds(),
				iaResult.Analysis.BrandMentioned,
				iaResult.Analysis.BrandPosition,
				iaResult.Analysis.CitationFound,
				iaResult.Analysis.Sentiment,
				len(iaResult.RawResponse),
			)
		}
	}

	log.Printf(
		"prompt_analysis.completed run_id=%s project_id=%s run_type=%s prompts=%d models=%v",
		startResp.RunID,
		project.ID,
		runType,
		len(prompts),
		effectiveModelIDs,
	)
	return nil
}

func (s *Service) failAnalysisRunAfterPipelineError(ctx context.Context, runID string, organizationID int64, cause error) {
	if strings.TrimSpace(runID) == "" {
		return
	}
	if err := s.analysisClient.FailAnalysisRun(ctx, runID, organizationID); err != nil {
		log.Printf(
			"prompt_analysis.fail_run_failed run_id=%s organization_id=%d cause=%v error=%v",
			runID,
			organizationID,
			cause,
			err,
		)
	}
}

func (s *Service) modelCreditCosts(ctx context.Context, modelIDs []string) (map[string]int, error) {
	normalized := normalizeModelIDs(modelIDs)

	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	costs := make(map[string]int, len(normalized))
	for _, modelID := range normalized {
		model, ok := s.models[modelID]
		if !ok || model.CreditCost <= 0 {
			costs[modelID] = 1
			continue
		}
		costs[modelID] = model.CreditCost
	}
	return costs, nil
}

func modelCreditCostSum(modelIDs []string, costs map[string]int) int {
	total := 0
	for _, modelID := range normalizeModelIDs(modelIDs) {
		total += modelCreditCost(modelID, costs)
	}
	if total <= 0 {
		return 1
	}
	return total
}

func requestedCreditsForPrompts(prompts []AnalysisPromptText, fallbackModelIDs []string, costs map[string]int) int {
	total := 0
	for _, prompt := range prompts {
		modelIDs := normalizeModelIDs(prompt.ModelIDs)
		if len(modelIDs) == 0 {
			modelIDs = normalizeModelIDs(fallbackModelIDs)
		}
		total += modelCreditCostSum(modelIDs, costs)
	}
	return total
}

func requestedCreditsForRun(runType string, prompts []AnalysisPromptText, fallbackModelIDs []string, costs map[string]int) int {
	return requestedCreditsForPrompts(prompts, fallbackModelIDs, costs)
}

func modelCreditCost(modelID string, costs map[string]int) int {
	if costs != nil {
		if cost := costs[strings.TrimSpace(modelID)]; cost > 0 {
			return cost
		}
	}
	return 1
}
