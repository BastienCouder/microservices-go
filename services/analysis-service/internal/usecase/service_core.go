package usecase

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

func NewService() *Service {
	return &Service{
		now:                 time.Now,
		runs:                make(map[string]*AnalysisRun),
		runsByProject:       make(map[string][]string),
		promptRuns:          make(map[string]*PromptRun),
		promptRunsByRun:     make(map[string][]string),
		responses:           make(map[string]*AIResponse),
		responsesByRun:      make(map[string][]string),
		responseIndexByRun:  make(map[string]map[string]string),
		runByRequest:        make(map[string]string),
		brandCanonByProject: make(map[string]*BrandCanon),
		contentCrawls:       make(map[string]*ContentOptimizerCrawlSnapshot),
		contentSelections:   make(map[string]*ContentOptimizerSelectionDraft),
		optimizeActions:     make(map[string]*OptimizeAction),
		actionsByProject:    make(map[string][]string),
		aiBriefSettings:     make(map[string]*ProjectAIBriefSettings),
	}
}

func NewServiceWithDependencies(ctx context.Context, deps Dependencies) (*Service, error) {
	svc := NewService()
	svc.store = deps.Store
	svc.dashboardCache = deps.DashboardCache
	svc.dashboardCacheTTL = deps.DashboardCacheTTL
	svc.projectVerifier = deps.ProjectVerifier
	svc.projectCompetitors = deps.ProjectCompetitors
	svc.projectModels = deps.ProjectModels
	svc.billingQuota = deps.BillingQuota
	svc.contentCrawler = deps.ContentCrawler
	svc.contentIssueAnalyzer = deps.ContentIssueAnalyzer
	svc.optimizeActionBriefGenerator = deps.OptimizeActionBriefGenerator
	svc.onboardingBrandProfileAnalyzer = deps.OnboardingBrandProfileAnalyzer
	if deps.Store != nil {
		if err := svc.load(ctx); err != nil {
			return nil, err
		}
	}
	return svc, nil
}

func (s *Service) load(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.reloadLocked(ctx)
}

func (s *Service) reloadLocked(ctx context.Context) error {
	if s.store == nil {
		return nil
	}

	payload, ok, err := s.store.Load(ctx)
	if err != nil {
		return fmt.Errorf("load analysis state: %w", err)
	}
	if !ok {
		return s.persistLocked(ctx)
	}

	var state persistedState
	if err := json.Unmarshal(payload, &state); err != nil {
		return fmt.Errorf("decode analysis state: %w", err)
	}
	s.restoreLocked(&state)
	return nil
}

