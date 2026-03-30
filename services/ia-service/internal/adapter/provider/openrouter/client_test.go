package openrouter

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGenerateMapsInternalModelIDsAndSetsOpenRouterHeaders(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Fatalf("expected /chat/completions path, got %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Fatalf("expected bearer auth header, got %q", got)
		}
		if got := r.Header.Get("HTTP-Referer"); got != "https://microservices-go.local" {
			t.Fatalf("expected HTTP-Referer header, got %q", got)
		}
		if got := r.Header.Get("X-Title"); got != "microservices-go" {
			t.Fatalf("expected X-Title header, got %q", got)
		}

		var payload chatCompletionRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if payload.Model != "openai/gpt-oss-20b:free" {
			t.Fatalf("expected mapped model id, got %q", payload.Model)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"Acme est visible"}}],"usage":{"total_tokens":42}}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key", "https://microservices-go.local", "microservices-go", server.Client())

	result, err := client.Generate(context.Background(), "gpt-oss-20b-free", "Analyse la marque")
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	if result.RawResponse != "Acme est visible" {
		t.Fatalf("expected response content, got %q", result.RawResponse)
	}
	if result.TokensUsed != 42 {
		t.Fatalf("expected 42 tokens, got %d", result.TokensUsed)
	}
}

func TestGenerateReturnsProviderErrorMessage(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":{"message":"model is unavailable"}}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "test-key", "", "", server.Client())

	_, err := client.Generate(context.Background(), "gpt-4o-mini", "Analyse la marque")
	if err == nil {
		t.Fatalf("expected provider error")
	}
	if !strings.Contains(err.Error(), "model is unavailable") {
		t.Fatalf("expected provider error message, got %v", err)
	}
}

func TestResolveModelIDSupportsProjectCatalog(t *testing.T) {
	t.Parallel()

	cases := map[string]string{
		"gpt-4o-mini":       "openai/gpt-4o-mini",
		"gpt-4o":            "openai/gpt-4o",
		"gpt-oss-20b-free":  "openai/gpt-oss-20b:free",
		"gpt-oss-120b-free": "openai/gpt-oss-120b:free",
		"claude-3-5-sonnet": "anthropic/claude-3.5-sonnet",
		"gemini-2.0-flash":  "google/gemini-2.0-flash-001",
		"gemma-3-4b-free":   "google/gemma-3-4b-it:free",
		"gemma-3-27b-free":  "google/gemma-3-27b-it:free",
		"sonar":             "perplexity/sonar",
		"sonar-pro":         "perplexity/sonar-pro",
		"mistral-large":     "mistralai/mistral-large",
	}

	for input, want := range cases {
		if got := resolveModelID(input); got != want {
			t.Fatalf("expected %s for %s, got %s", want, input, got)
		}
	}
}
