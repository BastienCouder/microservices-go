package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type HealthInput struct {
	BaseURL string `json:"base_url" jsonschema:"Backend base URL (for example http://localhost:8080),format=uri"`
	Service string `json:"service" jsonschema:"Service to check: gateway|auth|user|organizations|permission|billing|notification"`
}

type HealthOutput struct {
	Service    string `json:"service"`
	URL        string `json:"url"`
	StatusCode int    `json:"status_code"`
	Body       string `json:"body"`
	Healthy    bool   `json:"healthy"`
}

func HealthCheck(ctx context.Context, _ *mcp.CallToolRequest, in HealthInput) (*mcp.CallToolResult, HealthOutput, error) {
	if strings.TrimSpace(in.BaseURL) == "" {
		return errorResult("base_url is required"), HealthOutput{}, nil
	}

	targetURL, err := buildHealthURL(in.BaseURL, in.Service)
	if err != nil {
		return errorResult(err.Error()), HealthOutput{}, nil
	}

	client := &http.Client{Timeout: 5 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return errorResult(fmt.Sprintf("create request: %v", err)), HealthOutput{}, nil
	}

	resp, err := client.Do(req)
	if err != nil {
		return errorResult(fmt.Sprintf("request failed: %v", err)), HealthOutput{}, nil
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	var payload map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&payload)
	body, _ := json.Marshal(payload)

	out := HealthOutput{
		Service:    in.Service,
		URL:        targetURL,
		StatusCode: resp.StatusCode,
		Body:       string(body),
		Healthy:    resp.StatusCode >= 200 && resp.StatusCode < 300,
	}
	return nil, out, nil
}

func buildHealthURL(baseURL, service string) (string, error) {
	baseURL = strings.TrimRight(baseURL, "/")
	switch service {
	case "gateway", "auth", "user", "organizations", "permission", "billing", "notification":
		return baseURL + "/health", nil
	default:
		return "", fmt.Errorf("invalid service %q, expected gateway|auth|user|organizations|permission|billing|notification", service)
	}
}

func errorResult(msg string) *mcp.CallToolResult {
	return &mcp.CallToolResult{
		Content: []mcp.Content{&mcp.TextContent{Text: msg}},
		IsError: true,
	}
}
