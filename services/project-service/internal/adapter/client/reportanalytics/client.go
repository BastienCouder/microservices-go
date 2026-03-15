package reportanalytics

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/project-service/internal/security"
	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
)

const defaultHTTPTimeout = 5 * time.Second

type Client struct {
	baseURL    string
	httpClient *http.Client
	jwtSecret  string
	jwtIssuer  string
}

type successEnvelope struct {
	Success bool           `json:"success"`
	Data    map[string]any `json:"data"`
	Error   string         `json:"error,omitempty"`
}

func NewClient(baseURL, jwtSecret, jwtIssuer string) (*Client, error) {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" {
		return nil, fmt.Errorf("analysis service url is required")
	}
	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: defaultHTTPTimeout},
		jwtSecret:  jwtSecret,
		jwtIssuer:  jwtIssuer,
	}, nil
}

func (c *Client) LoadProjectReportData(
	ctx context.Context,
	projectID string,
	organizationID, userID int64,
) (usecase.ProjectReportAnalyticsData, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return usecase.ProjectReportAnalyticsData{}, fmt.Errorf("project id is required")
	}
	if organizationID <= 0 {
		return usecase.ProjectReportAnalyticsData{}, fmt.Errorf("organization id is required")
	}
	if userID <= 0 {
		return usecase.ProjectReportAnalyticsData{}, fmt.Errorf("user id is required")
	}

	token, err := security.SignInternalJWT(
		c.jwtSecret,
		c.jwtIssuer,
		"analysis-service",
		"project-service",
		security.OutboundTokenClaims{
			UserID:       userID,
			Organization: organizationID,
		},
	)
	if err != nil {
		return usecase.ProjectReportAnalyticsData{}, fmt.Errorf("sign internal jwt: %w", err)
	}

	dashboard, err := c.getReportPayload(ctx, token, "/projects/"+url.PathEscape(projectID)+"/dashboard")
	if err != nil {
		return usecase.ProjectReportAnalyticsData{}, err
	}
	perception, err := c.getReportPayload(ctx, token, "/projects/"+url.PathEscape(projectID)+"/perception")
	if err != nil {
		return usecase.ProjectReportAnalyticsData{}, err
	}

	return usecase.ProjectReportAnalyticsData{
		Dashboard:  dashboard,
		Perception: perception,
	}, nil
}

func (c *Client) getReportPayload(ctx context.Context, token, path string) (map[string]any, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return nil, fmt.Errorf("create analysis report request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send analysis report request: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("read analysis report response: %w", err)
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("analysis service error (%d): %s", resp.StatusCode, extractHTTPError(raw))
	}

	var envelope successEnvelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, fmt.Errorf("decode analysis report response: %w", err)
	}
	if !envelope.Success {
		return nil, fmt.Errorf("analysis service error: %s", firstNonEmptyText(strings.TrimSpace(envelope.Error), "request failed"))
	}
	return envelope.Data, nil
}

func extractHTTPError(raw []byte) string {
	message := strings.TrimSpace(string(raw))
	if message == "" {
		return http.StatusText(http.StatusBadGateway)
	}
	return message
}

func firstNonEmptyText(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
