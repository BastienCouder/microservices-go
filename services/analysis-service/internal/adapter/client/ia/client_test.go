package ia

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/usecase"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func TestAnalyzeContentIssuesCallsIAServiceAndParsesJSONIssues(t *testing.T) {
	var captured struct {
		Path          string
		Authorization string
		PromptText    string `json:"promptText"`
		ModelID       string `json:"modelId"`
		ProviderID    string `json:"providerId"`
	}

	httpClient := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		captured.Path = req.URL.Path
		captured.Authorization = req.Header.Get("Authorization")
		var body struct {
			PromptText string `json:"promptText"`
			ModelID    string `json:"modelId"`
			ProviderID string `json:"providerId"`
		}
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		captured.PromptText = body.PromptText
		captured.ModelID = body.ModelID
		captured.ProviderID = body.ProviderID

		raw, err := json.Marshal(map[string]any{
			"success": true,
			"data": map[string]any{
				"rawResponse": `{"issues":[{"category":"geo","severity":"high","title":"Intent incomplet","description":"La page ignore les objections.","recommendation":"Ajouter une section objections et criteres.","fixType":"ai_add_intent_coverage"}]}`,
			},
		})
		if err != nil {
			t.Fatalf("marshal response: %v", err)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(bytes.NewReader(raw)),
		}, nil
	})}

	client, err := NewClient(Config{
		BaseURL:    "http://ia-service.test",
		JWTSecret:  "secret",
		JWTIssuer:  "issuer",
		ModelID:    "gpt-oss-20b-free",
		HTTPClient: httpClient,
	})
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	issues, err := client.AnalyzeContentIssues(context.Background(), usecase.ContentIssueAnalysisInput{
		ProjectID:      "project-1",
		OrganizationID: 42,
		Record: usecase.ContentOptimizerCrawlRecord{
			URL:      "https://example.com/pricing",
			Title:    "Pricing",
			Markdown: "# Pricing\nShort page.",
		},
		DeterministicIssues: []usecase.ContentOptimizerIssue{{
			FixType: "expand_content",
			Title:   "Contenu trop court",
		}},
	})
	if err != nil {
		t.Fatalf("analyze content issues: %v", err)
	}

	if captured.Path != "/ai/execute" {
		t.Fatalf("expected /ai/execute, got %q", captured.Path)
	}
	if !strings.HasPrefix(captured.Authorization, "Bearer ") {
		t.Fatalf("expected bearer authorization, got %q", captured.Authorization)
	}
	if captured.ModelID != "gpt-oss-20b-free" {
		t.Fatalf("expected model id, got %q", captured.ModelID)
	}
	if captured.ProviderID != "openrouter" {
		t.Fatalf("expected openrouter provider, got %q", captured.ProviderID)
	}
	if !strings.Contains(captured.PromptText, "https://example.com/pricing") ||
		!strings.Contains(captured.PromptText, "expand_content") {
		t.Fatalf("expected prompt to include page and deterministic context, got %q", captured.PromptText)
	}
	if len(issues) != 1 || issues[0].FixType != "ai_add_intent_coverage" {
		t.Fatalf("expected parsed AI issue, got %#v", issues)
	}
	if issues[0].Source != "ai" {
		t.Fatalf("expected AI issue source, got %#v", issues[0])
	}
}

func TestGenerateOptimizeActionBriefUsesZAIModelOnOpenRouterByDefault(t *testing.T) {
	var captured struct {
		Path       string
		PromptText string
		ModelID    string
		ProviderID string
	}

	httpClient := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		captured.Path = req.URL.Path
		var body struct {
			PromptText string `json:"promptText"`
			ModelID    string `json:"modelId"`
			ProviderID string `json:"providerId"`
		}
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		captured.PromptText = body.PromptText
		captured.ModelID = body.ModelID
		captured.ProviderID = body.ProviderID

		raw, err := json.Marshal(map[string]any{
			"success": true,
			"data": map[string]any{
				"rawResponse": "Objectif\nClarifier la page.\n\nBlocs prets a appliquer\n- FAQ: expliquer la categorie.",
			},
		})
		if err != nil {
			t.Fatalf("marshal response: %v", err)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(bytes.NewReader(raw)),
		}, nil
	})}

	client, err := NewClient(Config{
		BaseURL:    "http://ia-service.test",
		JWTSecret:  "secret",
		JWTIssuer:  "issuer",
		ModelID:    "gpt-oss-20b-free",
		HTTPClient: httpClient,
	})
	if err != nil {
		t.Fatalf("new client: %v", err)
	}

	brief, err := client.GenerateOptimizeActionBrief(context.Background(), usecase.OptimizeActionBriefInput{
		ProjectID:        "project-1",
		OrganizationID:   42,
		Priority:         "high",
		Type:             "website_copy",
		Title:            "Clarifier la promesse",
		Issue:            "Les IA classent mal la marque.",
		GeneratedContent: "Suggestion initiale.",
		Source:           "perception",
		DetectedInModels: []string{"z-ai/glm-4.5-air:free"},
	})
	if err != nil {
		t.Fatalf("generate optimize action brief: %v", err)
	}

	if captured.Path != "/ai/execute" {
		t.Fatalf("expected /ai/execute, got %q", captured.Path)
	}
	if captured.ModelID != "z-ai/glm-4.5-air:free" {
		t.Fatalf("expected model id, got %q", captured.ModelID)
	}
	if captured.ProviderID != "openrouter" {
		t.Fatalf("expected openrouter provider, got %q", captured.ProviderID)
	}
	if !strings.Contains(captured.PromptText, "Clarifier la promesse") ||
		!strings.Contains(captured.PromptText, "Blocs prets a appliquer") {
		t.Fatalf("expected prompt to include action context and format, got %q", captured.PromptText)
	}
	if !strings.Contains(brief, "Objectif") {
		t.Fatalf("expected returned brief, got %q", brief)
	}
}
