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
	mu                 sync.RWMutex
	now                func() time.Time
	seq                int64
	projects           map[string]*Project
	prompts            map[string]*Prompt
	competitors        map[string]*Competitor
	models             map[string]AIModel
	projectModels      map[string]map[string]bool
	impactIntegrations map[string]*ProjectImpactIntegrations
	outbox             map[string]*OutboxEvent
	outboxOrder        []string

	store             StateStore
	analysisClient    AnalysisClient
	iaClient          IAClient
	attributionClient AttributionClient
}

func NewService() *Service {
	svc := &Service{
		now:                time.Now,
		projects:           make(map[string]*Project),
		prompts:            make(map[string]*Prompt),
		competitors:        make(map[string]*Competitor),
		models:             make(map[string]AIModel),
		projectModels:      make(map[string]map[string]bool),
		impactIntegrations: make(map[string]*ProjectImpactIntegrations),
		outbox:             make(map[string]*OutboxEvent),
		outboxOrder:        make([]string, 0),
	}
	svc.seedDefaultModels()
	return svc
}

func NewServiceWithDependencies(ctx context.Context, deps Dependencies) (*Service, error) {
	svc := NewService()
	svc.store = deps.Store
	svc.analysisClient = deps.AnalysisClient
	svc.iaClient = deps.IAClient
	svc.attributionClient = deps.AttributionClient
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
	s.impactIntegrations = nonNilProjectImpactIntegrationMap(state.ImpactIntegrations)
	s.outbox = nonNilOutboxMap(state.Outbox)
	s.outboxOrder = nonNilStringSlice(state.OutboxOrder)
	if len(s.models) == 0 {
		s.seedDefaultModels()
	}
	for _, prompt := range s.prompts {
		if prompt.Status == "" {
			if prompt.IsActive {
				prompt.Status = PromptStatusActive
			} else {
				prompt.Status = PromptStatusDisabled
			}
		}
		if schedule, err := normalizePromptSchedule(prompt.Schedule, effectivePromptModelIDs(prompt, filterEnabledModels(s.projectModels, s.models, prompt.ProjectID))); err == nil {
			prompt.Schedule = schedule
		}
	}
	return nil
}

