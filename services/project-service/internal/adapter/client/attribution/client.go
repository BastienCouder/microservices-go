package attribution

import (
	"bytes"
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

func NewClient(baseURL, jwtSecret, jwtIssuer string) (*Client, error) {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" {
		return nil, fmt.Errorf("attribution service url is required")
	}
	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: defaultHTTPTimeout},
		jwtSecret:  jwtSecret,
		jwtIssuer:  jwtIssuer,
	}, nil
}

func (c *Client) RecordEvent(ctx context.Context, input usecase.AttributionEventInput) error {
	projectID := strings.TrimSpace(input.ProjectID)
	if projectID == "" {
		return fmt.Errorf("project id is required")
	}
	if input.OrganizationID <= 0 {
		return fmt.Errorf("organization id is required")
	}
	if input.UserID <= 0 {
		return fmt.Errorf("user id is required")
	}

	token, err := security.SignInternalJWT(
		c.jwtSecret,
		c.jwtIssuer,
		"attribution-service",
		"project-service",
		security.OutboundTokenClaims{
			UserID:       input.UserID,
			Organization: input.OrganizationID,
		},
	)
	if err != nil {
		return fmt.Errorf("sign internal jwt: %w", err)
	}

	payload, err := json.Marshal(map[string]any{
		"stage":        input.Stage,
		"source":       input.Source,
		"count":        input.Count,
		"revenueCents": input.RevenueCents,
		"occurredAt":   input.OccurredAt,
	})
	if err != nil {
		return fmt.Errorf("marshal attribution payload: %w", err)
	}

	endpoint := c.baseURL + "/internal/attribution/projects/" + url.PathEscape(projectID) + "/events"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create attribution request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send attribution request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusOK && resp.StatusCode < http.StatusMultipleChoices {
		return nil
	}

	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<10))
	message := strings.TrimSpace(string(raw))
	if message == "" {
		message = http.StatusText(resp.StatusCode)
	}
	return fmt.Errorf("attribution service error (%d): %s", resp.StatusCode, message)
}
