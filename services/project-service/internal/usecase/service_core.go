package usecase

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

type Service struct {
	mu                    sync.RWMutex
	now                   func() time.Time
	seq                   int64
	projects              map[string]*Project
	prompts               map[string]*Prompt
	competitors           map[string]*Competitor
	models                map[string]AIModel
	brandCanonByProject   map[string]*BrandCanon
	projectModels         map[string]map[string]bool
	projectMembers        map[string]map[int64]*ProjectMember
	modelSelectionChanges map[string]ProjectModelSelectionChangeUsage
	impactIntegrations    map[string]*ProjectImpactIntegrations
	providerCredentials   map[string]map[string]*LLMProviderCredentialRecord
	outbox                map[string]*OutboxEvent
	outboxOrder           []string

	store                   StateStore
	analysisClient          AnalysisClient
	iaClient                IAClient
	projectMembershipClient ProjectMembershipClient
	attributionClient       AttributionClient
	billingClient           BillingClient
	ga4OAuthProvider        GA4OAuthProvider
	ga4LLMSetupProvider     GA4LLMSetupProvider
	ga4OAuthStateKey        string
}

func NewService() *Service {
	svc := &Service{
		now:                   time.Now,
		projects:              make(map[string]*Project),
		prompts:               make(map[string]*Prompt),
		competitors:           make(map[string]*Competitor),
		models:                make(map[string]AIModel),
		brandCanonByProject:   make(map[string]*BrandCanon),
		projectModels:         make(map[string]map[string]bool),
		projectMembers:        make(map[string]map[int64]*ProjectMember),
		modelSelectionChanges: make(map[string]ProjectModelSelectionChangeUsage),
		impactIntegrations:    make(map[string]*ProjectImpactIntegrations),
		providerCredentials:   make(map[string]map[string]*LLMProviderCredentialRecord),
		outbox:                make(map[string]*OutboxEvent),
		outboxOrder:           make([]string, 0),
	}
	svc.seedDefaultModels()
	return svc
}

