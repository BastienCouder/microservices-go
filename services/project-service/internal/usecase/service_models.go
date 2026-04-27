package usecase

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"
)

var (
	openRouterModelsURL = "https://openrouter.ai/api/v1/models"
	openRouterClient    = &http.Client{Timeout: 20 * time.Second}
)

var defaultOpenRouterProviderIDs = []string{
	"openai",
	"anthropic",
	"google",
	"perplexity",
	"qwen",
	"deepseek",
	"mistral",
	"zai",
	"xai",
	"groq",
	"copilot",
	"meta",
}

var openRouterProviderPrefixesByID = map[string][]string{
	"openai":     {"openai"},
	"anthropic":  {"anthropic"},
	"google":     {"google", "gemini"},
	"perplexity": {"perplexity"},
	"qwen":       {"qwen"},
	"deepseek":   {"deepseek"},
	"mistral":    {"mistral", "mistralai"},
	"zai":        {"z-ai", "zai", "z"},
	"xai":        {"x-ai", "xai", "grok"},
	"groq":       {"groq"},
	"copilot":    {"copilot"},
	"meta":       {"meta-llama", "meta"},
}

type SyncOpenRouterModelsInput struct {
	OnlyFree                  bool
	MinContext                int
	SupportsTools             bool
	Variant                   string
	Providers                 []string
	SearchQuery               string
	ActivateImported          bool
	PurgeUnsupportedProviders bool
}

type SyncOpenRouterModelsResult struct {
	Imported int       `json:"imported"`
	Created  int       `json:"created"`
	Updated  int       `json:"updated"`
	Purged   int       `json:"purged"`
	Models   []AIModel `json:"models"`
}

type openRouterModelsResponse struct {
	Data []openRouterModelPayload `json:"data"`
}

type openRouterModelPayload struct {
	ID                  string                        `json:"id"`
	Name                string                        `json:"name"`
	ContextLength       int                           `json:"context_length"`
	Architecture        openRouterArchitecturePayload `json:"architecture"`
	Pricing             map[string]string             `json:"pricing"`
	SupportedParameters []string                      `json:"supported_parameters"`
}

type openRouterArchitecturePayload struct {
	InstructType string `json:"instruct_type"`
}

func (s *Service) ListModels(ctx context.Context, onlyActive bool) ([]AIModel, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	models := make([]AIModel, 0, len(s.models))
	for _, model := range s.models {
		if onlyActive && !model.IsActive {
			continue
		}
		models = append(models, model)
	}
	sort.Slice(models, func(i, j int) bool { return models[i].Label < models[j].Label })
	return models, nil
}

func (s *Service) ListProjectModels(ctx context.Context, projectID string, organizationID int64) ([]ProjectModelSelection, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return nil, err
	}

	models := make([]AIModel, 0, len(s.models))
	for _, model := range s.models {
		models = append(models, model)
	}
	sort.Slice(models, func(i, j int) bool { return models[i].Label < models[j].Label })

	enabledByID := s.projectModels[projectID]
	if enabledByID == nil {
		enabledByID = make(map[string]bool)
	}

	selection := make([]ProjectModelSelection, 0, len(models))
	for _, model := range models {
		selection = append(selection, ProjectModelSelection{AIModel: model, IsEnabledForProject: enabledByID[model.ID]})
	}
	return selection, nil
}

func (s *Service) ListEnabledProjectModelIDs(ctx context.Context, projectID string, organizationID int64) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return nil, err
	}

	return filterEnabledModels(s.projectModels, s.models, projectID), nil
}

