package ga4

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/attribution-service/internal/usecase"
)

const (
	defaultHTTPTimeout = 10 * time.Second
	ga4Scope           = "https://www.googleapis.com/auth/analytics.readonly"
	defaultTokenURI    = "https://oauth2.googleapis.com/token"
)

var aiSourceAliases = map[string]string{
	"chatgpt":               "chatgpt",
	"chatgpt.com":           "chatgpt",
	"chat.openai.com":       "chatgpt",
	"openai":                "chatgpt",
	"perplexity":            "perplexity",
	"perplexity.ai":         "perplexity",
	"claude":                "claude",
	"claude.ai":             "claude",
	"anthropic.com":         "claude",
	"gemini":                "gemini",
	"gemini.google.com":     "gemini",
	"bard.google.com":       "gemini",
	"mistral":               "mistral",
	"chat.mistral.ai":       "mistral",
	"mistral.ai":            "mistral",
	"copilot":               "copilot",
	"copilot.microsoft.com": "copilot",
	"grok":                  "grok",
	"grok.x.ai":             "grok",
	"deepseek":              "deepseek",
	"chat.deepseek.com":     "deepseek",
	"you.com":               "you.com",
	"phind.com":             "phind",
}

type serviceAccount struct {
	ClientEmail string `json:"client_email"`
	PrivateKey  string `json:"private_key"`
	TokenURI    string `json:"token_uri"`
}

type Client struct {
	httpClient         *http.Client
	oauthClientID      string
	oauthClientSecret  string
	fakeTrafficEnabled bool
}

func NewClient() *Client {
	return &Client{
		httpClient:         &http.Client{Timeout: defaultHTTPTimeout},
		fakeTrafficEnabled: true,
	}
}

func NewClientWithOAuth(clientID, clientSecret string) *Client {
	client := NewClient()
	client.oauthClientID = strings.TrimSpace(clientID)
	client.oauthClientSecret = strings.TrimSpace(clientSecret)
	return client
}

func (c *Client) SetFakeTrafficEnabled(enabled bool) {
	c.fakeTrafficEnabled = enabled
}

func (c *Client) ListVisitsBySource(
	ctx context.Context,
	project usecase.ProjectMetadata,
	from, to time.Time,
) ([]usecase.FunnelSource, error) {
	propertyID := strings.TrimSpace(project.GA4.PropertyID)
	if propertyID == "" {
		return nil, fmt.Errorf("ga4 property id is required")
	}

	accessToken, err := c.getProjectAccessToken(ctx, project)
	if err != nil {
		return nil, err
	}

	body, err := json.Marshal(buildRunReportRequest(from, to))
	if err != nil {
		return nil, fmt.Errorf("marshal ga4 runReport payload: %w", err)
	}

	endpoint := "https://analyticsdata.googleapis.com/v1beta/properties/" + url.PathEscape(propertyID) + ":runReport"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(string(body)))
	if err != nil {
		return nil, fmt.Errorf("create ga4 runReport request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send ga4 runReport request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<10))
		message := strings.TrimSpace(string(raw))
		if message == "" {
			message = http.StatusText(resp.StatusCode)
		}
		return nil, fmt.Errorf("ga4 runReport error (%d): %s", resp.StatusCode, message)
	}

	var response struct {
		Rows []struct {
			DimensionValues []struct {
				Value string `json:"value"`
			} `json:"dimensionValues"`
			MetricValues []struct {
				Value string `json:"value"`
			} `json:"metricValues"`
		} `json:"rows"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("decode ga4 runReport response: %w", err)
	}

	sourceTotals := make(map[string]int64)
	for _, row := range response.Rows {
		if len(row.DimensionValues) == 0 || len(row.MetricValues) == 0 {
			continue
		}
		source := normalizeSource(row.DimensionValues[0].Value)
		if source == "" {
			continue
		}
		var visits int64
		if _, err := fmt.Sscan(strings.TrimSpace(row.MetricValues[0].Value), &visits); err != nil || visits <= 0 {
			continue
		}
		sourceTotals[source] += visits
	}

	sources := make([]usecase.FunnelSource, 0, len(sourceTotals))
	for source, visits := range sourceTotals {
		sources = append(sources, usecase.FunnelSource{
			Source: source,
			Visits: visits,
		})
	}
	return sources, nil
}

func buildRunReportRequest(from, to time.Time) map[string]any {
	sources := make([]string, 0, len(aiSourceAliases))
	seen := make(map[string]struct{}, len(aiSourceAliases))
	for source := range aiSourceAliases {
		if _, ok := seen[source]; ok {
			continue
		}
		seen[source] = struct{}{}
		sources = append(sources, source)
	}

	filters := []map[string]any{
		{
			"filter": map[string]any{
				"fieldName": "sessionSource",
				"inListFilter": map[string]any{
					"values":        sources,
					"caseSensitive": false,
				},
			},
		},
	}
	return map[string]any{
		"dateRanges": []map[string]string{
			{
				"startDate": from.UTC().Format("2006-01-02"),
				"endDate":   to.UTC().Format("2006-01-02"),
			},
		},
		"dimensions": []map[string]string{
			{"name": "sessionSource"},
		},
		"metrics": []map[string]string{
			{"name": "sessions"},
		},
		"dimensionFilter": map[string]any{
			"andGroup": map[string]any{
				"expressions": filters,
			},
		},
		"limit": "100",
	}
}

func normalizeSource(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == "" {
		return ""
	}
	if mapped, ok := aiSourceAliases[normalized]; ok {
		return mapped
	}
	return ""
}

func parseServiceAccount(raw string) (serviceAccount, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return serviceAccount{}, fmt.Errorf("ga4 service account json is required")
	}

	var account serviceAccount
	if err := json.Unmarshal([]byte(raw), &account); err != nil {
		return serviceAccount{}, fmt.Errorf("decode ga4 service account json: %w", err)
	}
	account.ClientEmail = strings.TrimSpace(account.ClientEmail)
	account.PrivateKey = strings.TrimSpace(account.PrivateKey)
	account.TokenURI = strings.TrimSpace(account.TokenURI)
	if account.ClientEmail == "" || account.PrivateKey == "" {
		return serviceAccount{}, fmt.Errorf("ga4 service account json is missing client_email or private_key")
	}
	if account.TokenURI == "" {
		account.TokenURI = defaultTokenURI
	}
	return account, nil
}

func (c *Client) getAccessToken(ctx context.Context, account serviceAccount) (string, error) {
	assertion, err := buildJWTAssertion(account)
	if err != nil {
		return "", err
	}

	form := url.Values{}
	form.Set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer")
	form.Set("assertion", assertion)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, account.TokenURI, strings.NewReader(form.Encode()))
	if err != nil {
		return "", fmt.Errorf("create oauth token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("send oauth token request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<10))
		message := strings.TrimSpace(string(raw))
		if message == "" {
			message = http.StatusText(resp.StatusCode)
		}
		return "", fmt.Errorf("oauth token error (%d): %s", resp.StatusCode, message)
	}

	var tokenResponse struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int64  `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResponse); err != nil {
		return "", fmt.Errorf("decode oauth token response: %w", err)
	}
	if strings.TrimSpace(tokenResponse.AccessToken) == "" {
		return "", fmt.Errorf("oauth token response missing access_token")
	}
	if tokenResponse.ExpiresIn <= 0 {
		tokenResponse.ExpiresIn = 3600
	}
	return strings.TrimSpace(tokenResponse.AccessToken), nil
}

