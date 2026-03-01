package kratos

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
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

func (c *Client) InitFlow(ctx context.Context, mode, cookieHeader string) (*domain.BrowserFlow, []string, int, error) {
	path, err := flowInitPath(mode)
	if err != nil {
		return nil, nil, 0, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return nil, nil, 0, err
	}
	req.Header.Set("Accept", "application/json")
	if cookieHeader != "" {
		req.Header.Set("Cookie", cookieHeader)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, nil, 0, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, 0, err
	}
	var flow domain.BrowserFlow
	if err := json.Unmarshal(body, &flow); err != nil {
		return nil, nil, 0, fmt.Errorf("decode kratos flow init: %w", err)
	}

	return &flow, resp.Header.Values("Set-Cookie"), resp.StatusCode, nil
}

func (c *Client) SubmitFlow(ctx context.Context, mode, flowID string, payload any, cookieHeader string) (domain.RawJSON, []string, int, error) {
	if flowID == "" {
		return nil, nil, 0, fmt.Errorf("missing flow id")
	}

	flowPath, err := flowSubmitPath(mode)
	if err != nil {
		return nil, nil, 0, err
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, 0, err
	}

	endpoint := c.baseURL + flowPath + "?flow=" + url.QueryEscape(flowID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, nil, 0, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	if cookieHeader != "" {
		req.Header.Set("Cookie", cookieHeader)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, nil, 0, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, 0, err
	}
	return raw, resp.Header.Values("Set-Cookie"), resp.StatusCode, nil
}

func (c *Client) InitLogout(ctx context.Context, cookieHeader string) (*domain.LogoutInitResponse, []string, int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/self-service/logout/browser", nil)
	if err != nil {
		return nil, nil, 0, err
	}
	req.Header.Set("Accept", "application/json")
	if cookieHeader != "" {
		req.Header.Set("Cookie", cookieHeader)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, nil, 0, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, 0, err
	}
	var payload domain.LogoutInitResponse
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, nil, 0, fmt.Errorf("decode logout init response: %w", err)
	}

	return &payload, resp.Header.Values("Set-Cookie"), resp.StatusCode, nil
}

func (c *Client) CompleteLogout(ctx context.Context, logoutURL, cookieHeader string) ([]string, int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, logoutURL, nil)
	if err != nil {
		return nil, 0, err
	}
	if cookieHeader != "" {
		req.Header.Set("Cookie", cookieHeader)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	return resp.Header.Values("Set-Cookie"), resp.StatusCode, nil
}

func flowInitPath(mode string) (string, error) {
	switch mode {
	case "login":
		return "/self-service/login/browser?refresh=true", nil
	case "registration":
		return "/self-service/registration/browser", nil
	default:
		return "", fmt.Errorf("invalid mode: %s", mode)
	}
}

func flowSubmitPath(mode string) (string, error) {
	switch mode {
	case "login":
		return "/self-service/login", nil
	case "registration":
		return "/self-service/registration", nil
	default:
		return "", fmt.Errorf("invalid mode: %s", mode)
	}
}
