package openai

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

type Client struct {
	baseURL string
	apiKey  string
	http    *http.Client
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

func NewClient(baseURL, apiKey string, httpClient *http.Client) *Client {
	return &Client{
		baseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		apiKey:  strings.TrimSpace(apiKey),
		http:    httpClient,
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
		Model:       input.ModelID,
		Temperature: 0.2,
		Messages: []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		}{
			{Role: "system", Content: "Answer the user's request naturally, clearly, and factually."},
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

	resp, err := c.http.Do(req)
	if err != nil {
		return usecase.ProviderResult{}, fmt.Errorf("perform provider request: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

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
