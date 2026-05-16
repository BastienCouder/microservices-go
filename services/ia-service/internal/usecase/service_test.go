package usecase

import (
	"context"
	"errors"
	"testing"
)

type stubProvider struct {
	result ProviderResult
	err    error
	called bool
	input  ProviderGenerateInput
}

func (s *stubProvider) Generate(_ context.Context, input ProviderGenerateInput) (ProviderResult, error) {
	s.called = true
	s.input = input
	if s.err != nil {
		return ProviderResult{}, s.err
	}
	return s.result, nil
}

func TestExecutePromptAnalyzesResponse(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	result, err := svc.ExecutePrompt(ctx, ExecutePromptInput{
		PromptID:     "prompt-1",
		PromptText:   "Quel CRM pour PME ?",
		ModelID:      "gpt-oss-20b-free",
		BrandName:    "Acme",
		Competitors:  []string{"HubSpot", "Pipedrive"},
		MockResponse: "Acme est une excellente option face a HubSpot. Voir https://acme.com",
	})
	if err != nil {
		t.Fatalf("execute prompt: %v", err)
	}

	if !result.Analysis.BrandMentioned {
		t.Fatalf("expected brand mentioned")
	}
	if !result.Analysis.CitationFound {
		t.Fatalf("expected citation found")
	}
	if result.Analysis.Sentiment != "positive" {
		t.Fatalf("expected positive sentiment, got %q", result.Analysis.Sentiment)
	}
}

func TestExecutePromptProviderMode(t *testing.T) {
	provider := &stubProvider{result: ProviderResult{RawResponse: "Acme est recommande https://acme.com", TokensUsed: 123}}
	svc, err := NewServiceWithDependencies(Dependencies{Mode: ExecutionModeProvider, Provider: provider})
	if err != nil {
		t.Fatalf("new service with provider: %v", err)
	}

	result, err := svc.ExecutePrompt(context.Background(), ExecutePromptInput{
		PromptID:       "prompt-1",
		PromptText:     "Meilleur CRM",
		ModelID:        "gpt-oss-20b-free",
		ProviderID:     "openrouter",
		ProviderAPIKey: "sk-project",
		BrandName:      "Acme",
		Competitors:    []string{"HubSpot"},
	})
	if err != nil {
		t.Fatalf("execute prompt in provider mode: %v", err)
	}
	if !provider.called {
		t.Fatalf("expected provider to be called")
	}
	if result.RawMetadata.TokensUsed != 123 {
		t.Fatalf("expected provider token count 123, got %d", result.RawMetadata.TokensUsed)
	}
	if provider.input.ProviderID != "openrouter" {
		t.Fatalf("expected provider id openrouter, got %q", provider.input.ProviderID)
	}
	if provider.input.APIKey != "sk-project" {
		t.Fatalf("expected provider api key to be forwarded")
	}
}

func TestExecutePromptProviderModeKeepsContentOptimizerAuditPromptStructured(t *testing.T) {
	provider := &stubProvider{result: ProviderResult{RawResponse: `{"issues":[]}`, TokensUsed: 42}}
	svc, err := NewServiceWithDependencies(Dependencies{Mode: ExecutionModeProvider, Provider: provider})
	if err != nil {
		t.Fatalf("new service with provider: %v", err)
	}

	prompt := `Retourne uniquement {"issues":[]}`
	_, err = svc.ExecutePrompt(context.Background(), ExecutePromptInput{
		PromptID:   "content-optimizer-page-audit",
		PromptText: prompt,
		ModelID:    "gpt-oss-20b-free",
		ProviderID: "openrouter",
	})
	if err != nil {
		t.Fatalf("execute prompt in provider mode: %v", err)
	}
	if provider.input.Prompt != prompt {
		t.Fatalf("expected structured audit prompt to be sent unchanged, got %q", provider.input.Prompt)
	}
}

func TestExecutePromptSupportsProjectCatalogModels(t *testing.T) {
	t.Parallel()

	svc := NewService()
	modelIDs := []string{
		"gpt-oss-20b-free",
		"gpt-oss-120b-free",
		"gpt-4o",
		"claude-3-5-sonnet",
		"gemini-2.0-flash",
		"gemma-3-4b-free",
		"gemma-3-27b-free",
		"sonar",
		"sonar-pro",
		"mistral-large",
	}

	for _, modelID := range modelIDs {
		modelID := modelID
		t.Run(modelID, func(t *testing.T) {
			t.Parallel()

			result, err := svc.ExecutePrompt(context.Background(), ExecutePromptInput{
				PromptID:     "prompt-1",
				PromptText:   "Test",
				ModelID:      modelID,
				BrandName:    "Acme",
				MockResponse: "Acme est visible",
			})
			if err != nil {
				t.Fatalf("execute prompt: %v", err)
			}
			if result.ModelID != modelID {
				t.Fatalf("expected model id %q, got %q", modelID, result.ModelID)
			}
		})
	}
}

func TestExtractBrandFromURL(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	result, err := svc.ExtractBrand(ctx, ExtractBrandInput{
		ProjectID:  "project-1",
		WebsiteURL: "https://www.acme.io",
	})
	if err != nil {
		t.Fatalf("extract brand: %v", err)
	}
	if result.BrandName != "Acme" {
		t.Fatalf("expected brand name Acme, got %q", result.BrandName)
	}
}

func TestExecutePromptRejectsUnknownModel(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	_, err := svc.ExecutePrompt(ctx, ExecutePromptInput{
		PromptID:   "prompt-1",
		PromptText: "Test",
		ModelID:    "unknown",
	})
	if !errors.Is(err, ErrUnknownModel) {
		t.Fatalf("expected unknown model error, got %v", err)
	}
}
