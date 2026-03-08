package usecase

import "context"

func (s *Service) loadDashboardFromCache(ctx context.Context, projectID string, organizationID int64) (DashboardData, bool) {
	if s.dashboardCache == nil || s.dashboardCacheTTL <= 0 {
		return DashboardData{}, false
	}

	dashboard, ok, err := s.dashboardCache.GetDashboard(ctx, projectID, organizationID)
	if err != nil || !ok {
		return DashboardData{}, false
	}
	return dashboard, true
}

func (s *Service) storeDashboardInCache(ctx context.Context, projectID string, organizationID int64, dashboard DashboardData) {
	if s.dashboardCache == nil || s.dashboardCacheTTL <= 0 {
		return
	}
	_ = s.dashboardCache.DeleteDashboard(ctx, projectID, organizationID)
	_ = s.dashboardCache.SetDashboard(ctx, projectID, organizationID, dashboard, s.dashboardCacheTTL)
}

func (s *Service) deleteDashboardFromCache(ctx context.Context, projectID string, organizationID int64) {
	if s.dashboardCache == nil {
		return
	}
	_ = s.dashboardCache.DeleteDashboard(ctx, projectID, organizationID)
}

func (s *Service) dashboardDataLocked(projectID string) DashboardData {
	ids := s.runsByProject[projectID]
	if len(ids) == 0 {
		return DashboardData{HasData: false, VisibilityScore: 0, PromptRuns: []PromptRun{}, Responses: []AIResponse{}}
	}

	latestID := ids[len(ids)-1]
	run := s.runs[latestID]
	if run == nil {
		return DashboardData{HasData: false, VisibilityScore: 0, PromptRuns: []PromptRun{}, Responses: []AIResponse{}}
	}
	latest := copyAnalysisRun(run)
	promptRuns := s.promptRunsForProjectLocked(projectID)
	responses := s.responsesForProjectLocked(projectID)

	return DashboardData{
		HasData:         len(promptRuns) > 0 || len(responses) > 0,
		LatestRun:       &latest,
		VisibilityScore: calculateVisibilityScoreFromResponses(responses),
		PromptRuns:      promptRuns,
		Responses:       responses,
	}
}
