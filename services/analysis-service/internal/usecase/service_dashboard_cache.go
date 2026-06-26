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
	return filterDashboardForMonitoring(dashboard), true
}

func (s *Service) storeDashboardInCache(ctx context.Context, projectID string, organizationID int64, dashboard DashboardData) {
	if s.dashboardCache == nil || s.dashboardCacheTTL <= 0 {
		return
	}
	_ = s.dashboardCache.DeleteDashboard(ctx, projectID, organizationID)
	_ = s.dashboardCache.SetDashboard(ctx, projectID, organizationID, dashboard, s.dashboardCacheTTL)
}

func (s *Service) dashboardDataLocked(projectID string) DashboardData {
	dashboard := filterDashboardForMonitoring(s.projectDashboardDataLocked(projectID))
	ids := s.runsByProject[projectID]
	for i := len(ids) - 1; i >= 0; i-- {
		run := s.runs[ids[i]]
		if run == nil || !s.isMonitoringRunLocked(run) {
			continue
		}
		latest := copyAnalysisRun(run)
		dashboard.LatestRun = &latest
		break
	}
	return dashboard
}

func (s *Service) projectDashboardDataLocked(projectID string) DashboardData {
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

func filterDashboardForMonitoring(dashboard DashboardData) DashboardData {
	dashboard.PromptRuns = filterPromptRunsByKind(dashboard.PromptRuns, promptKindMonitoring)
	dashboard.Responses = filterResponsesByPromptKind(dashboard.Responses, promptKindMonitoring)
	if dashboard.LatestRun != nil && normalizePromptKind(dashboard.LatestRun.RunType) == promptKindPerception {
		dashboard.LatestRun = nil
	}
	dashboard.HasData = len(dashboard.PromptRuns) > 0 || len(dashboard.Responses) > 0
	dashboard.VisibilityScore = calculateVisibilityScoreFromResponses(dashboard.Responses)
	return dashboard
}

func (s *Service) isMonitoringRunLocked(run *AnalysisRun) bool {
	if run == nil || normalizePromptKind(run.RunType) == promptKindPerception {
		return false
	}
	return !s.runHasPromptKindLocked(run.ID, promptKindPerception)
}

func filterPromptRunsByKind(promptRuns []PromptRun, kind string) []PromptRun {
	out := make([]PromptRun, 0, len(promptRuns))
	for _, promptRun := range promptRuns {
		if normalizePromptKind(promptRun.Kind) != normalizePromptKind(kind) {
			continue
		}
		out = append(out, promptRun)
	}
	return out
}
