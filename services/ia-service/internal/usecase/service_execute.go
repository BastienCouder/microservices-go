package usecase

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"
)

func (s *Service) ExecutePrompt(ctx context.Context, input ExecutePromptInput) (ExecutePromptResult, error) {
	promptID := strings.TrimSpace(input.PromptID)
	promptText := strings.TrimSpace(input.PromptText)
	modelID := strings.TrimSpace(input.ModelID)
	if promptID == "" || promptText == "" || modelID == "" {
		return ExecutePromptResult{}, fmt.Errorf("%w: promptId, promptText and modelId are required", ErrValidation)
	}
	if !s.isSupportedModel(modelID, strings.TrimSpace(input.ProviderID)) {
		return ExecutePromptResult{}, fmt.Errorf("%w: %s", ErrUnknownModel, modelID)
	}

	start := time.Now()
	log.Printf(
		"ia_prompt.execute_start prompt_id=%s model_id=%s provider_id=%s mode=%s prompt_chars=%d competitors=%d",
		promptID,
		modelID,
		strings.TrimSpace(input.ProviderID),
		s.mode,
		len(promptText),
		len(input.Competitors),
	)

	response := strings.TrimSpace(input.MockResponse)
	tokensUsed := 0
	if response == "" {
		switch s.mode {
		case ExecutionModeProvider:
			providerPrompt := buildProviderPrompt(input.PromptMode, promptText, strings.TrimSpace(input.BrandName), input.Competitors)
			if isStructuredProviderPrompt(promptID) {
				providerPrompt = promptText
			}
			result, err := s.provider.Generate(ctx, ProviderGenerateInput{
				ProviderID: strings.TrimSpace(input.ProviderID),
				ModelID:    modelID,
				APIKey:     strings.TrimSpace(input.ProviderAPIKey),
				Prompt:     providerPrompt,
			})
			if err != nil {
				log.Printf(
					"ia_prompt.execute_failed prompt_id=%s model_id=%s provider_id=%s mode=%s duration_ms=%d error=%v",
					promptID,
					modelID,
					strings.TrimSpace(input.ProviderID),
					s.mode,
					time.Since(start).Milliseconds(),
					err,
				)
				return ExecutePromptResult{}, fmt.Errorf("execute prompt with provider: %w", err)
			}
			response = strings.TrimSpace(result.RawResponse)
			tokensUsed = result.TokensUsed
		case ExecutionModeMock:
			response = s.buildSyntheticResponse(promptText, strings.TrimSpace(input.BrandName), input.Competitors)
		default:
			return ExecutePromptResult{}, fmt.Errorf("%w: unsupported execution mode", ErrValidation)
		}
	}
	if response == "" {
		log.Printf(
			"ia_prompt.execute_empty prompt_id=%s model_id=%s provider_id=%s mode=%s duration_ms=%d",
			promptID,
			modelID,
			strings.TrimSpace(input.ProviderID),
			s.mode,
			time.Since(start).Milliseconds(),
		)
		return ExecutePromptResult{}, fmt.Errorf("%w: empty model response", ErrValidation)
	}

	analysis := analyzeResponse(response, strings.TrimSpace(input.BrandName), input.Competitors)
	latencyMs := int(time.Since(start).Milliseconds())
	if latencyMs < 1 {
		latencyMs = 1
	}
	if tokensUsed <= 0 {
		tokensUsed = len(strings.Fields(response))
	}

	log.Printf(
		"ia_prompt.execute_completed prompt_id=%s model_id=%s provider_id=%s mode=%s duration_ms=%d tokens=%d response_chars=%d brand_mentioned=%t brand_position=%s citation_found=%t sentiment=%s",
		promptID,
		modelID,
		strings.TrimSpace(input.ProviderID),
		s.mode,
		latencyMs,
		tokensUsed,
		len(response),
		analysis.BrandMentioned,
		analysis.BrandPosition,
		analysis.CitationFound,
		analysis.Sentiment,
	)

	return ExecutePromptResult{
		PromptID:    promptID,
		ModelID:     modelID,
		RawResponse: response,
		RawMetadata: PromptExecutionMetadata{
			TokensUsed: tokensUsed,
			LatencyMs:  latencyMs,
		},
		Analysis: analysis,
	}, nil
}

func (s *Service) isSupportedModel(modelID, providerID string) bool {
	if _, ok := s.supportedModels[modelID]; ok {
		return true
	}

	normalizedProviderID := strings.ToLower(strings.TrimSpace(providerID))
	if normalizedProviderID == "" || normalizedProviderID == "openrouter" {
		return strings.Contains(strings.TrimSpace(modelID), "/")
	}

	return false
}

func isStructuredProviderPrompt(promptID string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(promptID)), "content-optimizer-")
}

func (s *Service) ExtractBrand(_ context.Context, input ExtractBrandInput) (ExtractBrandResult, error) {
	projectID := strings.TrimSpace(input.ProjectID)
	websiteURL := strings.TrimSpace(input.WebsiteURL)
	if projectID == "" || websiteURL == "" {
		return ExtractBrandResult{}, fmt.Errorf("%w: projectId and websiteUrl are required", ErrValidation)
	}

	brandName := deriveBrandName(websiteURL)
	country, language := inferLocale(websiteURL)

	return ExtractBrandResult{
		ProjectID:        projectID,
		BrandName:        brandName,
		BrandDescription: fmt.Sprintf("%s propose une plateforme SaaS orientee croissance B2B.", brandName),
		Industry:         "B2B SaaS",
		Keywords: []string{
			strings.ToLower(brandName),
			"monitoring ia",
			"brand visibility",
			"competitive analysis",
			"content optimization",
		},
		Language: language,
		Country:  country,
	}, nil
}