func (s *Service) ReplaceProjectModels(ctx context.Context, projectID string, organizationID int64, modelIDs []string) (ReplaceProjectModelsResult, error) {
	if len(modelIDs) == 0 {
		return ReplaceProjectModelsResult{}, fmt.Errorf("%w: modelIds cannot be empty", ErrValidation)
	}

	normalized := make([]string, 0, len(modelIDs))
	seen := make(map[string]bool)
	for _, raw := range modelIDs {
		modelID := strings.TrimSpace(raw)
		if modelID == "" {
			return ReplaceProjectModelsResult{}, fmt.Errorf("%w: modelId cannot be empty", ErrValidation)
		}
		if seen[modelID] {
			continue
		}
		seen[modelID] = true
		normalized = append(normalized, modelID)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return ReplaceProjectModelsResult{}, err
	}

	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return ReplaceProjectModelsResult{}, err
	}
	for _, modelID := range normalized {
		model, exists := s.models[modelID]
		if !exists {
			return ReplaceProjectModelsResult{}, fmt.Errorf("%w: unknown model id %s", ErrValidation, modelID)
		}
		if !model.IsActive {
			return ReplaceProjectModelsResult{}, fmt.Errorf("%w: model id %s is inactive", ErrValidation, modelID)
		}
	}

	entitlements, err := s.resolveBillingEntitlementsLocked(ctx, organizationID)
	if err != nil {
		return ReplaceProjectModelsResult{}, err
	}
	if entitlements.ModelSelectionLimit > 0 && len(normalized) > entitlements.ModelSelectionLimit {
		return ReplaceProjectModelsResult{}, fmt.Errorf(
			"%w: plan %s allows up to %d models",
			ErrValidation,
			strings.TrimSpace(entitlements.Plan),
			entitlements.ModelSelectionLimit,
		)
	}

	backup := s.snapshotLocked()
	replacement := make(map[string]bool, len(normalized))
	for _, modelID := range normalized {
		replacement[modelID] = true
	}
	s.projectModels[projectID] = replacement
	for _, prompt := range s.prompts {
		if prompt.ProjectID != projectID {
			continue
		}
		prompt.ModelIDs = effectivePromptModelIDs(prompt, normalized)
		schedule, err := normalizePromptSchedule(prompt.Schedule, prompt.ModelIDs)
		if err != nil {
			s.restoreLocked(backup)
			return ReplaceProjectModelsResult{}, err
		}
		prompt.Schedule = schedule
	}
	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return ReplaceProjectModelsResult{}, err
	}

	sort.Strings(normalized)
	return ReplaceProjectModelsResult{ProjectID: projectID, ModelIDs: normalized, Count: len(normalized)}, nil
}

func (s *Service) resolveBillingEntitlementsLocked(ctx context.Context, organizationID int64) (BillingEntitlements, error) {
	if s.billingClient == nil {
		return BillingEntitlements{
			Plan:                    "starter",
			ModelSelectionLimit:     3,
			MonthlyModelChangeLimit: 0,
		}, nil
	}

	entitlements, err := s.billingClient.GetOrganizationEntitlements(ctx, organizationID)
	if err != nil {
		return BillingEntitlements{}, fmt.Errorf("%w: billing entitlements unavailable", ErrDependencyUnavailable)
	}
	if strings.TrimSpace(entitlements.Plan) == "" {
		entitlements.Plan = "starter"
	}
	return entitlements, nil
}

func (s *Service) SeedDefaultModels(ctx context.Context) ([]AIModel, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	s.seedDefaultModels()
	if err := s.persistLocked(ctx); err != nil {
		return nil, err
	}

	models := make([]AIModel, 0, len(s.models))
	for _, model := range s.models {
		models = append(models, model)
	}
	sort.Slice(models, func(i, j int) bool { return models[i].Label < models[j].Label })
	return models, nil
}

func (s *Service) SyncOpenRouterModels(ctx context.Context, input SyncOpenRouterModelsInput) (SyncOpenRouterModelsResult, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, openRouterModelsURL, nil)
	if err != nil {
		return SyncOpenRouterModelsResult{}, fmt.Errorf("create openrouter models request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	res, err := openRouterClient.Do(req)
	if err != nil {
		return SyncOpenRouterModelsResult{}, fmt.Errorf("%w: openrouter models unavailable", ErrDependencyUnavailable)
	}
	defer res.Body.Close()

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return SyncOpenRouterModelsResult{}, fmt.Errorf("%w: openrouter models returned %d", ErrDependencyUnavailable, res.StatusCode)
	}

	var payload openRouterModelsResponse
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		return SyncOpenRouterModelsResult{}, fmt.Errorf("decode openrouter models: %w", err)
	}

	candidates := filterOpenRouterModels(payload.Data, input)

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return SyncOpenRouterModelsResult{}, err
	}

	result := SyncOpenRouterModelsResult{
		Models: make([]AIModel, 0, len(candidates)),
	}
	for _, candidate := range candidates {
		model, created, err := s.openRouterModelToCatalogModelLocked(candidate, input.ActivateImported)
		if err != nil {
			return SyncOpenRouterModelsResult{}, err
		}
		if created {
			result.Created++
		} else {
			result.Updated++
		}
		s.models[model.ID] = model
		result.Models = append(result.Models, model)
	}
	if input.PurgeUnsupportedProviders {
		result.Purged = s.purgeUnsupportedOpenRouterModelsLocked()
	}
	result.Imported = len(result.Models)

	if err := s.persistLocked(ctx); err != nil {
		return SyncOpenRouterModelsResult{}, err
	}

	sort.Slice(result.Models, func(i, j int) bool { return result.Models[i].Label < result.Models[j].Label })
	return result, nil
}

