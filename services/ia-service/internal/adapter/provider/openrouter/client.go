package openrouter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/bastiencouder/microservices-go/services/ia-service/internal/usecase"
)

const defaultBaseURL = "https://openrouter.ai/api/v1"

var modelAliases = map[string]string{
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

type Client struct {
	baseURL     string
	apiKey      string
	httpReferer string
	appName     string
	http        *http.Client
}

type chatCompletionRequest struct {
	Model       string  `json:"model"`
	Temperature float64 `json:"temperature"`
	Messages    []struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	} `json:"messages"`
}

type chatCompletionResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Usage struct {
		TotalTokens int `json:"total_tokens"`
	} `json:"usage"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func NewClient(baseURL, apiKey, httpReferer, appName string, httpClient *http.Client) *Client {
	resolvedBaseURL := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if resolvedBaseURL == "" {
		resolvedBaseURL = defaultBaseURL
	}

	return &Client{
		baseURL:     resolvedBaseURL,
		apiKey:      strings.TrimSpace(apiKey),
		httpReferer: strings.TrimSpace(httpReferer),
		appName:     strings.TrimSpace(appName),
		http:        httpClient,
	}
}

func (c *Client) Generate(ctx context.Context, input usecase.ProviderGenerateInput) (usecase.ProviderResult, error) {
	apiKey := strings.TrimSpace(input.APIKey)
	if apiKey == "" {
		apiKey = c.apiKey
	}
	if apiKey == "" {
		return usecase.ProviderResult{}, fmt.Errorf("provider api key is required")
	}

	requestBody := chatCompletionRequest{
		Model:       resolveModelID(input.ModelID),
		Temperature: 0.2,
		Messages: []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		}{
			{Role: "system", Content: "You are an assistant specialized in brand visibility analysis. Provide concise factual answers."},
			{Role: "user", Content: input.Prompt},
		},
	}

	payload, err := json.Marshal(requestBody)
	if err != nil {
		return usecase.ProviderResult{}, fmt.Errorf("encode provider request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return usecase.ProviderResult{}, fmt.Errorf("create provider request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	if c.httpReferer != "" {
		req.Header.Set("HTTP-Referer", c.httpReferer)
	}
	if c.appName != "" {
		req.Header.Set("X-Title", c.appName)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return usecase.ProviderResult{}, fmt.Errorf("perform provider request: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return usecase.ProviderResult{}, fmt.Errorf("read provider response: %w", err)
	}

	var parsed chatCompletionResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return usecase.ProviderResult{}, fmt.Errorf("decode provider response: %w", err)
	}

	if resp.StatusCode >= 400 {
		if parsed.Error != nil && strings.TrimSpace(parsed.Error.Message) != "" {
			return usecase.ProviderResult{}, fmt.Errorf("provider returned status %d: %s", resp.StatusCode, parsed.Error.Message)
		}
		return usecase.ProviderResult{}, fmt.Errorf("provider returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}
	if len(parsed.Choices) == 0 {
		return usecase.ProviderResult{}, fmt.Errorf("provider returned no choices")
	}

	content := strings.TrimSpace(parsed.Choices[0].Message.Content)
	if content == "" {
		return usecase.ProviderResult{}, fmt.Errorf("provider returned empty content")
	}

	return usecase.ProviderResult{
		RawResponse: content,
		TokensUsed:  parsed.Usage.TotalTokens,
	}, nil
}

func resolveModelID(modelID string) string {
	normalized := strings.TrimSpace(modelID)
	if mapped, ok := modelAliases[normalized]; ok {
		return mapped
	}
	return normalized
}