func NewServiceWithDependencies(ctx context.Context, deps Dependencies) (*Service, error) {
	svc := NewService()
	svc.store = deps.Store
	svc.analysisClient = deps.AnalysisClient
	svc.iaClient = deps.IAClient
	svc.projectMembershipClient = deps.ProjectMembershipClient
	svc.attributionClient = deps.AttributionClient
	svc.billingClient = deps.BillingClient
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
	s.brandCanonByProject = nonNilBrandCanonMap(state.BrandCanonByProject)
	s.projectModels = nonNilProjectModelMap(state.ProjectModels)
	s.projectMembers = nonNilProjectMemberMap(state.ProjectMembers)
	s.modelSelectionChanges = nonNilModelSelectionChangeUsageMap(state.ModelSelectionChanges)
	s.impactIntegrations = nonNilProjectImpactIntegrationMap(state.ImpactIntegrations)
	s.providerCredentials = nonNilProviderCredentialMap(state.ProviderCredentials)
	s.outbox = nonNilOutboxMap(state.Outbox)
	s.outboxOrder = nonNilStringSlice(state.OutboxOrder)
	if len(s.models) == 0 {
		s.seedDefaultModels()
	}
	s.normalizeDefaultModelDefinitionsLocked()
	s.normalizeModelSourcesLocked()
	for _, prompt := range s.prompts {
		prompt.Kind = normalizePromptKind(prompt.Kind)
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
		Seq:                   s.seq,
		Projects:              make(map[string]*Project, len(s.projects)),
		Prompts:               make(map[string]*Prompt, len(s.prompts)),
		Competitors:           make(map[string]*Competitor, len(s.competitors)),
		Models:                make(map[string]AIModel, len(s.models)),
		BrandCanonByProject:   make(map[string]*BrandCanon, len(s.brandCanonByProject)),
		ProjectModels:         make(map[string]map[string]bool, len(s.projectModels)),
		ProjectMembers:        make(map[string]map[int64]*ProjectMember, len(s.projectMembers)),
		ModelSelectionChanges: make(map[string]ProjectModelSelectionChangeUsage, len(s.modelSelectionChanges)),
		ImpactIntegrations:    make(map[string]*ProjectImpactIntegrations, len(s.impactIntegrations)),
		ProviderCredentials:   make(map[string]map[string]*LLMProviderCredentialRecord, len(s.providerCredentials)),
		Outbox:                make(map[string]*OutboxEvent, len(s.outbox)),
		OutboxOrder:           append([]string(nil), s.outboxOrder...),
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
	for key, value := range s.brandCanonByProject {
		clone := copyBrandCanon(value)
		state.BrandCanonByProject[key] = &clone
	}
	for projectID, models := range s.projectModels {
		copied := make(map[string]bool, len(models))
		for modelID, enabled := range models {
			copied[modelID] = enabled
		}
		state.ProjectModels[projectID] = copied
	}
	for projectID, members := range s.projectMembers {
		copied := make(map[int64]*ProjectMember, len(members))
		for userID, member := range members {
			clone := copyProjectMember(member)
			copied[userID] = &clone
		}
		state.ProjectMembers[projectID] = copied
	}
	for projectID, usage := range s.modelSelectionChanges {
		state.ModelSelectionChanges[projectID] = usage
	}
	for key, value := range s.impactIntegrations {
		clone := copyProjectImpactIntegrations(value)
		state.ImpactIntegrations[key] = &clone
	}
	for projectID, credentials := range s.providerCredentials {
		state.ProviderCredentials[projectID] = copyProviderCredentialMap(credentials)
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
	s.brandCanonByProject = nonNilBrandCanonMap(state.BrandCanonByProject)
	s.projectModels = nonNilProjectModelMap(state.ProjectModels)
	s.projectMembers = nonNilProjectMemberMap(state.ProjectMembers)
	s.modelSelectionChanges = nonNilModelSelectionChangeUsageMap(state.ModelSelectionChanges)
	s.impactIntegrations = nonNilProjectImpactIntegrationMap(state.ImpactIntegrations)
	s.providerCredentials = nonNilProviderCredentialMap(state.ProviderCredentials)
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
		{ID: "gpt-oss-20b-free", Label: "gpt-oss-20b (free)", Provider: "openai", Group: "gpt-oss", IconKey: "openai", IconPath: "/models/openai.svg", ModelID: "openai/gpt-oss-20b:free", Source: AIModelSourceOpenRouter, IsActive: true, CreditCost: 1},
		{ID: "gpt-oss-120b-free", Label: "gpt-oss-120b (free)", Provider: "openai", Group: "gpt-oss", IconKey: "openai", IconPath: "/models/openai.svg", ModelID: "openai/gpt-oss-120b:free", Source: AIModelSourceOpenRouter, IsActive: true, CreditCost: 1},
		{ID: "gemma-3-4b-free", Label: "Gemma 3 4B", Provider: "google", Group: "gemma", IconKey: "google", IconPath: "/models/google.svg", ModelID: "google/gemma-3-4b-it", Source: AIModelSourceOpenRouter, IsActive: true, CreditCost: 1},
		{ID: "gemma-3-27b-free", Label: "Gemma 3 27B", Provider: "google", Group: "gemma", IconKey: "google", IconPath: "/models/google.svg", ModelID: "google/gemma-3-27b-it", Source: AIModelSourceOpenRouter, IsActive: true, CreditCost: 1},
	}
	for _, model := range defaults {
		s.models[model.ID] = model
	}
}

func (s *Service) normalizeDefaultModelDefinitionsLocked() {
	replacements := map[string]string{
		"google/gemma-3-4b-it:free":  "google/gemma-3-4b-it",
		"google/gemma-3-27b-it:free": "google/gemma-3-27b-it",
	}
	existingCanonical := make(map[string]string, len(s.models))
	for modelID, model := range s.models {
		key := strings.TrimSpace(model.Provider) + "\x00" + strings.TrimSpace(model.ModelID)
		existingCanonical[key] = modelID
	}
	for modelID, model := range s.models {
		if replacement, ok := replacements[strings.TrimSpace(model.ModelID)]; ok {
			key := strings.TrimSpace(model.Provider) + "\x00" + replacement
			if existingModelID, exists := existingCanonical[key]; exists && existingModelID != modelID {
				s.migrateLegacyModelReferencesLocked(modelID, existingModelID)
				delete(s.models, modelID)
				continue
			}
			model.ModelID = replacement
			if model.ID == "gemma-3-4b-free" {
				model.Label = "Gemma 3 4B"
			}
			if model.ID == "gemma-3-27b-free" {
				model.Label = "Gemma 3 27B"
			}
			s.models[modelID] = model
		}
	}
}

func (s *Service) migrateLegacyModelReferencesLocked(legacyModelID, canonicalModelID string) {
	if strings.TrimSpace(legacyModelID) == "" || strings.TrimSpace(canonicalModelID) == "" || legacyModelID == canonicalModelID {
		return
	}

	for projectID, enabledByID := range s.projectModels {
		if enabledByID == nil || !enabledByID[legacyModelID] {
			continue
		}
		enabledByID[canonicalModelID] = true
		delete(enabledByID, legacyModelID)
		s.projectModels[projectID] = enabledByID
	}

	for _, prompt := range s.prompts {
		if prompt == nil {
			continue
		}
		replaced := false
		modelIDs := make([]string, 0, len(prompt.ModelIDs))
		for _, modelID := range prompt.ModelIDs {
			if strings.TrimSpace(modelID) == legacyModelID {
				modelID = canonicalModelID
				replaced = true
			}
			modelIDs = append(modelIDs, modelID)
		}
		if replaced {
			prompt.ModelIDs = normalizeModelIDs(modelIDs)
		}

		if len(prompt.Schedule.ModelCrons) > 0 {
			if cron, ok := prompt.Schedule.ModelCrons[legacyModelID]; ok {
				if prompt.Schedule.ModelCrons == nil {
					prompt.Schedule.ModelCrons = make(map[string]string)
				}
				if _, exists := prompt.Schedule.ModelCrons[canonicalModelID]; !exists {
					prompt.Schedule.ModelCrons[canonicalModelID] = cron
				}
				delete(prompt.Schedule.ModelCrons, legacyModelID)
			}
		}
	}
}

func (s *Service) normalizeModelSourcesLocked() {
	for modelID, model := range s.models {
		model.Source = normalizeAIModelSource(model)
		if model.CreditCost <= 0 {
			model.CreditCost = 1
		}
		s.models[modelID] = model
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
	return scopedUUID(prefix)
}

func scopedUUID(prefix string) string {
	var raw [16]byte
	if _, err := rand.Read(raw[:]); err != nil {
		// Keep ids unique enough even if crypto/rand is temporarily unavailable.
		return fmt.Sprintf("%s_%d", prefix, time.Now().UTC().UnixNano())
	}
	raw[6] = (raw[6] & 0x0f) | 0x40
	raw[8] = (raw[8] & 0x3f) | 0x80
	hexValue := hex.EncodeToString(raw[:])
	return fmt.Sprintf("%s_%s-%s-%s-%s-%s", prefix, hexValue[0:8], hexValue[8:12], hexValue[12:16], hexValue[16:20], hexValue[20:32])
}

func copyProject(project *Project) Project {
	if project == nil {
		return Project{}
	}
	return *project
}

func copyProjectMember(member *ProjectMember) ProjectMember {
	if member == nil {
		return ProjectMember{}
	}
	return *member
}

func copyProjectImpactIntegrations(value *ProjectImpactIntegrations) ProjectImpactIntegrations {
	if value == nil {
		return ProjectImpactIntegrations{}
	}
	return *value
}

func copyBrandCanon(canon *BrandCanon) BrandCanon {
	if canon == nil {
		return BrandCanon{}
	}
	out := *canon
	out.Audience = append([]string(nil), canon.Audience...)
	out.UseCases = append([]string(nil), canon.UseCases...)
	out.Features = append([]string(nil), canon.Features...)
	out.Pricing = copyCanonMap(canon.Pricing)
	return out
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

func nonNilBrandCanonMap(input map[string]*BrandCanon) map[string]*BrandCanon {
	if input == nil {
		return make(map[string]*BrandCanon)
	}
	out := make(map[string]*BrandCanon, len(input))
	for key, value := range input {
		clone := copyBrandCanon(value)
		out[key] = &clone
	}
	return out
}

func nonNilProjectModelMap(input map[string]map[string]bool) map[string]map[string]bool {
	if input == nil {
		return make(map[string]map[string]bool)
	}
	return input
}

func nonNilProjectMemberMap(input map[string]map[int64]*ProjectMember) map[string]map[int64]*ProjectMember {
	if input == nil {
		return make(map[string]map[int64]*ProjectMember)
	}
	out := make(map[string]map[int64]*ProjectMember, len(input))
	for projectID, members := range input {
		out[projectID] = make(map[int64]*ProjectMember, len(members))
		for userID, member := range members {
			clone := copyProjectMember(member)
			out[projectID][userID] = &clone
		}
	}
	return out
}

func nonNilModelSelectionChangeUsageMap(input map[string]ProjectModelSelectionChangeUsage) map[string]ProjectModelSelectionChangeUsage {
	if input == nil {
		return make(map[string]ProjectModelSelectionChangeUsage)
	}
	out := make(map[string]ProjectModelSelectionChangeUsage, len(input))
	for key, value := range input {
		out[key] = value
	}
	return out
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

func nonNilProviderCredentialMap(input map[string]map[string]*LLMProviderCredentialRecord) map[string]map[string]*LLMProviderCredentialRecord {
	if input == nil {
		return make(map[string]map[string]*LLMProviderCredentialRecord)
	}
	out := make(map[string]map[string]*LLMProviderCredentialRecord, len(input))
	for projectID, credentials := range input {
		out[projectID] = copyProviderCredentialMap(credentials)
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

func copyProviderCredentialMap(input map[string]*LLMProviderCredentialRecord) map[string]*LLMProviderCredentialRecord {
	if input == nil {
		return map[string]*LLMProviderCredentialRecord{}
	}
	out := make(map[string]*LLMProviderCredentialRecord, len(input))
	for provider, record := range input {
		out[provider] = copyLLMProviderCredentialRecord(record)
	}
	return out
}

func copyLLMProviderCredentialRecord(input *LLMProviderCredentialRecord) *LLMProviderCredentialRecord {
	if input == nil {
		return nil
	}
	clone := *input
	return &clone
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
		if prompt.ProjectID == projectID && prompt.IsActive && normalizePromptKind(prompt.Kind) == PromptKindMonitoring {
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