func (s *Service) CreateModel(ctx context.Context, input CreateAIModelInput) (AIModel, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return AIModel{}, err
	}

	model, err := s.buildModelLocked(
		strings.TrimSpace(input.ID),
		func(candidate *AIModel) {
			candidate.Label = strings.TrimSpace(input.Label)
			candidate.Provider = strings.TrimSpace(input.Provider)
			candidate.Group = strings.TrimSpace(input.Group)
			candidate.IconKey = strings.TrimSpace(input.IconKey)
			candidate.ModelID = strings.TrimSpace(input.ModelID)
			candidate.IsActive = input.IsActive
			candidate.SupportsLiveSearch = input.SupportsLiveSearch
		},
	)
	if err != nil {
		return AIModel{}, err
	}
	if _, exists := s.models[model.ID]; exists {
		return AIModel{}, fmt.Errorf("%w: model id already exists", ErrValidation)
	}
	if err := validateModelUniqueness(s.models, model.ID, model.Provider, model.ModelID); err != nil {
		return AIModel{}, err
	}

	s.models[model.ID] = model
	if err := s.persistLocked(ctx); err != nil {
		delete(s.models, model.ID)
		return AIModel{}, err
	}
	return model, nil
}

func (s *Service) UpdateModel(ctx context.Context, modelID string, input UpdateAIModelInput) (AIModel, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return AIModel{}, err
	}

	modelID = strings.TrimSpace(modelID)
	current, exists := s.models[modelID]
	if !exists {
		return AIModel{}, fmt.Errorf("%w: model", ErrNotFound)
	}
	backup := current

	model, err := s.buildModelLocked(modelID, func(candidate *AIModel) {
		candidate.Label = current.Label
		candidate.Provider = current.Provider
		candidate.Group = current.Group
		candidate.IconKey = current.IconKey
		candidate.ModelID = current.ModelID
		candidate.IsActive = current.IsActive
		candidate.SupportsLiveSearch = current.SupportsLiveSearch
		if input.Label != nil {
			candidate.Label = strings.TrimSpace(*input.Label)
		}
		if input.Provider != nil {
			candidate.Provider = strings.TrimSpace(*input.Provider)
		}
		if input.Group != nil {
			candidate.Group = strings.TrimSpace(*input.Group)
		}
		if input.IconKey != nil {
			candidate.IconKey = strings.TrimSpace(*input.IconKey)
		}
		if input.ModelID != nil {
			candidate.ModelID = strings.TrimSpace(*input.ModelID)
		}
		if input.IsActive != nil {
			candidate.IsActive = *input.IsActive
		}
		if input.SupportsLiveSearch != nil {
			candidate.SupportsLiveSearch = *input.SupportsLiveSearch
		}
		if strings.TrimSpace(candidate.IconKey) == "" {
			candidate.IconKey = openRouterIconKey(candidate.Provider)
		}
	})
	if err != nil {
		return AIModel{}, err
	}
	if err := validateModelUniqueness(s.models, model.ID, model.Provider, model.ModelID); err != nil {
		return AIModel{}, err
	}

	s.models[model.ID] = model
	for _, prompt := range s.prompts {
		if prompt.ProjectID == "" {
			continue
		}
		schedule, scheduleErr := normalizePromptSchedule(
			prompt.Schedule,
			effectivePromptModelIDs(prompt, filterEnabledModels(s.projectModels, s.models, prompt.ProjectID)),
		)
		if scheduleErr != nil {
			s.models[model.ID] = backup
			return AIModel{}, scheduleErr
		}
		prompt.Schedule = schedule
	}
	if err := s.persistLocked(ctx); err != nil {
		s.models[model.ID] = backup
		return AIModel{}, err
	}
	return model, nil
}

