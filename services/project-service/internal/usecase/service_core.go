package usecase

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

type Service struct {
	mu            sync.RWMutex
	now           func() time.Time
	seq           int64
	projects      map[string]*Project
	prompts       map[string]*Prompt
	competitors   map[string]*Competitor
	models        map[string]AIModel
	projectModels map[string]map[string]bool
	outbox        map[string]*OutboxEvent
	outboxOrder   []string

	store          StateStore
	analysisClient AnalysisClient
	iaClient       IAClient
}

func NewService() *Service {
	svc := &Service{
		now:           time.Now,
		projects:      make(map[string]*Project),
		prompts:       make(map[string]*Prompt),
		competitors:   make(map[string]*Competitor),
		models:        make(map[string]AIModel),
		projectModels: make(map[string]map[string]bool),
		outbox:        make(map[string]*OutboxEvent),
		outboxOrder:   make([]string, 0),
	}
	svc.seedDefaultModels()
	return svc
}

func NewServiceWithDependencies(ctx context.Context, deps Dependencies) (*Service, error) {
	svc := NewService()
	svc.store = deps.Store
	svc.analysisClient = deps.AnalysisClient
	svc.iaClient = deps.IAClient
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

	state := persistedState{}
	payload, ok, err := s.store.Load(ctx)
	if err != nil {
		return fmt.Errorf("load project state: %w", err)
	}
	if !ok {
		return s.persistLocked(ctx)
	}
	if err := json.Unmarshal(payload, &state); err != nil {
		return fmt.Errorf("decode project state: %w", err)
	}

	s.seq = state.Seq
	s.projects = nonNilProjectMap(state.Projects)
	s.prompts = nonNilPromptMap(state.Prompts)
	s.competitors = nonNilCompetitorMap(state.Competitors)
	s.models = nonNilModelMap(state.Models)
	s.projectModels = nonNilProjectModelMap(state.ProjectModels)
	s.outbox = nonNilOutboxMap(state.Outbox)
	s.outboxOrder = nonNilStringSlice(state.OutboxOrder)
	if len(s.models) == 0 {
		s.seedDefaultModels()
	}
	return nil
}

func (s *Service) snapshotLocked() *persistedState {
	state := &persistedState{
		Seq:           s.seq,
		Projects:      make(map[string]*Project, len(s.projects)),
		Prompts:       make(map[string]*Prompt, len(s.prompts)),
		Competitors:   make(map[string]*Competitor, len(s.competitors)),
		Models:        make(map[string]AIModel, len(s.models)),
		ProjectModels: make(map[string]map[string]bool, len(s.projectModels)),
		Outbox:        make(map[string]*OutboxEvent, len(s.outbox)),
		OutboxOrder:   append([]string(nil), s.outboxOrder...),
	}
	for key, value := range s.projects {
		clone := *value
		state.Projects[key] = &clone
	}
	for key, value := range s.prompts {
		clone := *value
		state.Prompts[key] = &clone
	}
	for key, value := range s.competitors {
		clone := *value
		state.Competitors[key] = &clone
	}
	for key, value := range s.models {
		state.Models[key] = value
	}
	for projectID, models := range s.projectModels {
		copied := make(map[string]bool, len(models))
		for modelID, enabled := range models {
			copied[modelID] = enabled
		}
		state.ProjectModels[projectID] = copied
	}
	for key, value := range s.outbox {
		clone := copyOutboxEvent(value)
		state.Outbox[key] = &clone
	}
	return state
}

func (s *Service) restoreLocked(state *persistedState) {
	if state == nil {
		state = &persistedState{}
	}
	s.seq = state.Seq
	s.projects = nonNilProjectMap(state.Projects)
	s.prompts = nonNilPromptMap(state.Prompts)
	s.competitors = nonNilCompetitorMap(state.Competitors)
	s.models = nonNilModelMap(state.Models)
	s.projectModels = nonNilProjectModelMap(state.ProjectModels)
	s.outbox = nonNilOutboxMap(state.Outbox)
	s.outboxOrder = nonNilStringSlice(state.OutboxOrder)
}

func (s *Service) persistLocked(ctx context.Context) error {
	if s.store == nil {
		return nil
	}
	payload, err := json.Marshal(s.snapshotLocked())
	if err != nil {
		return fmt.Errorf("encode project state: %w", err)
	}
	if err := s.store.Save(ctx, payload); err != nil {
		return fmt.Errorf("persist project state: %w", err)
	}
	return nil
}

