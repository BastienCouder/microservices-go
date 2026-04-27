package usecase

import (
	"context"
	"fmt"
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
		_ = s.markOutboxProcessingFailed(context.Background(), eventID)
		return err
	}
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
	if s.analysisClient == nil || s.iaClient == nil {
		return fmt.Errorf("%w: analysis and ia clients are required", ErrValidation)
	}

	effectiveModelIDs := normalizeModelIDs(modelIDs)
	if len(effectiveModelIDs) == 0 {
		for _, prompt := range prompts {
			effectiveModelIDs = append(effectiveModelIDs, prompt.ModelIDs...)
		}
		effectiveModelIDs = normalizeModelIDs(effectiveModelIDs)
	}
	if len(effectiveModelIDs) == 0 {
		return fmt.Errorf("%w: modelIds cannot be empty", ErrValidation)
	}

	requestID := fmt.Sprintf("%s-%d", project.ID, time.Now().UTC().UnixNano())
	startResp, err := s.analysisClient.StartAnalysis(ctx, AnalysisStartRequest{
		RequestID:      requestID,
		OrganizationID: project.OrganizationID,
		CreatedBy:      project.CreatedBy,
		ProjectID:      project.ID,
		PromptTexts:    prompts,
		ModelIDs:       effectiveModelIDs,
		RunType:        "manual",
	})
	if err != nil {
		return fmt.Errorf("start analysis run: %w", err)
	}
	if startResp.RunID == "" {
		return fmt.Errorf("start analysis run: empty run id")
	}

	if len(startResp.PromptRuns) == 0 {
		startResp.PromptRuns = make([]AnalysisPromptRun, 0, len(prompts))
		for _, prompt := range prompts {
			startResp.PromptRuns = append(startResp.PromptRuns, AnalysisPromptRun{ID: prompt.ID, PromptID: prompt.ID, PromptText: prompt.Text})
		}
	}

	for _, promptRun := range startResp.PromptRuns {
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
			credential, err := s.resolveProviderCredentialForModel(ctx, project.ID, project.OrganizationID, modelID)
			if err != nil {
				return fmt.Errorf("resolve ia provider credential for %s: %w", modelID, err)
			}

			iaResult, err := s.iaClient.ExecutePrompt(ctx, IAExecutePromptInput{
				PromptID:       promptRun.PromptID,
				PromptText:     promptRun.PromptText,
				ModelID:        credential.ProviderModelID,
				ProviderID:     credential.ProviderID,
				ProviderAPIKey: credential.ProviderAPIKey,
				BrandName:      project.BrandName,
				Competitors:    competitors,
			})
			if err != nil {
				return fmt.Errorf("execute ia prompt %s on %s: %w", promptRun.PromptID, modelID, err)
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
				return fmt.Errorf("record analysis response: %w", err)
			}
		}
	}

	return nil
}
