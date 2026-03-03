package usecase

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"
)

func NewService(repo Repository, projectVerifier ProjectAccessVerifier) *Service {
	return &Service{repo: repo, projectVerifier: projectVerifier, now: time.Now}
}

func (s *Service) RecordEvent(ctx context.Context, input RecordEventInput) (Event, error) {
	projectID := strings.TrimSpace(input.ProjectID)
	userID := strings.TrimSpace(input.UserID)
	if projectID == "" || userID == "" {
		return Event{}, fmt.Errorf("%w: projectId and userId are required", ErrValidation)
	}
	if err := s.ensureProjectAccess(ctx, projectID, userID); err != nil {
		return Event{}, err
	}

	stage := normalizeStage(input.Stage)
	if stage == "" {
		return Event{}, fmt.Errorf("%w: stage must be visit, signup, trial or paid", ErrValidation)
	}
	source := strings.ToLower(strings.TrimSpace(input.Source))
	if source == "" {
		source = "unknown"
	}
	if input.Count <= 0 {
		return Event{}, fmt.Errorf("%w: count must be a positive integer", ErrValidation)
	}
	if input.RevenueCents < 0 {
		return Event{}, fmt.Errorf("%w: revenueCents cannot be negative", ErrValidation)
	}
	if stage != StagePaid {
		input.RevenueCents = 0
	}

	occurredAt := input.OccurredAt
	if occurredAt.IsZero() {
		occurredAt = s.now().UTC()
	} else {
		occurredAt = occurredAt.UTC()
	}

	created, err := s.repo.InsertEvent(ctx, Event{
		ProjectID:    projectID,
		Stage:        stage,
		Source:       source,
		Count:        input.Count,
		RevenueCents: input.RevenueCents,
		OccurredAt:   occurredAt,
	})
	if err != nil {
		return Event{}, err
	}
	return created, nil
}

func (s *Service) ListEvents(ctx context.Context, projectID, userID string, from, to time.Time, limit int) ([]Event, error) {
	projectID = strings.TrimSpace(projectID)
	userID = strings.TrimSpace(userID)
	if projectID == "" || userID == "" {
		return nil, fmt.Errorf("%w: projectId and userId are required", ErrValidation)
	}
	if err := s.ensureProjectAccess(ctx, projectID, userID); err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}

	windowFrom, windowTo, err := normalizeWindow(from, to, s.now)
	if err != nil {
		return nil, err
	}

	events, err := s.repo.ListEvents(ctx, projectID, windowFrom, windowTo, limit)
	if err != nil {
		return nil, err
	}
	sort.Slice(events, func(i, j int) bool {
		return events[i].OccurredAt.After(events[j].OccurredAt)
	})
	return events, nil
}

func (s *Service) GetFunnel(ctx context.Context, projectID, userID string, from, to time.Time) (FunnelData, error) {
	projectID = strings.TrimSpace(projectID)
	userID = strings.TrimSpace(userID)
	if projectID == "" || userID == "" {
		return FunnelData{}, fmt.Errorf("%w: projectId and userId are required", ErrValidation)
	}
	if err := s.ensureProjectAccess(ctx, projectID, userID); err != nil {
		return FunnelData{}, err
	}

	windowFrom, windowTo, err := normalizeWindow(from, to, s.now)
	if err != nil {
		return FunnelData{}, err
	}

	totals, err := s.repo.GetFunnelTotals(ctx, projectID, windowFrom, windowTo)
	if err != nil {
		return FunnelData{}, err
	}

	return FunnelData{
		ProjectID:         projectID,
		Visits:            totals.Visits,
		Signups:           totals.Signups,
		Trials:            totals.Trials,
		Paid:              totals.Paid,
		RevenueCents:      totals.RevenueCents,
		VisitToSignupRate: percent(totals.Signups, totals.Visits),
		SignupToTrialRate: percent(totals.Trials, totals.Signups),
		TrialToPaidRate:   percent(totals.Paid, totals.Trials),
		WindowStart:       windowFrom.Format(time.RFC3339),
		WindowEnd:         windowTo.Format(time.RFC3339),
	}, nil
}