func (c *Client) getProjectAccessToken(ctx context.Context, project usecase.ProjectMetadata) (string, error) {
	if strings.TrimSpace(project.GA4.ServiceAccountJSON) != "" {
		account, err := parseServiceAccount(project.GA4.ServiceAccountJSON)
		if err != nil {
			return "", err
		}
		return c.getAccessToken(ctx, account)
	}
	return c.getOAuthRefreshAccessToken(ctx, project.GA4.OAuthRefreshToken)
}

func (c *Client) getOAuthRefreshAccessToken(ctx context.Context, refreshToken string) (string, error) {
	refreshToken = strings.TrimSpace(refreshToken)
	if refreshToken == "" {
		return "", fmt.Errorf("ga4 oauth refresh token is required")
	}
	if strings.TrimSpace(c.oauthClientID) == "" || strings.TrimSpace(c.oauthClientSecret) == "" {
		return "", fmt.Errorf("ga4 oauth client is not configured")
	}

	form := url.Values{}
	form.Set("client_id", c.oauthClientID)
	form.Set("client_secret", c.oauthClientSecret)
	form.Set("refresh_token", refreshToken)
	form.Set("grant_type", "refresh_token")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, defaultTokenURI, strings.NewReader(form.Encode()))
	if err != nil {
		return "", fmt.Errorf("create oauth refresh request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("send oauth refresh request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<10))
		message := strings.TrimSpace(string(raw))
		if message == "" {
			message = http.StatusText(resp.StatusCode)
		}
		return "", fmt.Errorf("oauth refresh error (%d): %s", resp.StatusCode, message)
	}

	var tokenResponse struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResponse); err != nil {
		return "", fmt.Errorf("decode oauth refresh response: %w", err)
	}
	if strings.TrimSpace(tokenResponse.AccessToken) == "" {
		return "", fmt.Errorf("oauth refresh response missing access_token")
	}
	return strings.TrimSpace(tokenResponse.AccessToken), nil
}

func buildJWTAssertion(account serviceAccount) (string, error) {
	now := time.Now().UTC()
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256","typ":"JWT"}`))
	claimsPayload, err := json.Marshal(map[string]any{
		"iss":   account.ClientEmail,
		"scope": ga4Scope,
		"aud":   account.TokenURI,
		"iat":   now.Unix(),
		"exp":   now.Add(time.Hour).Unix(),
	})
	if err != nil {
		return "", fmt.Errorf("marshal oauth jwt claims: %w", err)
	}
	payload := base64.RawURLEncoding.EncodeToString(claimsPayload)
	unsigned := header + "." + payload

	privateKey, err := parsePrivateKey(account.PrivateKey)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256([]byte(unsigned))
	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, sum[:])
	if err != nil {
		return "", fmt.Errorf("sign oauth jwt: %w", err)
	}
	return unsigned + "." + base64.RawURLEncoding.EncodeToString(signature), nil
}

func parsePrivateKey(raw string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(raw))
	if block == nil {
		return nil, fmt.Errorf("decode ga4 private key: invalid pem")
	}
	if privateKey, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		if rsaKey, ok := privateKey.(*rsa.PrivateKey); ok {
			return rsaKey, nil
		}
	}
	privateKey, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse ga4 private key: %w", err)
	}
	return privateKey, nil
}
