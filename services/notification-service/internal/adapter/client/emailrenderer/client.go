package emailrenderer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
}

type NotificationTemplate struct {
	Subject string `json:"subject"`
	HTML    string `json:"html"`
	Text    string `json:"text"`
}

func NewClient(baseURL string) *Client {
	return &Client{baseURL: strings.TrimRight(baseURL, "/"), httpClient: &http.Client{}}
}

func (c *Client) RenderNotification(ctx context.Context, title, message string) (string, string, string, error) {
	reqBody, err := json.Marshal(map[string]string{
		"title":   title,
		"message": message,
	})
	if err != nil {
		return "", "", "", fmt.Errorf("marshal renderer payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/render/notification", bytes.NewReader(reqBody))
	if err != nil {
		return "", "", "", fmt.Errorf("create renderer request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", "", "", fmt.Errorf("send renderer request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", "", fmt.Errorf("renderer returned status %d", resp.StatusCode)
	}

	var out NotificationTemplate
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", "", "", fmt.Errorf("decode renderer response: %w", err)
	}
	if strings.TrimSpace(out.Subject) == "" || strings.TrimSpace(out.HTML) == "" {
		return "", "", "", fmt.Errorf("renderer response missing subject or html")
	}
	return out.Subject, out.HTML, out.Text, nil
}
