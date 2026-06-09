package googleanalytics

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

	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
)

const (
	defaultHTTPTimeout      = 10 * time.Second
	analyticsEditScope      = "https://www.googleapis.com/auth/analytics.edit"
	analyticsReadOnlyScope  = "https://www.googleapis.com/auth/analytics.readonly"
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
	return &Client{
		clientID:     strings.TrimSpace(clientID),
		clientSecret: strings.TrimSpace(clientSecret),
		httpClient:   &http.Client{Timeout: defaultHTTPTimeout},
	}, nil
}

func (c *Client) AuthorizationURL(state, redirectURI string) (string, error) {
	state = strings.TrimSpace(state)
	redirectURI = strings.TrimSpace(redirectURI)
	if state == "" || redirectURI == "" {
		return "", fmt.Errorf("state and redirect uri are required")
	}
	if strings.TrimSpace(c.clientID) == "" || strings.TrimSpace(c.clientSecret) == "" {
		return "", fmt.Errorf("google analytics oauth client id and secret are required")
	}
	values := url.Values{}
	values.Set("client_id", c.clientID)
	values.Set("redirect_uri", redirectURI)
	values.Set("response_type", "code")
	values.Set("scope", strings.Join([]string{analyticsEditScope, analyticsReadOnlyScope}, " "))
	values.Set("access_type", "offline")
	values.Set("prompt", "consent")
	values.Set("include_granted_scopes", "true")
	values.Set("state", state)
	return googleAuthorizationURL + "?" + values.Encode(), nil
}

func (c *Client) ExchangeCode(ctx context.Context, code, redirectURI string) (usecase.GA4OAuthToken, error) {
	if strings.TrimSpace(c.clientID) == "" || strings.TrimSpace(c.clientSecret) == "" {
		return usecase.GA4OAuthToken{}, fmt.Errorf("google analytics oauth client id and secret are required")
	}
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
	if strings.TrimSpace(c.clientID) == "" || strings.TrimSpace(c.clientSecret) == "" {
		return "", fmt.Errorf("google analytics oauth client id and secret are required")
	}
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

type serviceAccount struct {
	ClientEmail string `json:"client_email"`
	PrivateKey  string `json:"private_key"`
	TokenURI    string `json:"token_uri"`
}

func (c *Client) SetupLLMTrackingWithServiceAccount(ctx context.Context, serviceAccountJSON, propertyID string) (usecase.GA4LLMSetupResult, error) {
	property := normalizeGA4Property(propertyID)
	if property == "" {
		return usecase.GA4LLMSetupResult{}, fmt.Errorf("ga4 property id is required")
	}
	account, err := parseServiceAccount(serviceAccountJSON)
	if err != nil {
		return usecase.GA4LLMSetupResult{}, err
	}
	accessToken, err := c.getServiceAccountAccessToken(ctx, account)
	if err != nil {
		return usecase.GA4LLMSetupResult{}, err
	}
	return c.setupLLMTrackingWithAccessToken(ctx, accessToken, property), nil
}

func (c *Client) setupLLMTrackingWithAccessToken(ctx context.Context, accessToken, property string) usecase.GA4LLMSetupResult {
	var result usecase.GA4LLMSetupResult
	channelGroupName, channelGroupErr := c.ensureLLMChannelGroup(ctx, accessToken, property)
	if channelGroupErr != nil {
		result.Errors = append(result.Errors, usecase.GA4LLMSetupError{
			Resource: "channelGroup",
			Message:  channelGroupErr.Error(),
		})
	} else {
		result.CreatedResources.ChannelGroupName = channelGroupName
	}

	customDimensionName, customDimensionErr := c.ensureLLMCustomDimension(ctx, accessToken, property)
	if customDimensionErr != nil {
		result.Errors = append(result.Errors, usecase.GA4LLMSetupError{
			Resource: "customDimension",
			Message:  customDimensionErr.Error(),
		})
	} else {
		result.CreatedResources.CustomDimensionName = customDimensionName
	}

	result.SetupStatus = setupStatus(result)
	return result
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
		account.TokenURI = googleTokenURL
	}
	return account, nil
}

func (c *Client) getServiceAccountAccessToken(ctx context.Context, account serviceAccount) (string, error) {
	assertion, err := buildJWTAssertion(account)
	if err != nil {
		return "", err
	}

	form := url.Values{}
	form.Set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer")
	form.Set("assertion", assertion)

	var response struct {
		AccessToken string `json:"access_token"`
	}
	if err := c.postForm(ctx, account.TokenURI, form, &response); err != nil {
		return "", err
	}
	if strings.TrimSpace(response.AccessToken) == "" {
		return "", fmt.Errorf("google token response missing access_token")
	}
	return strings.TrimSpace(response.AccessToken), nil
}

func buildJWTAssertion(account serviceAccount) (string, error) {
	now := time.Now().UTC()
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256","typ":"JWT"}`))
	claimsPayload, err := json.Marshal(map[string]any{
		"iss":   account.ClientEmail,
		"scope": analyticsEditScope,
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
