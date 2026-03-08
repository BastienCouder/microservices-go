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
		now:                time.Now,
		runs:               make(map[string]*AnalysisRun),
		runsByProject:      make(map[string][]string),
		promptRuns:         make(map[string]*PromptRun),
		promptRunsByRun:    make(map[string][]string),
		responses:          make(map[string]*AIResponse),
		responsesByRun:     make(map[string][]string),
		responseIndexByRun: make(map[string]map[string]string),
		runByRequest:       make(map[string]string),
		alerts:             make(map[string]*Alert),
		alertsByProject:    make(map[string][]string),
	}
}

func NewServiceWithDependencies(ctx context.Context, deps Dependencies) (*Service, error) {
	svc := NewService()
	svc.store = deps.Store
	svc.dashboardCache = deps.DashboardCache
	svc.dashboardCacheTTL = deps.DashboardCacheTTL
	svc.projectVerifier = deps.ProjectVerifier
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
		Seq:                s.seq,
		Runs:               make(map[string]*AnalysisRun, len(s.runs)),
		RunsByProject:      make(map[string][]string, len(s.runsByProject)),
		PromptRuns:         make(map[string]*PromptRun, len(s.promptRuns)),
		PromptRunsByRun:    make(map[string][]string, len(s.promptRunsByRun)),
		Responses:          make(map[string]*AIResponse, len(s.responses)),
		ResponsesByRun:     make(map[string][]string, len(s.responsesByRun)),
		ResponseIndexByRun: make(map[string]map[string]string, len(s.responseIndexByRun)),
		RunByRequest:       make(map[string]string, len(s.runByRequest)),
		Alerts:             make(map[string]*Alert, len(s.alerts)),
		AlertsByProject:    make(map[string][]string, len(s.alertsByProject)),
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
		clone := *value
		clone.CitedURLs = append([]string(nil), value.CitedURLs...)
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
	for key, value := range s.alerts {
		clone := *value
		state.Alerts[key] = &clone
	}
	for key, ids := range s.alertsByProject {
		state.AlertsByProject[key] = append([]string(nil), ids...)
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
	s.alerts = nonNilAlertMap(state.Alerts)
	s.alertsByProject = nonNilSliceMap(state.AlertsByProject)
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
