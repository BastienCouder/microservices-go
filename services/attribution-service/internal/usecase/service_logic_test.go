package usecase

import (
	"context"
	"errors"
	"testing"
	"time"
)

type fakeProjectResolver struct {
	project ProjectMetadata
	err     error
	calls   int
}

func (f *fakeProjectResolver) GetProject(_ context.Context, projectID string, organizationID int64) (ProjectMetadata, error) {
	f.calls++
	if f.err != nil {
		return ProjectMetadata{}, f.err
	}
	project := f.project
	project.ID = projectID
	project.OrganizationID = organizationID
	return project, nil
}

type fakeTrafficProvider struct {
	report TrafficReport
	err    error
	from   time.Time
	to     time.Time
	filter TrafficFilters
	calls  int
}

func (f *fakeTrafficProvider) GetTrafficReport(_ context.Context, _ ProjectMetadata, from, to time.Time, filters TrafficFilters) (TrafficReport, error) {
	f.calls++
	f.from = from
	f.to = to
	f.filter = filters
	if f.err != nil {
		return TrafficReport{}, f.err
	}
	return f.report, nil
}

func TestGetTrafficReportNormalizesWindowAndFillsDefaults(t *testing.T) {
	now := time.Date(2026, 6, 8, 12, 0, 0, 0, time.UTC)
	resolver := &fakeProjectResolver{
		project: ProjectMetadata{
			GA4: ProjectGA4Integration{
				PropertyID:         " properties/123 ",
				ServiceAccountJSON: "{}",
			},
		},
	}
	provider := &fakeTrafficProvider{
		report: TrafficReport{
			DataSource: TrafficDataSourceGA4,
			Summary: TrafficSummary{
				TotalTrafficSessions: 12,
			},
		},
	}
	svc := NewService(resolver, provider)
	svc.now = func() time.Time { return now }

	report, err := svc.GetTrafficReport(
		context.Background(),
		" project-1 ",
		42,
		time.Time{},
		time.Time{},
		TrafficFilters{Search: " pricing ", Engine: " ChatGPT "},
	)
	if err != nil {
		t.Fatalf("expected traffic report, got error: %v", err)
	}

	if resolver.calls != 1 || provider.calls != 1 {
		t.Fatalf("expected one resolver/provider call, got resolver=%d provider=%d", resolver.calls, provider.calls)
	}
	if report.ProjectID != "project-1" {
		t.Fatalf("expected project id fallback, got %q", report.ProjectID)
	}
	if report.PropertyID != "properties/123" {
		t.Fatalf("expected property id fallback, got %q", report.PropertyID)
	}
	if report.DateRange.StartDate != "2026-05-09" || report.DateRange.EndDate != "2026-06-08" {
		t.Fatalf("expected default 30-day window, got %#v", report.DateRange)
	}
	if report.GeneratedAt != "2026-06-08T12:00:00Z" {
		t.Fatalf("expected generatedAt fallback, got %q", report.GeneratedAt)
	}
	if provider.filter.Search != "pricing" || provider.filter.Engine != "ChatGPT" {
		t.Fatalf("expected trimmed filters, got %#v", provider.filter)
	}
}

func TestGetTrafficReportRequiresConfiguredGA4Integration(t *testing.T) {
	svc := NewService(&fakeProjectResolver{project: ProjectMetadata{}}, &fakeTrafficProvider{})

	_, err := svc.GetTrafficReport(context.Background(), "project-1", 42, time.Time{}, time.Time{}, TrafficFilters{})
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected validation error, got %v", err)
	}
}

func TestGetTrafficReportWrapsProviderFailureAsDependencyUnavailable(t *testing.T) {
	resolver := &fakeProjectResolver{
		project: ProjectMetadata{
			GA4: ProjectGA4Integration{
				PropertyID:        "123",
				OAuthRefreshToken: "refresh-token",
			},
		},
	}
	provider := &fakeTrafficProvider{err: errors.New("ga4 down")}
	svc := NewService(resolver, provider)

	_, err := svc.GetTrafficReport(context.Background(), "project-1", 42, time.Time{}, time.Time{}, TrafficFilters{})
	if !errors.Is(err, ErrDependencyUnavailable) {
		t.Fatalf("expected dependency unavailable, got %v", err)
	}
}
