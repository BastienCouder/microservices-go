package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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
		return nil, fmt.Errorf("notification service url is required")
	}
	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: defaultHTTPTimeout},
		jwtSecret:  jwtSecret,
		jwtIssuer:  jwtIssuer,
	}, nil
}

func (c *Client) SendEmail(ctx context.Context, input usecase.NotificationEmailInput) error {
	recipient := strings.TrimSpace(input.Recipient)
	if recipient == "" {
		return fmt.Errorf("recipient is required")
	}

	token, err := security.SignInternalJWT(
		c.jwtSecret,
		c.jwtIssuer,
		"notification-service",
		"project-service",
		security.OutboundTokenClaims{},
	)
	if err != nil {
		return fmt.Errorf("sign internal jwt: %w", err)
	}

	payload, err := json.Marshal(map[string]string{
		"channel":   "email",
		"recipient": recipient,
		"subject":   strings.TrimSpace(input.Subject),
		"message":   strings.TrimSpace(input.Message),
	})
	if err != nil {
		return fmt.Errorf("marshal notification payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/notifications/send", bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create notification request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send notification request: %w", err)
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
	return fmt.Errorf("notification service error (%d): %s", resp.StatusCode, message)
}
