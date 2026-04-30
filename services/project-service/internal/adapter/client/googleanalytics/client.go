package googleanalytics

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
)

const (
	defaultHTTPTimeout      = 10 * time.Second
	analyticsReadonlyScope  = "https://www.googleapis.com/auth/analytics.readonly"
	googleAuthorizationURL  = "https://accounts.google.com/o/oauth2/v2/auth"
	googleTokenURL          = "https://oauth2.googleapis.com/token"
	googleAccountSummaryURL = "https://analyticsadmin.googleapis.com/v1beta/accountSummaries"
)

type Client struct {
	clientID     string
	clientSecret string
	httpClient   *http.Client
}

func NewClient(clientID, clientSecret string) (*Client, error) {
	clientID = strings.TrimSpace(clientID)
	clientSecret = strings.TrimSpace(clientSecret)
	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("google analytics oauth client id and secret are required")
	}
	return &Client{
		clientID:     clientID,
		clientSecret: clientSecret,
		httpClient:   &http.Client{Timeout: defaultHTTPTimeout},
	}, nil
}

func (c *Client) AuthorizationURL(state, redirectURI string) (string, error) {
	state = strings.TrimSpace(state)
	redirectURI = strings.TrimSpace(redirectURI)
	if state == "" || redirectURI == "" {
		return "", fmt.Errorf("state and redirect uri are required")
	}
	values := url.Values{}
	values.Set("client_id", c.clientID)
	values.Set("redirect_uri", redirectURI)
	values.Set("response_type", "code")
	values.Set("scope", analyticsReadonlyScope)
	values.Set("access_type", "offline")
	values.Set("prompt", "consent")
	values.Set("include_granted_scopes", "true")
	values.Set("state", state)
	return googleAuthorizationURL + "?" + values.Encode(), nil
}

func (c *Client) ExchangeCode(ctx context.Context, code, redirectURI string) (usecase.GA4OAuthToken, error) {
	form := url.Values{}
	form.Set("client_id", c.clientID)
	form.Set("client_secret", c.clientSecret)
	form.Set("code", strings.TrimSpace(code))
	form.Set("redirect_uri", strings.TrimSpace(redirectURI))
	form.Set("grant_type", "authorization_code")

	var response struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := c.postForm(ctx, googleTokenURL, form, &response); err != nil {
		return usecase.GA4OAuthToken{}, err
	}
	return usecase.GA4OAuthToken{RefreshToken: strings.TrimSpace(response.RefreshToken)}, nil
}

func (c *Client) ListProperties(ctx context.Context, refreshToken string) ([]usecase.GA4OAuthProperty, error) {
	accessToken, err := c.refreshAccessToken(ctx, refreshToken)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, googleAccountSummaryURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create ga4 account summaries request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send ga4 account summaries request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, readGoogleError(resp, "ga4 account summaries")
	}

	var payload struct {
		AccountSummaries []struct {
			DisplayName       string `json:"displayName"`
			PropertySummaries []struct {
				Property    string `json:"property"`
				DisplayName string `json:"displayName"`
			} `json:"propertySummaries"`
		} `json:"accountSummaries"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decode ga4 account summaries response: %w", err)
	}

	properties := make([]usecase.GA4OAuthProperty, 0)
	for _, account := range payload.AccountSummaries {
		for _, property := range account.PropertySummaries {
			propertyID := strings.TrimPrefix(strings.TrimSpace(property.Property), "properties/")
			if propertyID == "" {
				continue
			}
			properties = append(properties, usecase.GA4OAuthProperty{
				PropertyID:  propertyID,
				DisplayName: strings.TrimSpace(property.DisplayName),
				AccountName: strings.TrimSpace(account.DisplayName),
			})
		}
	}
	return properties, nil
}

func (c *Client) refreshAccessToken(ctx context.Context, refreshToken string) (string, error) {
	form := url.Values{}
	form.Set("client_id", c.clientID)
	form.Set("client_secret", c.clientSecret)
	form.Set("refresh_token", strings.TrimSpace(refreshToken))
	form.Set("grant_type", "refresh_token")

	var response struct {
		AccessToken string `json:"access_token"`
	}
	if err := c.postForm(ctx, googleTokenURL, form, &response); err != nil {
		return "", err
	}
	if strings.TrimSpace(response.AccessToken) == "" {
		return "", fmt.Errorf("google token response missing access_token")
	}
	return strings.TrimSpace(response.AccessToken), nil
}

func (c *Client) postForm(ctx context.Context, endpoint string, form url.Values, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return fmt.Errorf("create google oauth request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send google oauth request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return readGoogleError(resp, "google oauth")
	}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode google oauth response: %w", err)
	}
	return nil
}

func readGoogleError(resp *http.Response, label string) error {
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<10))
	message := strings.TrimSpace(string(raw))
	if message == "" {
		message = http.StatusText(resp.StatusCode)
	}
	return fmt.Errorf("%s error (%d): %s", label, resp.StatusCode, message)
}