func (s *Service) snapshotLocked() *persistedState {
	state := &persistedState{
		Seq:                 s.seq,
		Runs:                make(map[string]*AnalysisRun, len(s.runs)),
		RunsByProject:       make(map[string][]string, len(s.runsByProject)),
		PromptRuns:          make(map[string]*PromptRun, len(s.promptRuns)),
		PromptRunsByRun:     make(map[string][]string, len(s.promptRunsByRun)),
		Responses:           make(map[string]*AIResponse, len(s.responses)),
		ResponsesByRun:      make(map[string][]string, len(s.responsesByRun)),
		ResponseIndexByRun:  make(map[string]map[string]string, len(s.responseIndexByRun)),
		RunByRequest:        make(map[string]string, len(s.runByRequest)),
		BrandCanonByProject: make(map[string]*BrandCanon, len(s.brandCanonByProject)),
		ContentCrawls:       make(map[string]*ContentOptimizerCrawlSnapshot, len(s.contentCrawls)),
		ContentSelections:   make(map[string]*ContentOptimizerSelectionDraft, len(s.contentSelections)),
		OptimizeActions:     make(map[string]*OptimizeAction, len(s.optimizeActions)),
		ActionsByProject:    make(map[string][]string, len(s.actionsByProject)),
		AIBriefSettings:     make(map[string]*ProjectAIBriefSettings, len(s.aiBriefSettings)),
	}

	for key, value := range s.runs {
		clone := *value
		state.Runs[key] = &clone
	}
	for key, ids := range s.runsByProject {
		state.RunsByProject[key] = append([]string(nil), ids...)
	}
	for key, value := range s.promptRuns {
		clone := *value
		state.PromptRuns[key] = &clone
	}
	for key, ids := range s.promptRunsByRun {
		state.PromptRunsByRun[key] = append([]string(nil), ids...)
	}
	for key, value := range s.responses {
		clone := copyResponse(value)
		state.Responses[key] = &clone
	}
	for key, ids := range s.responsesByRun {
		state.ResponsesByRun[key] = append([]string(nil), ids...)
	}
	for runID, indexByKey := range s.responseIndexByRun {
		cloned := make(map[string]string, len(indexByKey))
		for key, responseID := range indexByKey {
			cloned[key] = responseID
		}
		state.ResponseIndexByRun[runID] = cloned
	}
	for key, runID := range s.runByRequest {
		state.RunByRequest[key] = runID
	}
	for key, value := range s.brandCanonByProject {
		clone := copyBrandCanon(value)
		state.BrandCanonByProject[key] = &clone
	}
	for key, value := range s.contentCrawls {
		clone := copyContentOptimizerCrawlSnapshot(value)
		state.ContentCrawls[key] = &clone
	}
	for key, value := range s.contentSelections {
		clone := copyContentOptimizerSelectionDraft(value)
		state.ContentSelections[key] = &clone
	}
	for key, value := range s.optimizeActions {
		clone := copyOptimizeAction(value)
		state.OptimizeActions[key] = &clone
	}
	for key, ids := range s.actionsByProject {
		state.ActionsByProject[key] = append([]string(nil), ids...)
	}
	for key, value := range s.aiBriefSettings {
		clone := copyProjectAIBriefSettings(value)
		state.AIBriefSettings[key] = &clone
	}

	return state
}

func (s *Service) restoreLocked(state *persistedState) {
	if state == nil {
		state = &persistedState{}
	}
	s.seq = state.Seq
	s.runs = nonNilRunMap(state.Runs)
	s.runsByProject = nonNilSliceMap(state.RunsByProject)
	s.promptRuns = nonNilPromptRunMap(state.PromptRuns)
	s.promptRunsByRun = nonNilSliceMap(state.PromptRunsByRun)
	s.responses = nonNilResponseMap(state.Responses)
	s.responsesByRun = nonNilSliceMap(state.ResponsesByRun)
	s.responseIndexByRun = nonNilIndexMap(state.ResponseIndexByRun)
	s.runByRequest = nonNilRunByRequestMap(state.RunByRequest)
	s.brandCanonByProject = nonNilBrandCanonMap(state.BrandCanonByProject)
	s.contentCrawls = nonNilContentOptimizerCrawlMap(state.ContentCrawls)
	s.contentSelections = nonNilContentOptimizerSelectionMap(state.ContentSelections)
	s.optimizeActions = nonNilOptimizeActionMap(state.OptimizeActions)
	s.actionsByProject = nonNilSliceMap(state.ActionsByProject)
	s.aiBriefSettings = nonNilAIBriefSettingsMap(state.AIBriefSettings)
}

func (s *Service) persistLocked(ctx context.Context) error {
	if s.store == nil {
		return nil
	}
	payload, err := json.Marshal(s.snapshotLocked())
	if err != nil {
		return fmt.Errorf("encode analysis state: %w", err)
	}
	if err := s.store.Save(ctx, payload); err != nil {
		return fmt.Errorf("persist analysis state: %w", err)
	}
	return nil
}

func (s *Service) verifyProjectAccess(ctx context.Context, projectID string, organizationID int64) error {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if organizationID <= 0 {
		return fmt.Errorf("%w: organizationId must be positive", ErrValidation)
	}
	if s.projectVerifier == nil {
		return nil
	}
	if err := s.projectVerifier.EnsureProjectAccessible(ctx, projectID, organizationID); err != nil {
		return err
	}
	return nil
}

