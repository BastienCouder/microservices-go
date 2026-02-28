package kratos

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/bastiencouder/microservices-go/services/auth-service/internal/domain"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{},
	}
}

func (c *Client) WhoAmI(ctx context.Context, cookieHeader, sessionToken string) (*domain.Session, int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/sessions/whoami", nil)
	if err != nil {
		return nil, 0, err
	}

	if cookieHeader != "" {
		req.Header.Set("Cookie", cookieHeader)
	}
	if sessionToken != "" {
		req.Header.Set("X-Session-Token", sessionToken)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, resp.StatusCode, nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, err
	}

	var session domain.Session
	if err := json.Unmarshal(body, &session); err != nil {
		return nil, 0, fmt.Errorf("decode kratos whoami response: %w", err)
	}

	return &session, resp.StatusCode, nil
}
