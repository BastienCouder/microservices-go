package usecase

import (
	"context"
	"errors"
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

type staticGeoTrafficProvider struct {
	report GeoTrafficReport
}

func (p staticGeoTrafficProvider) GetGeoTrafficReport(_ context.Context, project ProjectMetadata, from, to time.Time, _ GeoTrafficFilters) (GeoTrafficReport, error) {
	report := p.report
	report.ProjectID = project.ID
	report.PropertyID = project.GA4.PropertyID
	report.DateRange = GeoTrafficDateRange{
		StartDate: from.UTC().Format("2006-01-02"),
		EndDate:   to.UTC().Format("2006-01-02"),
	}
	return report, nil
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

type failingVerifier struct{}

func (failingVerifier) EnsureProjectOwnedByUser(_ context.Context, _, _ string) error {
	return errors.New("project grpc unavailable")
}

func (failingVerifier) EnsureProjectInOrganization(_ context.Context, _ string, _ int64) error {
	return errors.New("project grpc unavailable")
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

func TestGetGeoTrafficReportUsesConfiguredProjectGA4(t *testing.T) {
	svc := NewService(&testRepo{}, allowVerifier{})
	svc.projectResolver = staticProjectResolver{
		project: ProjectMetadata{
			ID:             "project-1",
			OrganizationID: 42,
			GA4: ProjectGA4Integration{
				PropertyID:         "123456789",
				ServiceAccountJSON: `{"client_email":"geo@example.iam.gserviceaccount.com","private_key":"key"}`,
			},
		},
	}
	svc.geoTrafficProvider = staticGeoTrafficProvider{
		report: GeoTrafficReport{
			Summary: GeoTrafficSummary{
				TotalGeoSessions:     28,
				TotalSessions:        400,
				GeoShareOfTotal:      7,
				GeoEngagedSessions:   21,
				GeoEngagementRate:    75,
				GeoConversions:       3,
				GeoConversionRate:    10.71,
				GeoAvgSessionSeconds: 94,
				GeoBounceRate:        25,
				GeoPageViews:         81,
				TopEngine:            "ChatGPT",
			},
			BySource: []GeoTrafficSource{
				{Source: "chatgpt.com", Medium: "referral", Engine: "ChatGPT", Sessions: 20},
				{Source: "gemini.google.com", Medium: "referral", Engine: "Gemini", Sessions: 8},
			},
		},
	}

	from := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 3, 31, 23, 59, 59, 0, time.UTC)
	report, err := svc.GetGeoTrafficReport(context.Background(), "project-1", "user-1", 42, from, to, GeoTrafficFilters{})
	if err != nil {
		t.Fatalf("get geo traffic report: %v", err)
	}

	if report.ProjectID != "project-1" || report.PropertyID != "123456789" {
		t.Fatalf("unexpected report identity: %+v", report)
	}
	if report.DateRange.StartDate != "2026-03-01" || report.DateRange.EndDate != "2026-03-31" {
		t.Fatalf("unexpected date range: %+v", report.DateRange)
	}
	if report.Summary.TotalGeoSessions != 28 || report.Summary.TopEngine != "ChatGPT" {
		t.Fatalf("unexpected summary: %+v", report.Summary)
	}
	if len(report.BySource) != 2 || report.BySource[0].Engine != "ChatGPT" {
		t.Fatalf("unexpected sources: %+v", report.BySource)
	}
}

func TestGetGeoTrafficReportUsesOAuthGA4Integration(t *testing.T) {
	svc := NewService(&testRepo{}, allowVerifier{})
	svc.projectResolver = staticProjectResolver{
		project: ProjectMetadata{
			ID:             "project-1",
			OrganizationID: 42,
			GA4: ProjectGA4Integration{
				PropertyID:        "123456789",
				OAuthRefreshToken: "refresh_token_123",
			},
		},
	}
	svc.geoTrafficProvider = staticGeoTrafficProvider{
		report: GeoTrafficReport{
			Summary: GeoTrafficSummary{TotalGeoSessions: 9},
		},
	}

	report, err := svc.GetGeoTrafficReport(
		context.Background(),
		"project-1",
		"user-1",
		42,
		time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 3, 31, 0, 0, 0, 0, time.UTC),
		GeoTrafficFilters{},
	)
	if err != nil {
		t.Fatalf("get oauth ga4 traffic report: %v", err)
	}
	if report.Summary.TotalGeoSessions != 9 {
		t.Fatalf("unexpected report: %+v", report)
	}
}

func TestGetGeoTrafficReportRequiresGA4Integration(t *testing.T) {
	svc := NewService(&testRepo{}, allowVerifier{})
	svc.projectResolver = staticProjectResolver{
		project: ProjectMetadata{ID: "project-1", OrganizationID: 42},
	}
	svc.geoTrafficProvider = staticGeoTrafficProvider{}

	_, err := svc.GetGeoTrafficReport(context.Background(), "project-1", "user-1", 42, time.Time{}, time.Time{}, GeoTrafficFilters{})
	if err == nil {
		t.Fatalf("expected validation error")
	}
}

func TestGetGeoTrafficReportUsesProjectResolverWhenProjectVerifierIsUnavailable(t *testing.T) {
	svc := NewService(&testRepo{}, failingVerifier{})
	svc.projectResolver = staticProjectResolver{
		project: ProjectMetadata{
			ID:             "project-1",
			OrganizationID: 42,
			GA4: ProjectGA4Integration{
				PropertyID:        "123456789",
				OAuthRefreshToken: "refresh-token",
			},
		},
	}
	svc.geoTrafficProvider = staticGeoTrafficProvider{
		report: GeoTrafficReport{
			Summary: GeoTrafficSummary{TotalGeoSessions: 7},
		},
	}

	report, err := svc.GetGeoTrafficReport(context.Background(), "project-1", "user-1", 42, time.Time{}, time.Time{}, GeoTrafficFilters{})
	if err != nil {
		t.Fatalf("expected geo report to use project resolver, got %v", err)
	}
	if report.Summary.TotalGeoSessions != 7 {
		t.Fatalf("unexpected report: %+v", report)
	}
}
