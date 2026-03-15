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
	reports            map[string]*ProjectReport
	reportAuditEvents  map[string]*ReportAuditEvent
	reportAuditByReport map[string][]string
	outbox             map[string]*OutboxEvent
	outboxOrder        []string

	store                 StateStore
	analysisClient        AnalysisClient
	iaClient              IAClient
	attributionClient     AttributionClient
	reportAnalyticsClient ReportAnalyticsClient
	notificationClient    NotificationClient
	reportsPublicBaseURL  string
	reportSigningSecret   string
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
		reports:            make(map[string]*ProjectReport),
		reportAuditEvents:  make(map[string]*ReportAuditEvent),
		reportAuditByReport: make(map[string][]string),
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
	svc.reportAnalyticsClient = deps.ReportAnalyticsClient
	svc.notificationClient = deps.NotificationClient
	svc.reportsPublicBaseURL = deps.ReportsPublicBaseURL
	svc.reportSigningSecret = deps.ReportSigningSecret
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
	s.reports = nonNilProjectReportMap(state.Reports)
	s.reportAuditEvents = nonNilReportAuditEventMap(state.ReportAuditEvents)
	s.reportAuditByReport = nonNilStringSliceMap(state.ReportAuditByReport)
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
		if schedule, err := normalizePromptSchedule(prompt.Schedule, effectivePromptModelIDs(prompt, filterEnabledModels(s.projectModels, prompt.ProjectID))); err == nil {
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
		Reports:            make(map[string]*ProjectReport, len(s.reports)),
		ReportAuditEvents:  make(map[string]*ReportAuditEvent, len(s.reportAuditEvents)),
		ReportAuditByReport: make(map[string][]string, len(s.reportAuditByReport)),
		Outbox:             make(map[string]*OutboxEvent, len(s.outbox)),
		OutboxOrder:        append([]string(nil), s.outboxOrder...),
	}
	for key, value := range s.projects {
		clone := *value
		clone.WhiteLabel = copyWhiteLabelSettings(value.WhiteLabel)
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
	for key, value := range s.reports {
		clone := copyProjectReport(value)
		state.Reports[key] = &clone
	}
	for key, value := range s.reportAuditEvents {
		clone := copyReportAuditEvent(value)
		state.ReportAuditEvents[key] = &clone
	}
	for key, value := range s.reportAuditByReport {
		state.ReportAuditByReport[key] = nonNilStringSlice(value)
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
	s.reports = nonNilProjectReportMap(state.Reports)
	s.reportAuditEvents = nonNilReportAuditEventMap(state.ReportAuditEvents)
	s.reportAuditByReport = nonNilStringSliceMap(state.ReportAuditByReport)
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
		{ID: "gpt-4o-mini", Label: "GPT-4o Mini", Provider: "openai", Group: "chatgpt", IconKey: "openai", IconPath: "/models/openai.svg", ModelID: "gpt-4o-mini", IsActive: true},
		{ID: "gpt-4o", Label: "GPT-4o", Provider: "openai", Group: "chatgpt", IconKey: "openai", IconPath: "/models/openai.svg", ModelID: "gpt-4o", IsActive: true},
		{ID: "claude-3-5-sonnet", Label: "Claude 3.5 Sonnet", Provider: "anthropic", Group: "claude", IconKey: "claude", IconPath: "/models/claude.svg", ModelID: "claude-3-5-sonnet", IsActive: true},
		{ID: "gemini-2.0-flash", Label: "Gemini 2.0 Flash", Provider: "google", Group: "gemini", IconKey: "gemini", IconPath: "/models/gemini.svg", ModelID: "gemini-2.0-flash", IsActive: true},
		{ID: "sonar", Label: "Perplexity Sonar", Provider: "perplexity", Group: "perplexity", IconKey: "perplexity", IconPath: "/models/perplexity.svg", ModelID: "sonar", IsActive: true, SupportsLiveSearch: true},
		{ID: "mistral-large", Label: "Mistral Large", Provider: "mistral", Group: "mistral", IconKey: "mistral", IconPath: "/models/mistral.svg", ModelID: "mistral-large", IsActive: true},
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
	out := *project
	out.WhiteLabel = copyWhiteLabelSettings(project.WhiteLabel)
	return out
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
	out := make(map[string]*Project, len(input))
	for key, value := range input {
		if value == nil {
			continue
		}
		clone := *value
		clone.WhiteLabel = copyWhiteLabelSettings(value.WhiteLabel)
		out[key] = &clone
	}
	return out
}

func nonNilPromptMap(input map[string]*Prompt) map[string]*Prompt {
	if input == nil {
		return make(map[string]*Prompt)
	}
	out := make(map[string]*Prompt, len(input))
	for key, value := range input {
		if value == nil {
			continue
		}
		clone := copyPrompt(value)
		out[key] = &clone
	}
	return out
}

func nonNilCompetitorMap(input map[string]*Competitor) map[string]*Competitor {
	if input == nil {
		return make(map[string]*Competitor)
	}
	out := make(map[string]*Competitor, len(input))
	for key, value := range input {
		if value == nil {
			continue
		}
		clone := copyCompetitor(value)
		out[key] = &clone
	}
	return out
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

func nonNilProjectReportMap(input map[string]*ProjectReport) map[string]*ProjectReport {
	if input == nil {
		return make(map[string]*ProjectReport)
	}
	out := make(map[string]*ProjectReport, len(input))
	for key, value := range input {
		if value == nil {
			continue
		}
		clone := copyProjectReport(value)
		out[key] = &clone
	}
	return out
}

func nonNilReportAuditEventMap(input map[string]*ReportAuditEvent) map[string]*ReportAuditEvent {
	if input == nil {
		return make(map[string]*ReportAuditEvent)
	}
	out := make(map[string]*ReportAuditEvent, len(input))
	for key, value := range input {
		if value == nil {
			continue
		}
		clone := copyReportAuditEvent(value)
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

func nonNilStringSliceMap(input map[string][]string) map[string][]string {
	if input == nil {
		return map[string][]string{}
	}
	out := make(map[string][]string, len(input))
	for key, value := range input {
		out[key] = nonNilStringSlice(value)
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

func filterActivePromptsByProject(prompts map[string]*Prompt, projectModels map[string]map[string]bool, projectID string) []AnalysisPromptText {
	enabledModelIDs := filterEnabledModels(projectModels, projectID)
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
