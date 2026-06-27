package usecase

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

func NewService(projectResolver ProjectMetadataResolver, trafficProvider TrafficProvider) *Service {
	return &Service{
		projectResolver: projectResolver,
		trafficProvider: trafficProvider,
		now:             time.Now,
	}
}

func (s *Service) GetTrafficReport(
	ctx context.Context,
	projectID string,
	organizationID int64,
	from time.Time,
	to time.Time,
	filters TrafficFilters,
) (TrafficReport, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return TrafficReport{}, fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if organizationID <= 0 {
		return TrafficReport{}, fmt.Errorf("%w: organizationId is required", ErrValidation)
	}
	if s.projectResolver == nil || s.trafficProvider == nil {
		return TrafficReport{}, fmt.Errorf("%w: traffic provider is not configured", ErrValidation)
	}

	windowFrom, windowTo, err := normalizeWindow(from, to, s.now)
	if err != nil {
		return TrafficReport{}, err
	}

	project, err := s.projectResolver.GetProject(ctx, projectID, organizationID)
	if err != nil {
		if errors.Is(err, ErrValidation) || errors.Is(err, ErrUnauthorized) || errors.Is(err, ErrNotFound) {
			return TrafficReport{}, err
		}
		return TrafficReport{}, fmt.Errorf("%w: project metadata unavailable: %v", ErrDependencyUnavailable, err)
	}
	propertyID := strings.TrimSpace(project.GA4.PropertyID)
	isSeedTraffic := propertyID == SeedTrafficPropertyID
	if propertyID == "" ||
		(!isSeedTraffic && strings.TrimSpace(project.GA4.ServiceAccountJSON) == "" && strings.TrimSpace(project.GA4.OAuthRefreshToken) == "") {
		return TrafficReport{}, fmt.Errorf("%w: ga4 integration is not configured for project", ErrValidation)
	}

	filters.Search = strings.TrimSpace(filters.Search)
	filters.Engine = strings.TrimSpace(filters.Engine)
	report, err := s.trafficProvider.GetTrafficReport(ctx, project, windowFrom, windowTo, filters)
	if err != nil {
		return TrafficReport{}, fmt.Errorf("%w: traffic unavailable: %v", ErrDependencyUnavailable, err)
	}
	if strings.TrimSpace(report.ProjectID) == "" {
		report.ProjectID = projectID
	}
	if strings.TrimSpace(report.PropertyID) == "" {
		report.PropertyID = strings.TrimSpace(project.GA4.PropertyID)
	}
	if report.DateRange.StartDate == "" {
		report.DateRange.StartDate = windowFrom.UTC().Format("2006-01-02")
	}
	if report.DateRange.EndDate == "" {
		report.DateRange.EndDate = windowTo.UTC().Format("2006-01-02")
	}
	if strings.TrimSpace(report.GeneratedAt) == "" {
		report.GeneratedAt = s.now().UTC().Format(time.RFC3339)
	}
	return report, nil
}