func (s *Service) buildModelLocked(modelID string, mutate func(candidate *AIModel)) (AIModel, error) {
	candidate := AIModel{ID: strings.TrimSpace(modelID)}
	mutate(&candidate)
	candidate.IconPath = modelIconPath(candidate.IconKey)

	if candidate.ID == "" {
		return AIModel{}, fmt.Errorf("%w: model id is required", ErrValidation)
	}
	if candidate.Label == "" {
		return AIModel{}, fmt.Errorf("%w: displayName is required", ErrValidation)
	}
	if candidate.Provider == "" {
		return AIModel{}, fmt.Errorf("%w: provider is required", ErrValidation)
	}
	if candidate.Group == "" {
		return AIModel{}, fmt.Errorf("%w: groupName is required", ErrValidation)
	}
	if candidate.IconKey == "" {
		return AIModel{}, fmt.Errorf("%w: iconKey is required", ErrValidation)
	}
	if candidate.ModelID == "" {
		return AIModel{}, fmt.Errorf("%w: providerModelId is required", ErrValidation)
	}

	return candidate, nil
}

func validateModelUniqueness(models map[string]AIModel, modelID, provider, providerModelID string) error {
	for existingID, existing := range models {
		if existingID == modelID {
			continue
		}
		if existing.Provider == provider && existing.ModelID == providerModelID {
			return fmt.Errorf("%w: providerModelId already exists for provider", ErrValidation)
		}
	}
	return nil
}

func modelIconPath(iconKey string) string {
	iconKey = strings.TrimSpace(iconKey)
	if iconKey == "" {
		return ""
	}
	return "/models/" + iconKey + ".svg"
}

func filterOpenRouterModels(models []openRouterModelPayload, input SyncOpenRouterModelsInput) []openRouterModelPayload {
	providers := openRouterProviderPrefixes(input.Providers)
	variant := strings.ToLower(strings.TrimSpace(input.Variant))
	query := strings.ToLower(strings.TrimSpace(input.SearchQuery))

	filtered := make([]openRouterModelPayload, 0, len(models))
	for _, model := range models {
		model.ID = strings.TrimSpace(model.ID)
		model.Name = strings.TrimSpace(model.Name)
		if model.ID == "" {
			continue
		}
		if input.OnlyFree && strings.TrimSpace(model.Pricing["prompt"]) != "0" {
			continue
		}
		if input.MinContext > 0 && model.ContextLength < input.MinContext {
			continue
		}
		if input.SupportsTools && !openRouterSupportsParameter(model.SupportedParameters, "tools") {
			continue
		}
		if !openRouterVariantAllowed(model, variant) {
			continue
		}
		if !openRouterProviderAllowed(model.ID, providers) {
			continue
		}
		if query != "" {
			haystack := strings.ToLower(model.ID + " " + model.Name)
			if !strings.Contains(haystack, query) {
				continue
			}
		}
		filtered = append(filtered, model)
	}
	return filtered
}

func openRouterVariantAllowed(model openRouterModelPayload, variant string) bool {
	switch variant {
	case "", "all":
		return true
	case "instruct":
		return openRouterLooksInstruct(model)
	case "chat":
		return !openRouterLooksInstruct(model)
	default:
		return true
	}
}

func openRouterLooksInstruct(model openRouterModelPayload) bool {
	haystack := strings.ToLower(model.ID + " " + model.Name)
	if strings.Contains(haystack, "instruct") || strings.Contains(haystack, "instruction") {
		return true
	}
	instructType := strings.ToLower(strings.TrimSpace(model.Architecture.InstructType))
	return strings.Contains(instructType, "instruct")
}

