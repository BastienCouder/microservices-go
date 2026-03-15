package usecase

import (
	"context"
	"fmt"
	"testing"
	"time"
)

type testRepo struct {
	events []Event
	nextID int64
}

func (r *testRepo) InsertEvent(_ context.Context, event Event) (Event, error) {
	r.nextID++
	event.ID = r.nextID
	event.CreatedAt = time.Now().UTC()
	r.events = append(r.events, event)
	return event, nil
}

func (r *testRepo) ListEvents(_ context.Context, projectID string, from, to time.Time, limit int) ([]Event, error) {
	out := make([]Event, 0)
	for i := len(r.events) - 1; i >= 0; i-- {
		event := r.events[i]
		if event.ProjectID != projectID {
			continue
		}
		if event.OccurredAt.Before(from) || event.OccurredAt.After(to) {
			continue
		}
		out = append(out, event)
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}

func (r *testRepo) GetFunnelTotals(_ context.Context, projectID string, from, to time.Time) (FunnelTotals, error) {
	var totals FunnelTotals
	for _, event := range r.events {
		if event.ProjectID != projectID {
			continue
		}
		if event.OccurredAt.Before(from) || event.OccurredAt.After(to) {
			continue
		}
		switch event.Stage {
		case StageVisit:
			totals.Visits += event.Count
		case StageSignup:
			totals.Signups += event.Count
		case StageTrial:
			totals.Trials += event.Count
		case StagePaid:
			totals.Paid += event.Count
			totals.RevenueCents += event.RevenueCents
		}
	}
	return totals, nil
}

func (r *testRepo) GetSourceTotals(_ context.Context, projectID string, from, to time.Time) ([]FunnelSource, error) {
	items := make(map[string]*FunnelSource)
	for _, event := range r.events {
		if event.ProjectID != projectID {
			continue
		}
		if event.OccurredAt.Before(from) || event.OccurredAt.After(to) {
			continue
		}
		current := items[event.Source]
		if current == nil {
			current = &FunnelSource{Source: event.Source}
			items[event.Source] = current
		}
		switch event.Stage {
		case StageVisit:
			current.Visits += event.Count
		case StageSignup:
			current.Signups += event.Count
		case StageTrial:
			current.Trials += event.Count
		case StagePaid:
			current.Paid += event.Count
			current.RevenueCents += event.RevenueCents
		}
	}

	out := make([]FunnelSource, 0, len(items))
	for _, item := range items {
		out = append(out, *item)
	}
	return out, nil
}

type staticProjectResolver struct {
	project ProjectMetadata
}

func (r staticProjectResolver) GetProject(_ context.Context, projectID string, _ int64) (ProjectMetadata, error) {
	if projectID != r.project.ID {
		return ProjectMetadata{}, fmt.Errorf("%w: project", ErrNotFound)
	}
	return r.project, nil
}

type allowVerifier struct{}

func (allowVerifier) EnsureProjectOwnedByUser(_ context.Context, projectID, userID string) error {
	if projectID == "project-denied" {
		return fmt.Errorf("%w: project access denied", ErrUnauthorized)
	}
	if userID == "" {
		return fmt.Errorf("%w: userId is required", ErrValidation)
	}
	return nil
}

func (allowVerifier) EnsureProjectInOrganization(_ context.Context, projectID string, organizationID int64) error {
	if projectID == "project-denied" {
		return fmt.Errorf("%w: project access denied", ErrUnauthorized)
	}
	if organizationID <= 0 {
		return fmt.Errorf("%w: organizationId is required", ErrValidation)
	}
	return nil
}

func TestRecordEventAndGetFunnel(t *testing.T) {
	repo := &testRepo{}
	svc := NewService(repo, allowVerifier{})
	ctx := context.Background()
	now := time.Now().UTC()

	inputs := []RecordEventInput{
		{ProjectID: "project-1", UserID: "user-1", Stage: StageVisit, Source: "chatgpt", Count: 120, OccurredAt: now.Add(-2 * time.Hour)},
		{ProjectID: "project-1", UserID: "user-1", Stage: StageSignup, Source: "chatgpt", Count: 30, OccurredAt: now.Add(-90 * time.Minute)},
		{ProjectID: "project-1", UserID: "user-1", Stage: StageTrial, Source: "chatgpt", Count: 10, OccurredAt: now.Add(-60 * time.Minute)},
		{ProjectID: "project-1", UserID: "user-1", Stage: StagePaid, Source: "chatgpt", Count: 4, RevenueCents: 500000, OccurredAt: now.Add(-30 * time.Minute)},
	}
	for _, input := range inputs {
		if _, err := svc.RecordEvent(ctx, input); err != nil {
			t.Fatalf("record event: %v", err)
		}
	}

	funnel, err := svc.GetFunnel(ctx, "project-1", "user-1", 0, now.Add(-24*time.Hour), now)
	if err != nil {
		t.Fatalf("get funnel: %v", err)
	}
	if funnel.Visits != 120 || funnel.Signups != 30 || funnel.Trials != 10 || funnel.Paid != 4 {
		t.Fatalf("unexpected funnel counts: %+v", funnel)
	}
	if funnel.RevenueCents != 500000 {
		t.Fatalf("expected revenue 500000, got %d", funnel.RevenueCents)
	}
	if funnel.VisitToSignupRate != 25 {
		t.Fatalf("expected visit->signup rate 25, got %d", funnel.VisitToSignupRate)
	}
}

func TestRecordEventRejectsInvalidStage(t *testing.T) {
	svc := NewService(&testRepo{}, allowVerifier{})
	_, err := svc.RecordEvent(context.Background(), RecordEventInput{
		ProjectID: "project-1",
		UserID:    "user-1",
		Stage:     "invalid",
		Source:    "chatgpt",
		Count:     1,
	})
	if err == nil {
		t.Fatalf("expected validation error")
	}
}

func TestGetFunnelRequiresAccess(t *testing.T) {
	svc := NewService(&testRepo{}, allowVerifier{})
	_, err := svc.GetFunnel(context.Background(), "project-denied", "user-1", 0, time.Time{}, time.Time{})
	if err == nil {
		t.Fatalf("expected access error")
	}
}

func TestRecordIngestionEvent(t *testing.T) {
	repo := &testRepo{}
	svc := NewService(repo, allowVerifier{})
	svc.projectResolver = staticProjectResolver{
		project: ProjectMetadata{
			ID: "project-1",
			Ingestion: ProjectIngestionIntegration{
				SigningToken: "iat_test",
			},
		},
	}

	event, err := svc.RecordIngestionEvent(context.Background(), RecordIngestionEventInput{
		ProjectID:    "project-1",
		SigningToken: "iat_test",
		Stage:        StageSignup,
		Source:       "chatgpt",
		Count:        1,
		OccurredAt:   time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("record ingestion event: %v", err)
	}
	if event.Stage != StageSignup {
		t.Fatalf("expected signup stage, got %s", event.Stage)
	}
}