func (s *Service) snapshotLocked() *persistedState {
	state := &persistedState{
		Seq:                s.seq,
		Projects:           make(map[string]*Project, len(s.projects)),
		Prompts:            make(map[string]*Prompt, len(s.prompts)),
		Competitors:        make(map[string]*Competitor, len(s.competitors)),
		Models:             make(map[string]AIModel, len(s.models)),
		ProjectModels:      make(map[string]map[string]bool, len(s.projectModels)),
		ImpactIntegrations: make(map[string]*ProjectImpactIntegrations, len(s.impactIntegrations)),
		Outbox:             make(map[string]*OutboxEvent, len(s.outbox)),
		OutboxOrder:        append([]string(nil), s.outboxOrder...),
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
	for key, value := range s.impactIntegrations {
		clone := copyProjectImpactIntegrations(value)
		state.ImpactIntegrations[key] = &clone
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
	s.impactIntegrations = nonNilProjectImpactIntegrationMap(state.ImpactIntegrations)
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
		{ID: "gpt-oss-20b-free", Label: "gpt-oss-20b (free)", Provider: "openai", Group: "gpt-oss", IconKey: "openai", IconPath: "/models/openai.svg", ModelID: "openai/gpt-oss-20b:free", IsActive: true},
		{ID: "gpt-oss-120b-free", Label: "gpt-oss-120b (free)", Provider: "openai", Group: "gpt-oss", IconKey: "openai", IconPath: "/models/openai.svg", ModelID: "openai/gpt-oss-120b:free", IsActive: true},
		{ID: "gemma-3-4b-free", Label: "Gemma 3 4B (free)", Provider: "google", Group: "gemma", IconKey: "google", IconPath: "/models/google.svg", ModelID: "google/gemma-3-4b-it:free", IsActive: true},
		{ID: "gemma-3-27b-free", Label: "Gemma 3 27B (free)", Provider: "google", Group: "gemma", IconKey: "google", IconPath: "/models/google.svg", ModelID: "google/gemma-3-27b-it:free", IsActive: true},
	}
	for _, model := range defaults {
		s.models[model.ID] = model
	}
}

func (s *Service) getProjectForOrganizationLocked(projectID string, organizationID int64) (*Project, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return nil, fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if organizationID <= 0 {
		return nil, fmt.Errorf("%w: organizationId must be positive", ErrValidation)
	}

	project, ok := s.projects[projectID]
	if !ok {
		return nil, fmt.Errorf("%w: project", ErrNotFound)
	}
	if project.OrganizationID != organizationID {
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

func copyProjectImpactIntegrations(value *ProjectImpactIntegrations) ProjectImpactIntegrations {
	if value == nil {
		return ProjectImpactIntegrations{}
	}
	return *value
}

func copyPrompt(prompt *Prompt) Prompt {
	if prompt == nil {
		return Prompt{}
	}
	out := *prompt
	out.ModelIDs = nonNilStringSlice(prompt.ModelIDs)
	out.Schedule = copyPromptSchedule(prompt.Schedule)
	return out
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

func nonNilProjectImpactIntegrationMap(input map[string]*ProjectImpactIntegrations) map[string]*ProjectImpactIntegrations {
	if input == nil {
		return make(map[string]*ProjectImpactIntegrations)
	}
	out := make(map[string]*ProjectImpactIntegrations, len(input))
	for key, value := range input {
		clone := copyProjectImpactIntegrations(value)
		out[key] = &clone
	}
	return out
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

func copyStringMap(input map[string]string) map[string]string {
	if input == nil {
		return map[string]string{}
	}
	out := make(map[string]string, len(input))
	for key, value := range input {
		out[key] = value
	}
	return out
}

func copyPromptSchedule(input PromptSchedule) PromptSchedule {
	return PromptSchedule{
		Mode:       input.Mode,
		Cron:       input.Cron,
		Timezone:   input.Timezone,
		ModelCrons: copyStringMap(input.ModelCrons),
	}
}

func normalizeModelIDs(modelIDs []string) []string {
	seen := make(map[string]struct{}, len(modelIDs))
	out := make([]string, 0, len(modelIDs))
	for _, raw := range modelIDs {
		modelID := strings.TrimSpace(raw)
		if modelID == "" {
			continue
		}
		if _, exists := seen[modelID]; exists {
			continue
		}
		seen[modelID] = struct{}{}
		out = append(out, modelID)
	}
	sort.Strings(out)
	return out
}

func effectivePromptModelIDs(prompt *Prompt, enabledModelIDs []string) []string {
	if prompt == nil {
		return nonNilStringSlice(enabledModelIDs)
	}

	enabled := make(map[string]struct{}, len(enabledModelIDs))
	for _, modelID := range enabledModelIDs {
		enabled[modelID] = struct{}{}
	}

	selected := make([]string, 0, len(prompt.ModelIDs))
	for _, modelID := range normalizeModelIDs(prompt.ModelIDs) {
		if _, ok := enabled[modelID]; ok {
			selected = append(selected, modelID)
		}
	}
	if len(selected) > 0 {
		return selected
	}
	return nonNilStringSlice(enabledModelIDs)
}

func filterActivePromptsByProject(prompts map[string]*Prompt, projectModels map[string]map[string]bool, models map[string]AIModel, projectID string) []AnalysisPromptText {
	enabledModelIDs := filterEnabledModels(projectModels, models, projectID)
	out := make([]AnalysisPromptText, 0)
	for _, prompt := range prompts {
		if prompt.ProjectID == projectID && prompt.IsActive {
			out = append(out, AnalysisPromptText{
				ID:       prompt.ID,
				Text:     prompt.Text,
				ModelIDs: effectivePromptModelIDs(prompt, enabledModelIDs),
			})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

func filterEnabledModels(projectModels map[string]map[string]bool, models map[string]AIModel, projectID string) []string {
	out := make([]string, 0)
	for modelID, enabled := range projectModels[projectID] {
		model, exists := models[modelID]
		if enabled && exists && model.IsActive {
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
