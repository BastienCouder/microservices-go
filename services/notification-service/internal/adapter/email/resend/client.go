package resend

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	apiKey     string
	fromEmail  string
	httpClient *http.Client
}

func NewClient(apiKey, fromEmail string) *Client {
	return &Client{
		apiKey:     apiKey,
		fromEmail:  fromEmail,
		httpClient: &http.Client{Timeout: 20 * time.Second},
	}
}

func (c *Client) Send(ctx context.Context, toEmail, subject, htmlBody, textBody string) error {
	payload := map[string]any{
		"from":    c.fromEmail,
		"to":      []string{toEmail},
		"subject": subject,
		"html":    htmlBody,
		"text":    textBody,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal resend payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create resend request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send resend request: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<10))
		message := strings.TrimSpace(string(raw))
		if message == "" {
			message = http.StatusText(resp.StatusCode)
		}
		return fmt.Errorf("resend returned status %d: %s", resp.StatusCode, message)
	}

	return nil
}
