package usecase

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"
)

func NewService(repo Repository, projectVerifier ProjectAccessVerifier) *Service {
	return &Service{repo: repo, projectVerifier: projectVerifier, now: time.Now}
}

func (s *Service) EnableVisitProvider(projectResolver ProjectMetadataResolver, visitProvider VisitProvider) {
	s.projectResolver = projectResolver
	s.visitProvider = visitProvider
}

func (s *Service) EnableTrafficProvider(projectResolver ProjectMetadataResolver, trafficProvider TrafficProvider) {
	s.projectResolver = projectResolver
	s.trafficProvider = trafficProvider
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

	return s.recordValidatedEvent(ctx, projectID, input.Stage, input.Source, input.Count, input.RevenueCents, input.OccurredAt)
}

func (s *Service) RecordInternalEvent(ctx context.Context, input RecordInternalEventInput) (Event, error) {
	projectID := strings.TrimSpace(input.ProjectID)
	if projectID == "" || input.OrganizationID <= 0 {
		return Event{}, fmt.Errorf("%w: projectId and organizationId are required", ErrValidation)
	}
	if err := s.ensureProjectOrganizationAccess(ctx, projectID, input.OrganizationID); err != nil {
		return Event{}, err
	}

	return s.recordValidatedEvent(ctx, projectID, input.Stage, input.Source, input.Count, input.RevenueCents, input.OccurredAt)
}

func (s *Service) recordValidatedEvent(
	ctx context.Context,
	projectID string,
	stageValue string,
	sourceValue string,
	count int64,
	revenueCents int64,
	occurredAt time.Time,
) (Event, error) {
	stage := normalizeStage(stageValue)
	if stage == "" {
		return Event{}, fmt.Errorf("%w: stage must be visit, signup, trial or paid", ErrValidation)
	}
	source := strings.ToLower(strings.TrimSpace(sourceValue))
	if source == "" {
		source = "unknown"
	}
	if count <= 0 {
		return Event{}, fmt.Errorf("%w: count must be a positive integer", ErrValidation)
	}
	if revenueCents < 0 {
		return Event{}, fmt.Errorf("%w: revenueCents cannot be negative", ErrValidation)
	}
	if stage != StagePaid {
		revenueCents = 0
	}

	if occurredAt.IsZero() {
		occurredAt = s.now().UTC()
	} else {
		occurredAt = occurredAt.UTC()
	}

	created, err := s.repo.InsertEvent(ctx, Event{
		ProjectID:    projectID,
		Stage:        stage,
		Source:       source,
		Count:        count,
		RevenueCents: revenueCents,
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

func (s *Service) GetFunnel(
	ctx context.Context,
	projectID,
	userID string,
	organizationID int64,
	from,
	to time.Time,
) (FunnelData, error) {
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
	sources, err := s.repo.GetSourceTotals(ctx, projectID, windowFrom, windowTo)
	if err != nil {
		return FunnelData{}, err
	}

	visitsSource := "events"
	if organizationID > 0 && s.projectResolver != nil && s.visitProvider != nil {
		project, projectErr := s.projectResolver.GetProject(ctx, projectID, organizationID)
		if projectErr == nil {
			visitSources, visitErr := s.visitProvider.ListVisitsBySource(ctx, project, windowFrom, windowTo)
			if visitErr == nil {
				sources = mergeVisitSources(sources, visitSources)
				totals.Visits = sumSourceVisits(sources)
				visitsSource = "ga4"
			}
		}
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
		Sources:           sources,
		VisitsSource:      visitsSource,
	}, nil
}

func (s *Service) GetTrafficReport(
	ctx context.Context,
	projectID,
	userID string,
	organizationID int64,
	from,
	to time.Time,
	filters TrafficFilters,
) (TrafficReport, error) {
	projectID = strings.TrimSpace(projectID)
	userID = strings.TrimSpace(userID)
	if projectID == "" || userID == "" {
		return TrafficReport{}, fmt.Errorf("%w: projectId and userId are required", ErrValidation)
	}
	if organizationID <= 0 {
		return TrafficReport{}, fmt.Errorf("%w: organizationId is required", ErrValidation)
	}
	if s.projectResolver == nil || s.trafficProvider == nil {
		return TrafficReport{}, fmt.Errorf("%w: ga4 traffic provider is not configured", ErrValidation)
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
	if strings.TrimSpace(project.GA4.PropertyID) == "" ||
		(strings.TrimSpace(project.GA4.ServiceAccountJSON) == "" && strings.TrimSpace(project.GA4.OAuthRefreshToken) == "") {
		return TrafficReport{}, fmt.Errorf("%w: ga4 integration is not configured for project", ErrValidation)
	}

	filters.Search = strings.TrimSpace(filters.Search)
	filters.Engine = strings.TrimSpace(filters.Engine)
	report, err := s.trafficProvider.GetTrafficReport(ctx, project, windowFrom, windowTo, filters)
	if err != nil {
		return TrafficReport{}, fmt.Errorf("%w: ga4 traffic unavailable: %v", ErrDependencyUnavailable, err)
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

func mergeVisitSources(base, visits []FunnelSource) []FunnelSource {
	merged := make(map[string]FunnelSource, len(base)+len(visits))
	for _, item := range base {
		key := strings.TrimSpace(item.Source)
		if key == "" {
			continue
		}
		item.Visits = 0
		merged[key] = item
	}
	for _, item := range visits {
		key := strings.TrimSpace(item.Source)
		if key == "" {
			continue
		}
		current := merged[key]
		current.Source = key
		current.Visits = item.Visits
		merged[key] = current
	}
	out := make([]FunnelSource, 0, len(merged))
	for _, item := range merged {
		out = append(out, item)
	}
	sort.Slice(out, func(i, j int) bool {
		left := out[i].Visits + out[i].Signups + out[i].Trials + out[i].Paid
		right := out[j].Visits + out[j].Signups + out[j].Trials + out[j].Paid
		if left == right {
			return out[i].Source < out[j].Source
		}
		return left > right
	})
	return out
}

func sumSourceVisits(items []FunnelSource) int64 {
	var total int64
	for _, item := range items {
		total += item.Visits
	}
	return total
}
