package router

import (
	"context"
	"fmt"
	"strings"

	"github.com/bastiencouder/microservices-go/services/ia-service/internal/usecase"
)

type Router struct {
	providers map[string]usecase.PromptProvider
	fallback  usecase.PromptProvider
}

func New(providers map[string]usecase.PromptProvider, fallback usecase.PromptProvider) *Router {
	normalized := make(map[string]usecase.PromptProvider, len(providers))
	for providerID, provider := range providers {
		if provider == nil {
			continue
		}
		normalized[normalizeProviderID(providerID)] = provider
	}
	return &Router{providers: normalized, fallback: fallback}
}

func (r *Router) Generate(ctx context.Context, input usecase.ProviderGenerateInput) (usecase.ProviderResult, error) {
	providerID := normalizeProviderID(input.ProviderID)
	if providerID == "" || providerID == "openrouter" {
		if r.fallback == nil {
			return usecase.ProviderResult{}, fmt.Errorf("openrouter provider is not configured")
		}
		input.ProviderID = "openrouter"
		return r.fallback.Generate(ctx, input)
	}

	provider, ok := r.providers[providerID]
	if !ok {
		return usecase.ProviderResult{}, fmt.Errorf("provider %s is not supported by ia-service", providerID)
	}

	input.ProviderID = providerID
	input.ModelID = directProviderModelID(providerID, input.ModelID)
	return provider.Generate(ctx, input)
}

func normalizeProviderID(providerID string) string {
	normalized := strings.TrimSpace(strings.ToLower(providerID))
	compact := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(normalized, "-", ""), "_", ""), ".", "")
	switch compact {
	case "gemini":
		return "google"
	case "mistralai":
		return "mistral"
	case "grok", "x":
		return "xai"
	case "z", "zai":
		return "zai"
	default:
		return normalized
	}
}

func directProviderModelID(providerID, modelID string) string {
	normalized := strings.TrimSpace(modelID)
	if before, after, ok := strings.Cut(normalized, "/"); ok && normalizeProviderID(before) == providerID {
		normalized = after
	}
	if before, _, ok := strings.Cut(normalized, ":"); ok {
		normalized = before
	}
	return strings.TrimSpace(normalized)
}
