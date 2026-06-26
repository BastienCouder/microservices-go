package usecase

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

var (
	openRouterModelsURL = "https://openrouter.ai/api/v1/models"
	openRouterClient    = &http.Client{Timeout: 20 * time.Second}
)

var defaultOpenRouterProviderIDs = []string{
	"openai", "anthropic", "google", "perplexity", "qwen", "deepseek", "mistral", "zai", "xai", "groq", "copilot", "meta",
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

type openRouterModelsResponse struct {
	Data []openRouterModelPayload `json:"data"`
}

type openRouterModelPayload struct {
	ID                  string                        `json:"id"`
	Name                string                        `json:"name"`
	ContextLength       int                           `json:"context_length"`
	Architecture        openRouterArchitecturePayload `json:"architecture"`
	Pricing             map[string]any                `json:"pricing"`
	SupportedParameters []string                      `json:"supported_parameters"`
}

type openRouterArchitecturePayload struct {
	InstructType string `json:"instruct_type"`
}

func (s *Service) ListModels(ctx context.Context, onlyActive bool) ([]AIModel, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.loadCatalog(ctx); err != nil {
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

func (s *Service) SeedDefaultModels(ctx context.Context) ([]AIModel, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.loadCatalog(ctx); err != nil {
		return nil, err
	}
	s.seedDefaultModels()
	if err := s.persistCatalog(ctx); err != nil {
		return nil, err
	}
	return sortedModels(s.models), nil
}

func (s *Service) CreateModel(ctx context.Context, input CreateAIModelInput) (AIModel, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.loadCatalog(ctx); err != nil {
		return AIModel{}, err
	}
	model, err := s.buildModel(strings.TrimSpace(input.ID), func(candidate *AIModel) {
		candidate.Label = strings.TrimSpace(input.Label)
		candidate.Provider = strings.TrimSpace(input.Provider)
		candidate.Group = strings.TrimSpace(input.Group)
		candidate.IconKey = strings.TrimSpace(input.IconKey)
		candidate.ModelID = strings.TrimSpace(input.ModelID)
		candidate.IsActive = input.IsActive
		candidate.SupportsLiveSearch = input.SupportsLiveSearch
	})
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
	if err := s.persistCatalog(ctx); err != nil {
		delete(s.models, model.ID)
		return AIModel{}, err
	}
	return model, nil
}

func (s *Service) UpdateModel(ctx context.Context, modelID string, input UpdateAIModelInput) (AIModel, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.loadCatalog(ctx); err != nil {
		return AIModel{}, err
	}
	modelID = strings.TrimSpace(modelID)
	current, exists := s.models[modelID]
	if !exists {
		return AIModel{}, fmt.Errorf("%w: model", ErrUnknownModel)
	}
	backup := current
	model, err := s.buildModel(modelID, func(candidate *AIModel) {
		*candidate = current
		candidate.OpenRouterPricing = cloneOpenRouterPricing(current.OpenRouterPricing)
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
	if err := s.persistCatalog(ctx); err != nil {
		s.models[model.ID] = backup
		return AIModel{}, err
	}
	return model, nil
}

func (s *Service) SyncOpenRouterModels(ctx context.Context, input SyncOpenRouterModelsInput) (SyncOpenRouterModelsResult, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, openRouterModelsURL, nil)
	if err != nil {
		return SyncOpenRouterModelsResult{}, fmt.Errorf("create openrouter models request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	res, err := openRouterClient.Do(req)
	if err != nil {
		return SyncOpenRouterModelsResult{}, fmt.Errorf("openrouter models unavailable: %w", err)
	}
	defer func() {
		_ = res.Body.Close()
	}()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return SyncOpenRouterModelsResult{}, fmt.Errorf("openrouter models returned %d", res.StatusCode)
	}

	var payload openRouterModelsResponse
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		return SyncOpenRouterModelsResult{}, fmt.Errorf("decode openrouter models: %w", err)
	}
	candidates := filterOpenRouterModels(payload.Data, input)

	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.loadCatalog(ctx); err != nil {
		return SyncOpenRouterModelsResult{}, err
	}

	result := SyncOpenRouterModelsResult{Models: make([]AIModel, 0, len(candidates))}
	seenProviderModelIDs := make(map[string]struct{}, len(candidates))
	for _, candidate := range candidates {
		seenProviderModelIDs[strings.TrimSpace(candidate.ID)] = struct{}{}
		model, created, err := s.openRouterModelToCatalogModel(candidate, input.ActivateImported)
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
		result.Purged = s.purgeUnsupportedOpenRouterModels()
	}
	if input.PurgeMissingModels {
		result.Purged += s.purgeMissingOpenRouterModels(seenProviderModelIDs)
	}
	result.Imported = len(result.Models)
	if err := s.persistCatalog(ctx); err != nil {
		return SyncOpenRouterModelsResult{}, err
	}
	sort.Slice(result.Models, func(i, j int) bool { return result.Models[i].Label < result.Models[j].Label })
	return result, nil
}

func sortedModels(models map[string]AIModel) []AIModel {
	out := make([]AIModel, 0, len(models))
	for _, model := range models {
		out = append(out, model)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Label < out[j].Label })
	return out
}

func (s *Service) buildModel(modelID string, mutate func(candidate *AIModel)) (AIModel, error) {
	candidate := AIModel{ID: strings.TrimSpace(modelID), CreditCost: 1}
	mutate(&candidate)
	candidate.Source = normalizeAIModelSource(candidate)
	candidate.IconPath = modelIconPath(candidate.IconKey)
	if candidate.CreditCost <= 0 {
		candidate.CreditCost = 1
	}
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

func normalizeAIModelSource(model AIModel) string {
	source := strings.ToLower(strings.TrimSpace(model.Source))
	if source == AIModelSourceOpenRouter || source == AIModelSourceManual {
		return source
	}
	if isOpenRouterCatalogImport(model) {
		return AIModelSourceOpenRouter
	}
	return AIModelSourceManual
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
		if input.OnlyFree && !openRouterModelIsFree(model) {
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
		if query != "" && !strings.Contains(strings.ToLower(model.ID+" "+model.Name), query) {
			continue
		}
		filtered = append(filtered, model)
	}
	return filtered
}

func openRouterModelIsFree(model openRouterModelPayload) bool {
	if strings.Contains(strings.ToLower(strings.TrimSpace(model.ID)), ":free") {
		return true
	}
	input, okInput := openRouterPricePerMillionOK(model.Pricing, "input", "prompt")
	output, okOutput := openRouterPricePerMillionOK(model.Pricing, "output", "completion")
	return okInput && okOutput && input != nil && output != nil && *input == 0 && *output == 0
}

func parseOpenRouterPrice(raw any) (float64, bool) {
	switch value := raw.(type) {
	case string:
		value = strings.TrimSpace(value)
		if value == "" {
			return 0, false
		}
		parsed, err := strconv.ParseFloat(value, 64)
		if err != nil {
			return 0, false
		}
		return parsed, true
	case float64:
		return value, value == value && value >= 0
	case int:
		return float64(value), true
	default:
		return 0, false
	}
}

func openRouterPricePerMillionOK(pricing map[string]any, keys ...string) (*float64, bool) {
	for _, key := range keys {
		pricePerToken, ok := parseOpenRouterPrice(pricing[key])
		if ok {
			value := pricePerToken * 1_000_000
			return &value, true
		}
	}
	return nil, false
}

func openRouterPricingPerMillion(pricing map[string]any) (*float64, *float64) {
	input, _ := openRouterPricePerMillionOK(pricing, "input", "prompt")
	output, _ := openRouterPricePerMillionOK(pricing, "output", "completion")
	return input, output
}

func openRouterCreditCostFromPricing(pricing map[string]any) int {
	input, output := openRouterPricingPerMillion(pricing)
	price := 0.0
	if input != nil {
		price = *input
	}
	if price <= 0 && output != nil {
		price = *output
	}
	switch {
	case price >= 20:
		return 4
	case price >= 10:
		return 3
	case price >= 5:
		return 2
	default:
		return 1
	}
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
	return strings.Contains(strings.ToLower(strings.TrimSpace(model.Architecture.InstructType)), "instruct")
}

func (s *Service) purgeUnsupportedOpenRouterModels() int {
	ids := make([]string, 0)
	for modelID, model := range s.models {
		if isUnsupportedOpenRouterCatalogModel(model) {
			ids = append(ids, modelID)
		}
	}
	return s.purgeModelIDs(ids)
}

func (s *Service) purgeMissingOpenRouterModels(seenProviderModelIDs map[string]struct{}) int {
	ids := make([]string, 0)
	for modelID, model := range s.models {
		if !isOpenRouterCatalogImport(model) {
			continue
		}
		if _, ok := seenProviderModelIDs[strings.TrimSpace(model.ModelID)]; !ok {
			ids = append(ids, modelID)
		}
	}
	return s.purgeModelIDs(ids)
}

func (s *Service) purgeModelIDs(ids []string) int {
	for _, id := range ids {
		delete(s.models, id)
	}
	return len(ids)
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

func isOpenRouterCatalogImport(model AIModel) bool {
	providerID := strings.TrimSpace(openRouterProviderFromID(model.ModelID))
	return providerID != "" && model.ID == safeOpenRouterCatalogID(model.ModelID)
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
	compact := strings.NewReplacer(" ", "", "_", "", "-", "", ".", "").Replace(strings.ToLower(strings.TrimSpace(provider)))
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

func (s *Service) openRouterModelToCatalogModel(payload openRouterModelPayload, activateImported bool) (AIModel, bool, error) {
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
	inputPrice, outputPrice := openRouterPricingPerMillion(payload.Pricing)
	isActive := activateImported
	if existing, ok := s.models[existingID]; ok {
		isActive = existing.IsActive
	}
	model, err := s.buildModel(existingID, func(candidate *AIModel) {
		candidate.Label = openRouterDisplayName(payload.Name, payload.ID)
		candidate.Provider = provider
		candidate.Group = openRouterGroupName(payload.Name, provider)
		candidate.IconKey = openRouterIconKey(provider)
		candidate.ModelID = modelID
		candidate.Source = AIModelSourceOpenRouter
		candidate.IsActive = isActive
		candidate.SupportsLiveSearch = openRouterSupportsParameter(payload.SupportedParameters, "tools")
		candidate.CreditCost = openRouterCreditCostFromPricing(payload.Pricing)
		candidate.InputPricePerMillion = inputPrice
		candidate.OutputPricePerMillion = outputPrice
		candidate.OpenRouterPricing = cloneOpenRouterPricing(payload.Pricing)
	})
	if err != nil {
		return AIModel{}, false, err
	}
	return model, created, nil
}

func cloneOpenRouterPricing(pricing map[string]any) map[string]any {
	if len(pricing) == 0 {
		return nil
	}
	clone := make(map[string]any, len(pricing))
	for key, value := range pricing {
		clone[key] = value
	}
	return clone
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
	if before, _, ok := strings.Cut(strings.TrimSpace(modelID), "/"); ok {
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
	if _, after, ok := strings.Cut(strings.TrimSpace(modelID), "/"); ok && strings.TrimSpace(after) != "" {
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
