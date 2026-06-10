package http

import (
	"context"
	"encoding/json"
	"errors"
	stdhttp "net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bastiencouder/microservices-go/services/attribution-service/internal/usecase"
)

type handlerProjectResolver struct{}

func (handlerProjectResolver) GetProject(_ context.Context, projectID string, organizationID int64) (usecase.ProjectMetadata, error) {
	return usecase.ProjectMetadata{
		ID:             projectID,
		OrganizationID: organizationID,
		GA4: usecase.ProjectGA4Integration{
			PropertyID:        "123",
			OAuthRefreshToken: "refresh-token",
		},
	}, nil
}

type handlerTrafficProvider struct{}

func (handlerTrafficProvider) GetTrafficReport(_ context.Context, project usecase.ProjectMetadata, from, to time.Time, filters usecase.TrafficFilters) (usecase.TrafficReport, error) {
	return usecase.TrafficReport{
		ProjectID:  project.ID,
		PropertyID: project.GA4.PropertyID,
		DataSource: usecase.TrafficDataSourceGA4,
		DateRange: usecase.TrafficDateRange{
			StartDate: from.Format("2006-01-02"),
			EndDate:   to.Format("2006-01-02"),
		},
		Summary: usecase.TrafficSummary{
			TotalTrafficSessions: 7,
			TopEngine:            filters.Engine,
		},
	}, nil
}

func TestHandlerGetTrafficReportWritesSuccessEnvelope(t *testing.T) {
	svc := usecase.NewService(handlerProjectResolver{}, handlerTrafficProvider{})
	mux := stdhttp.NewServeMux()
	NewHandler(svc).Register(mux)

	req := httptest.NewRequest(stdhttp.MethodGet, "/attribution/projects/project-1/traffic?from=2026-06-01T00:00:00Z&to=2026-06-08T00:00:00Z&engine=ChatGPT", nil)
	req.Header.Set("X-Organization-ID", "42")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != stdhttp.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var envelope struct {
		Success bool `json:"success"`
		Data    struct {
			ProjectID string `json:"projectId"`
			Summary   struct {
				TotalTrafficSessions int64  `json:"totalTrafficSessions"`
				TopEngine            string `json:"topEngine"`
			} `json:"summary"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !envelope.Success || envelope.Data.ProjectID != "project-1" {
		t.Fatalf("unexpected response envelope: %#v", envelope)
	}
	if envelope.Data.Summary.TotalTrafficSessions != 7 || envelope.Data.Summary.TopEngine != "ChatGPT" {
		t.Fatalf("unexpected summary: %#v", envelope.Data.Summary)
	}
}

func TestHandlerGetTrafficReportRequiresOrganizationHeader(t *testing.T) {
	svc := usecase.NewService(handlerProjectResolver{}, handlerTrafficProvider{})
	mux := stdhttp.NewServeMux()
	NewHandler(svc).Register(mux)

	req := httptest.NewRequest(stdhttp.MethodGet, "/attribution/projects/project-1/traffic", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != stdhttp.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestHandlerReadyUsesDependencyCheck(t *testing.T) {
	svc := usecase.NewService(handlerProjectResolver{}, handlerTrafficProvider{})
	mux := stdhttp.NewServeMux()
	NewHandler(svc, func(context.Context) error {
		return errors.New("project grpc down")
	}).Register(mux)

	req := httptest.NewRequest(stdhttp.MethodGet, "/ready", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	if rec.Code != stdhttp.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rec.Code)
	}
}
