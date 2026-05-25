package http

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/bastiencouder/microservices-go/services/attribution-service/internal/usecase"
)

type handlerTestRepo struct{}

func (handlerTestRepo) InsertEvent(_ context.Context, event usecase.Event) (usecase.Event, error) {
	return event, nil
}

func (handlerTestRepo) ListEvents(_ context.Context, _ string, _, _ time.Time, _ int) ([]usecase.Event, error) {
	return nil, nil
}

func (handlerTestRepo) GetFunnelTotals(_ context.Context, _ string, _, _ time.Time) (usecase.FunnelTotals, error) {
	return usecase.FunnelTotals{}, nil
}

func (handlerTestRepo) GetSourceTotals(_ context.Context, _ string, _, _ time.Time) ([]usecase.FunnelSource, error) {
	return nil, nil
}

type handlerAllowVerifier struct{}

func (handlerAllowVerifier) EnsureProjectOwnedByUser(_ context.Context, _, _ string) error {
	return nil
}

func (handlerAllowVerifier) EnsureProjectInOrganization(_ context.Context, _ string, _ int64) error {
	return nil
}

type handlerProjectResolver struct{}

func (handlerProjectResolver) GetProject(_ context.Context, projectID string, organizationID int64) (usecase.ProjectMetadata, error) {
	return usecase.ProjectMetadata{
		ID:             projectID,
		OrganizationID: organizationID,
		GA4: usecase.ProjectGA4Integration{
			PropertyID:         "123456789",
			ServiceAccountJSON: `{"client_email":"traffic@example.iam.gserviceaccount.com","private_key":"key"}`,
		},
	}, nil
}

type handlerTrafficProvider struct{}

func (handlerTrafficProvider) GetTrafficReport(_ context.Context, project usecase.ProjectMetadata, from, to time.Time, _ usecase.TrafficFilters) (usecase.TrafficReport, error) {
	return usecase.TrafficReport{
		ProjectID:  project.ID,
		PropertyID: project.GA4.PropertyID,
		DateRange: usecase.TrafficDateRange{
			StartDate: from.UTC().Format("2006-01-02"),
			EndDate:   to.UTC().Format("2006-01-02"),
		},
		Summary: usecase.TrafficSummary{
			TotalTrafficSessions: 12,
			TotalSessions:        120,
			TrafficShareOfTotal:  10,
			TopEngine:            "ChatGPT",
		},
		BySource: []usecase.TrafficSource{
			{Source: "chatgpt.com", Engine: "ChatGPT", Sessions: 12},
		},
	}, nil
}

type handlerFailingTrafficProvider struct{}

func (handlerFailingTrafficProvider) GetTrafficReport(_ context.Context, _ usecase.ProjectMetadata, _, _ time.Time, _ usecase.TrafficFilters) (usecase.TrafficReport, error) {
	return usecase.TrafficReport{}, errors.New("ga4 runReport error (403): missing permission")
}

func TestGetTrafficReportRoute(t *testing.T) {
	svc := usecase.NewService(handlerTestRepo{}, handlerAllowVerifier{})
	svc.EnableTrafficProvider(handlerProjectResolver{}, handlerTrafficProvider{})
	handler := NewHandler(svc)
	mux := http.NewServeMux()
	handler.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/attribution/projects/project-1/traffic?from=2026-03-01T00:00:00Z&to=2026-03-31T23:59:59Z", nil)
	req.Header.Set("X-Authenticated-User-ID", "user-1")
	req.Header.Set("X-Organization-ID", "42")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var response struct {
		Success bool `json:"success"`
		Data    struct {
			ProjectID string                 `json:"projectId"`
			Summary   usecase.TrafficSummary `json:"summary"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !response.Success || response.Data.ProjectID != "project-1" {
		t.Fatalf("unexpected response: %+v", response)
	}
	if response.Data.Summary.TotalTrafficSessions != 12 {
		t.Fatalf("unexpected summary: %+v", response.Data.Summary)
	}
}

func TestGetTrafficReportRouteReturnsUserFriendlyGA4DependencyError(t *testing.T) {
	svc := usecase.NewService(handlerTestRepo{}, handlerAllowVerifier{})
	svc.EnableTrafficProvider(handlerProjectResolver{}, handlerFailingTrafficProvider{})
	handler := NewHandler(svc)
	mux := http.NewServeMux()
	handler.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/attribution/projects/project-1/traffic?from=2026-03-01T00:00:00Z&to=2026-03-31T23:59:59Z", nil)
	req.Header.Set("X-Authenticated-User-ID", "user-1")
	req.Header.Set("X-Organization-ID", "42")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "Google Analytics") {
		t.Fatalf("expected user friendly GA4 error, got %s", rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), "runReport") || strings.Contains(rec.Body.String(), "missing permission") {
		t.Fatalf("expected response to hide GA4 dependency details, got %s", rec.Body.String())
	}
}

func TestUserFacingDependencyErrorMentionsDisabledAnalyticsDataAPI(t *testing.T) {
	err := fmt.Errorf(
		"%w: ga4 traffic unavailable: ga4 runReport error (403): Google Analytics Data API has not been used before or it is disabled. reason: SERVICE_DISABLED service: analyticsdata.googleapis.com",
		usecase.ErrDependencyUnavailable,
	)

	message := userFacingDependencyError(err)

	if !strings.Contains(message, "Google Analytics Data API") {
		t.Fatalf("expected disabled Analytics Data API guidance, got %q", message)
	}
	if !strings.Contains(message, "Active") {
		t.Fatalf("expected activation guidance, got %q", message)
	}
}

func TestGetTrafficReportCompatibilityRoute(t *testing.T) {
	svc := usecase.NewService(handlerTestRepo{}, handlerAllowVerifier{})
	svc.EnableTrafficProvider(handlerProjectResolver{}, handlerTrafficProvider{})
	handler := NewHandler(svc)
	mux := http.NewServeMux()
	handler.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/attribution/projects/project-1/traffic?from=2026-03-01T00:00:00Z&to=2026-03-31T23:59:59Z", nil)
	req.Header.Set("X-Authenticated-User-ID", "user-1")
	req.Header.Set("X-Organization-ID", "42")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected traffic compatibility route to return 200, got %d: %s", rec.Code, rec.Body.String())
	}
}
