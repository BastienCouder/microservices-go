package usecase

import (
	"context"
	"fmt"
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
	if _, ok := s.supportedModels[modelID]; !ok {
		return ExecutePromptResult{}, fmt.Errorf("%w: %s", ErrUnknownModel, modelID)
	}

	start := time.Now()

	response := strings.TrimSpace(input.MockResponse)
	tokensUsed := 0
	if response == "" {
		switch s.mode {
		case ExecutionModeProvider:
			providerPrompt := buildProviderPrompt(promptText, strings.TrimSpace(input.BrandName), input.Competitors)
			result, err := s.provider.Generate(ctx, ProviderGenerateInput{
				ProviderID: strings.TrimSpace(input.ProviderID),
				ModelID:    modelID,
				APIKey:     strings.TrimSpace(input.ProviderAPIKey),
				Prompt:     providerPrompt,
			})
			if err != nil {
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
