package usecase

import (
	"context"
	"crypto/subtle"
	"fmt"
	"strings"
)

func (s *Service) RecordIngestionEvent(ctx context.Context, input RecordIngestionEventInput) (Event, error) {
	projectID := strings.TrimSpace(input.ProjectID)
	signingToken := strings.TrimSpace(input.SigningToken)
	if projectID == "" || signingToken == "" {
		return Event{}, fmt.Errorf("%w: projectId and signingToken are required", ErrValidation)
	}
	if s.projectResolver == nil {
		return Event{}, fmt.Errorf("%w: project resolver is not configured", ErrValidation)
	}

	project, err := s.projectResolver.GetProject(ctx, projectID, 0)
	if err != nil {
		return Event{}, err
	}

	expectedToken := strings.TrimSpace(project.Ingestion.SigningToken)
	if expectedToken == "" {
		return Event{}, fmt.Errorf("%w: ingestion is not configured for project", ErrUnauthorized)
	}
	if subtle.ConstantTimeCompare([]byte(signingToken), []byte(expectedToken)) != 1 {
		return Event{}, fmt.Errorf("%w: invalid ingestion signing token", ErrUnauthorized)
	}

	stage := normalizeStage(input.Stage)
	if stage == "" {
		return Event{}, fmt.Errorf("%w: stage must be signup, trial or paid", ErrValidation)
	}
	if stage == StageVisit {
		return Event{}, fmt.Errorf("%w: visits must come from ga4, not ingestion", ErrValidation)
	}

	return s.recordValidatedEvent(
		ctx,
		projectID,
		stage,
		input.Source,
		input.Count,
		input.RevenueCents,
		input.OccurredAt,
	)
}