func (s *Service) seedDefaultModels() {
	defaults := []AIModel{
		{ID: "gpt-4o-mini", Name: "gpt-4o-mini", Label: "GPT-4o Mini", Provider: "openai", ModelID: "gpt-4o-mini", IsActive: true},
		{ID: "gpt-4o", Name: "gpt-4o", Label: "GPT-4o", Provider: "openai", ModelID: "gpt-4o", IsActive: true},
		{ID: "gemini-2.0-flash", Name: "gemini-2.0-flash", Label: "Gemini 2.0 Flash", Provider: "google", ModelID: "gemini-2.0-flash", IsActive: true},
		{ID: "sonar", Name: "sonar", Label: "Perplexity Sonar", Provider: "perplexity", ModelID: "sonar", IsActive: true, SupportsLiveSearch: true},
	}
	for _, model := range defaults {
		s.models[model.ID] = model
	}
}

func (s *Service) getOwnedProjectLocked(projectID, userID string) (*Project, error) {
	projectID = strings.TrimSpace(projectID)
	userID = strings.TrimSpace(userID)
	if projectID == "" {
		return nil, fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if userID == "" {
		return nil, fmt.Errorf("%w: userId is required", ErrValidation)
	}

	project, ok := s.projects[projectID]
	if !ok {
		return nil, fmt.Errorf("%w: project", ErrNotFound)
	}
	if project.UserID != userID {
		return nil, fmt.Errorf("%w: project access denied", ErrUnauthorized)
	}
	return project, nil
}

func (s *Service) nextID(prefix string) string {
	s.seq++
	return fmt.Sprintf("%s-%d", prefix, s.seq)
}

func copyProject(project *Project) Project {
	if project == nil {
		return Project{}
	}
	return *project
}

func copyPrompt(prompt *Prompt) Prompt {
	if prompt == nil {
		return Prompt{}
	}
	return *prompt
}

func copyCompetitor(competitor *Competitor) Competitor {
	if competitor == nil {
		return Competitor{}
	}
	return *competitor
}

func copyOutboxEvent(event *OutboxEvent) OutboxEvent {
	if event == nil {
		return OutboxEvent{}
	}
	out := *event
	out.Payload.Project = copyProject(&event.Payload.Project)
	out.Payload.Prompts = append([]AnalysisPromptText(nil), event.Payload.Prompts...)
	out.Payload.ModelIDs = append([]string(nil), event.Payload.ModelIDs...)
	out.Payload.Competitors = append([]string(nil), event.Payload.Competitors...)
	return out
}

func nonNilProjectMap(input map[string]*Project) map[string]*Project {
	if input == nil {
		return make(map[string]*Project)
	}
	return input
}

func nonNilPromptMap(input map[string]*Prompt) map[string]*Prompt {
	if input == nil {
		return make(map[string]*Prompt)
	}
	return input
}

func nonNilCompetitorMap(input map[string]*Competitor) map[string]*Competitor {
	if input == nil {
		return make(map[string]*Competitor)
	}
	return input
}

func nonNilModelMap(input map[string]AIModel) map[string]AIModel {
	if input == nil {
		return make(map[string]AIModel)
	}
	return input
}

func nonNilProjectModelMap(input map[string]map[string]bool) map[string]map[string]bool {
	if input == nil {
		return make(map[string]map[string]bool)
	}
	return input
}

func nonNilOutboxMap(input map[string]*OutboxEvent) map[string]*OutboxEvent {
	if input == nil {
		return make(map[string]*OutboxEvent)
	}
	out := make(map[string]*OutboxEvent, len(input))
	for key, value := range input {
		clone := copyOutboxEvent(value)
		out[key] = &clone
	}
	return out
}

func nonNilStringSlice(input []string) []string {
	if input == nil {
		return []string{}
	}
	return append([]string(nil), input...)
}

func filterActivePromptsByProject(prompts map[string]*Prompt, projectID string) []AnalysisPromptText {
	out := make([]AnalysisPromptText, 0)
	for _, prompt := range prompts {
		if prompt.ProjectID == projectID && prompt.IsActive {
			out = append(out, AnalysisPromptText{ID: prompt.ID, Text: prompt.Text})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

func filterEnabledModels(projectModels map[string]map[string]bool, projectID string) []string {
	out := make([]string, 0)
	for modelID, enabled := range projectModels[projectID] {
		if enabled {
			out = append(out, modelID)
		}
	}
	sort.Strings(out)
	return out
}

func filterActiveCompetitorsByProject(competitors map[string]*Competitor, projectID string) []string {
	out := make([]string, 0)
	for _, competitor := range competitors {
		if competitor.ProjectID == projectID && competitor.IsActive {
			out = append(out, competitor.Name)
		}
	}
	sort.Strings(out)
	return out
}