func (s *Service) listProjectCompetitors(ctx context.Context, projectID string, organizationID int64) ([]string, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return nil, fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if organizationID <= 0 {
		return nil, fmt.Errorf("%w: organizationId must be positive", ErrValidation)
	}
	if s.projectCompetitors == nil {
		return nil, nil
	}

	competitors, err := s.projectCompetitors.ListProjectCompetitors(ctx, projectID, organizationID)
	if err != nil {
		return nil, err
	}

	normalized := make([]string, 0, len(competitors))
	seen := make(map[string]struct{}, len(competitors))
	for _, competitor := range competitors {
		name := strings.TrimSpace(competitor)
		if name == "" {
			continue
		}
		key := strings.ToLower(name)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		normalized = append(normalized, name)
	}

	return normalized, nil
}

func (s *Service) listProjectEnabledModels(ctx context.Context, projectID string, organizationID int64) ([]string, bool, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return nil, false, fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if organizationID <= 0 {
		return nil, false, fmt.Errorf("%w: organizationId must be positive", ErrValidation)
	}
	if s.projectModels == nil {
		return nil, false, nil
	}

	modelIDs, err := s.projectModels.ListProjectEnabledModels(ctx, projectID, organizationID)
	if err != nil {
		return nil, false, err
	}

	normalized := make([]string, 0, len(modelIDs))
	seen := make(map[string]struct{}, len(modelIDs))
	for _, modelID := range modelIDs {
		value := strings.TrimSpace(modelID)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}

	return normalized, true, nil
}

func isSameUTCMonth(left, right time.Time) bool {
	leftUTC := left.UTC()
	rightUTC := right.UTC()
	return leftUTC.Year() == rightUTC.Year() && leftUTC.Month() == rightUTC.Month()
}

func (s *Service) currentMonthlyPromptUsageLocked(organizationID int64, now time.Time) int {
	return s.currentMonthlyCreditUsageLocked(organizationID, now)
}

func (s *Service) currentMonthlyCreditUsageLocked(organizationID int64, now time.Time) int {
	total := 0
	for _, run := range s.runs {
		if run == nil || run.OrganizationID != organizationID {
			continue
		}
		if !isSameUTCMonth(run.CreatedAt, now) {
			continue
		}
		total += runCreditCount(run)
	}
	return total
}

func (s *Service) currentMonthlyReservedCreditUsageLocked(organizationID int64, now time.Time) int {
	total := 0
	for _, run := range s.runs {
		if run == nil || run.OrganizationID != organizationID {
			continue
		}
		if !isSameUTCMonth(run.CreatedAt, now) {
			continue
		}
		total += runReservedCreditCount(run)
	}
	return total
}

func runCreditCount(run *AnalysisRun) int {
	if run == nil {
		return 0
	}
	switch strings.ToLower(strings.TrimSpace(run.Status)) {
	case "failed", "errored", "cancelled", "cancelled_due_to_timeout", "cancelled_due_to_limits", "cancelled_by_user":
		return 0
	}
	if run.ExpectedResponses > 0 {
		if run.CompletedResponses <= 0 {
			return 0
		}
		if run.CreditsCount > 0 {
			return (run.CreditsCount*run.CompletedResponses + run.ExpectedResponses - 1) / run.ExpectedResponses
		}
		return min(max(0, run.CompletedResponses), max(0, run.PromptsCount))
	}
	if strings.EqualFold(strings.TrimSpace(run.Status), "running") {
		return 0
	}
	if run.CreditsCount > 0 {
		return run.CreditsCount
	}
	return max(0, run.PromptsCount)
}

func runReservedCreditCount(run *AnalysisRun) int {
	if run == nil {
		return 0
	}
	if run.Status == "running" && run.CreditsCount > 0 {
		return run.CreditsCount
	}
	return runCreditCount(run)
}

func requestedCreditCount(promptCount, modelCreditCostSum, requestedCredits int) int {
	if requestedCredits > 0 {
		return requestedCredits
	}
	promptCount = max(0, promptCount)
	if promptCount == 0 {
		return 0
	}
	if modelCreditCostSum <= 0 {
		modelCreditCostSum = 1
	}
	return promptCount * modelCreditCostSum
}