func (s *Service) purgeUnsupportedOpenRouterModelsLocked() int {
	purgedModelIDs := make([]string, 0)
	for modelID, model := range s.models {
		if !isUnsupportedOpenRouterCatalogModel(model) {
			continue
		}
		purgedModelIDs = append(purgedModelIDs, modelID)
		delete(s.models, modelID)
	}
	if len(purgedModelIDs) == 0 {
		return 0
	}

	purged := make(map[string]bool, len(purgedModelIDs))
	for _, modelID := range purgedModelIDs {
		purged[modelID] = true
	}
	for projectID, enabledByID := range s.projectModels {
		for modelID := range purged {
			delete(enabledByID, modelID)
		}
		if len(enabledByID) == 0 {
			delete(s.projectModels, projectID)
		}
	}
	for _, prompt := range s.prompts {
		if prompt == nil {
			continue
		}
		filteredModelIDs := prompt.ModelIDs[:0]
		for _, modelID := range prompt.ModelIDs {
			if !purged[modelID] {
				filteredModelIDs = append(filteredModelIDs, modelID)
			}
		}
		prompt.ModelIDs = append([]string(nil), filteredModelIDs...)
		schedule, err := normalizePromptSchedule(
			prompt.Schedule,
			effectivePromptModelIDs(prompt, filterEnabledModels(s.projectModels, s.models, prompt.ProjectID)),
		)
		if err == nil {
			prompt.Schedule = schedule
		}
	}

	return len(purgedModelIDs)
}

func isUnsupportedOpenRouterCatalogModel(model AIModel) bool {
	providerID := strings.TrimSpace(openRouterProviderFromID(model.ModelID))
	if providerID == "" {
		return false
	}
	if _, ok := canonicalOpenRouterProvider(providerID); ok {
		return false
	}
	return model.ID == safeOpenRouterCatalogID(model.ModelID)
}

func openRouterProviderPrefixes(providers []string) []string {
	canonicalProviders := defaultOpenRouterProviderIDs
	if len(providers) > 0 {
		canonicalProviders = make([]string, 0, len(providers))
		seen := make(map[string]bool, len(providers))
		for _, provider := range providers {
			canonical, ok := canonicalOpenRouterProvider(provider)
			if !ok || seen[canonical] {
				continue
			}
			seen[canonical] = true
			canonicalProviders = append(canonicalProviders, canonical)
		}
	}

	prefixes := make([]string, 0, len(canonicalProviders))
	seen := make(map[string]bool)
	for _, provider := range canonicalProviders {
		for _, prefix := range openRouterProviderPrefixesByID[provider] {
			prefix = strings.Trim(strings.ToLower(prefix), "/ ")
			if prefix == "" || seen[prefix] {
				continue
			}
			seen[prefix] = true
			prefixes = append(prefixes, prefix)
		}
	}
	return prefixes
}

func canonicalOpenRouterProvider(provider string) (string, bool) {
	normalized := strings.ToLower(strings.TrimSpace(provider))
	compact := strings.NewReplacer(" ", "", "_", "", "-", "", ".", "").Replace(normalized)
	switch compact {
	case "openai":
		return "openai", true
	case "anthropic", "antropic":
		return "anthropic", true
	case "google", "gemini":
		return "google", true
	case "perplexity":
		return "perplexity", true
	case "qwen":
		return "qwen", true
	case "deepseek":
		return "deepseek", true
	case "mistral", "mistralai":
		return "mistral", true
	case "z", "zai":
		return "zai", true
	case "x", "xai", "grok":
		return "xai", true
	case "groq":
		return "groq", true
	case "copilot":
		return "copilot", true
	case "meta", "metallama":
		return "meta", true
	default:
		return "", false
	}
}

func openRouterSupportsParameter(parameters []string, target string) bool {
	target = strings.ToLower(strings.TrimSpace(target))
	for _, parameter := range parameters {
		if strings.ToLower(strings.TrimSpace(parameter)) == target {
			return true
		}
	}
	return false
}

func openRouterProviderAllowed(modelID string, providers []string) bool {
	modelID = strings.ToLower(strings.TrimSpace(modelID))
	for _, provider := range providers {
		if modelID == provider || strings.HasPrefix(modelID, provider+"/") {
			return true
		}
	}
	return false
}

func (s *Service) openRouterModelToCatalogModelLocked(payload openRouterModelPayload, activateImported bool) (AIModel, bool, error) {
	provider := normalizeOpenRouterProvider(openRouterProviderFromID(payload.ID))
	if provider == "" {
		return AIModel{}, false, fmt.Errorf("%w: openrouter provider is required", ErrValidation)
	}

	modelID := strings.TrimSpace(payload.ID)
	catalogID := safeOpenRouterCatalogID(modelID)
	if catalogID == "" {
		return AIModel{}, false, fmt.Errorf("%w: openrouter model id is required", ErrValidation)
	}

	existingID := catalogID
	created := true
	if existing, ok := s.models[catalogID]; ok {
		created = false
		existingID = existing.ID
	} else if existing, ok := findModelByProviderModelID(s.models, provider, modelID); ok {
		created = false
		existingID = existing.ID
	}

	displayName := openRouterDisplayName(payload.Name, payload.ID)
	groupName := openRouterGroupName(payload.Name, provider)
	iconKey := openRouterIconKey(provider)
	isActive := activateImported
	if existing, ok := s.models[existingID]; ok {
		isActive = existing.IsActive
	}

	model, err := s.buildModelLocked(existingID, func(candidate *AIModel) {
		candidate.Label = displayName
		candidate.Provider = provider
		candidate.Group = groupName
		candidate.IconKey = iconKey
		candidate.ModelID = modelID
		candidate.IsActive = isActive
		candidate.SupportsLiveSearch = openRouterSupportsParameter(payload.SupportedParameters, "tools")
	})
	if err != nil {
		return AIModel{}, false, err
	}
	return model, created, nil
}

func findModelByProviderModelID(models map[string]AIModel, provider, providerModelID string) (AIModel, bool) {
	for _, model := range models {
		if model.Provider == provider && model.ModelID == providerModelID {
			return model, true
		}
	}
	return AIModel{}, false
}

func openRouterProviderFromID(modelID string) string {
	modelID = strings.TrimSpace(modelID)
	if before, _, ok := strings.Cut(modelID, "/"); ok {
		return before
	}
	return ""
}

func normalizeOpenRouterProvider(provider string) string {
	if canonical, ok := canonicalOpenRouterProvider(provider); ok {
		return canonical
	}
	return strings.ToLower(strings.TrimSpace(provider))
}

func openRouterDisplayName(name, modelID string) string {
	name = strings.TrimSpace(name)
	if _, after, ok := strings.Cut(name, ":"); ok && strings.TrimSpace(after) != "" {
		return strings.TrimSpace(after)
	}
	if name != "" {
		return name
	}
	_, after, ok := strings.Cut(strings.TrimSpace(modelID), "/")
	if ok && strings.TrimSpace(after) != "" {
		return strings.TrimSpace(after)
	}
	return strings.TrimSpace(modelID)
}

func openRouterGroupName(name, provider string) string {
	if before, _, ok := strings.Cut(strings.TrimSpace(name), ":"); ok && strings.TrimSpace(before) != "" {
		if canonical, ok := canonicalOpenRouterProvider(before); ok {
			return openRouterProviderLabel(canonical)
		}
		return strings.TrimSpace(before)
	}
	return openRouterProviderLabel(provider)
}

func openRouterProviderLabel(provider string) string {
	switch normalizeOpenRouterProvider(provider) {
	case "openai":
		return "OpenAI"
	case "anthropic":
		return "Anthropic"
	case "google":
		return "Google Gemini"
	case "perplexity":
		return "Perplexity"
	case "qwen":
		return "Qwen"
	case "mistral":
		return "Mistral AI"
	case "deepseek":
		return "DeepSeek"
	case "zai":
		return "Z.ai"
	case "groq":
		return "Groq"
	case "xai":
		return "Grok"
	case "copilot":
		return "Microsoft Copilot"
	case "meta":
		return "Meta"
	default:
		provider = normalizeOpenRouterProvider(provider)
		if provider == "" {
			return "OpenRouter"
		}
		return strings.ToUpper(provider[:1]) + provider[1:]
	}
}

func openRouterIconKey(provider string) string {
	switch provider {
	case "anthropic", "deepseek", "google", "groq", "mistral", "openai", "openrouter", "perplexity", "xai", "zai":
		return provider
	case "qwen":
		return "qwen"
	case "x-ai":
		return "xai"
	case "meta":
		return "meta"
	default:
		return "openrouter"
	}
}

func safeOpenRouterCatalogID(modelID string) string {
	var builder strings.Builder
	lastDash := false
	for _, char := range strings.ToLower(strings.TrimSpace(modelID)) {
		if (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') {
			builder.WriteRune(char)
			lastDash = false
			continue
		}
		if !lastDash {
			builder.WriteByte('-')
			lastDash = true
		}
	}
	return strings.Trim(builder.String(), "-")
}
