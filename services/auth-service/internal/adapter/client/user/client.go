package user

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/contracts/pkg/internalauth"
	"github.com/bastiencouder/microservices-go/services/auth-service/internal/domain"
)

var (
	ErrProfileProvisionUnavailable = errors.New("user profile provision unavailable")
	ErrProfileProvisionInvalid     = errors.New("user profile provision invalid")
	ErrConsentRequired             = errors.New("privacy policy consent required")
	nonWordPattern                 = regexp.MustCompile(`[^a-zA-Z0-9]+`)
)

type Client struct {
	baseURL    string
	issuer     string
	secret     string
	httpClient *http.Client
}

func NewClient(baseURL, secret, issuer string) *Client {
	transport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           (&net.Dialer{Timeout: 2 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   50,
		IdleConnTimeout:       90 * time.Second,
		ResponseHeaderTimeout: 2 * time.Second,
		TLSHandshakeTimeout:   2 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}
	return &Client{
		baseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		issuer:  strings.TrimSpace(issuer),
		secret:  strings.TrimSpace(secret),
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   3 * time.Second,
		},
	}
}

func (c *Client) EnsureProfile(ctx context.Context, identity domain.Identity, consentAccepted bool) error {
	authIdentityID := strings.TrimSpace(identity.ID)
	email := strings.TrimSpace(strings.ToLower(identity.Traits.Email))
	if authIdentityID == "" || email == "" {
		return fmt.Errorf("%w: missing identity or email", ErrProfileProvisionInvalid)
	}

	firstName, lastName := deriveNames(identity.Traits.Name, email)
	token, err := internalauth.SignInternalJWT(c.secret, c.issuer, "user-service", "auth-service", internalauth.Claims{
		IdentityID: authIdentityID,
	})
	if err != nil {
		return fmt.Errorf("%w: sign internal jwt: %v", ErrProfileProvisionUnavailable, err)
	}

	status, err := c.getByAuthIdentityID(ctx, token, authIdentityID)
	if err != nil {
		return err
	}
	if status == http.StatusOK {
		err := c.checkConsent(ctx, token)
		if errors.Is(err, ErrConsentRequired) && consentAccepted {
			return c.acceptConsent(ctx, token)
		}
		return err
	}
	if status != http.StatusNotFound {
		return fmt.Errorf("%w: unexpected lookup status %d", ErrProfileProvisionUnavailable, status)
	}

	if !consentAccepted {
		return ErrConsentRequired
	}
	status, err = c.createUser(ctx, token, email, firstName, lastName)
	if err != nil {
		return err
	}
	if status != http.StatusCreated && status != http.StatusOK {
		return fmt.Errorf("%w: unexpected create status %d", ErrProfileProvisionUnavailable, status)
	}
	return nil
}

func (c *Client) acceptConsent(ctx context.Context, token string) error {
	payload, err := json.Marshal(map[string]any{"type": "privacy_policy", "version": "v1", "accepted": true})
	if err != nil {
		return fmt.Errorf("%w: marshal consent: %v", ErrProfileProvisionUnavailable, err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/users/consent", bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("%w: build consent request: %v", ErrProfileProvisionUnavailable, err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("%w: accept consent: %v", ErrProfileProvisionUnavailable, err)
	}
	defer func() { _ = resp.Body.Close() }()
	_, _ = io.Copy(io.Discard, resp.Body)
	if resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("%w: unexpected accept consent status %d", ErrProfileProvisionUnavailable, resp.StatusCode)
	}
	return nil
}

func (c *Client) checkConsent(ctx context.Context, token string) error {
	endpoint := c.baseURL + "/users/consent/check?type=privacy_policy&version=v1"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return fmt.Errorf("%w: build consent request: %v", ErrProfileProvisionUnavailable, err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("%w: check consent: %v", ErrProfileProvisionUnavailable, err)
	}
	defer func() { _ = resp.Body.Close() }()
	_, _ = io.Copy(io.Discard, resp.Body)
	if resp.StatusCode == http.StatusOK {
		return nil
	}
	if resp.StatusCode == http.StatusForbidden {
		return ErrConsentRequired
	}
	return fmt.Errorf("%w: unexpected consent status %d", ErrProfileProvisionUnavailable, resp.StatusCode)
}

func (c *Client) getByAuthIdentityID(ctx context.Context, token, authIdentityID string) (int, error) {
	endpoint := c.baseURL + "/users/by-auth/" + url.PathEscape(authIdentityID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return 0, fmt.Errorf("%w: build get request: %v", ErrProfileProvisionUnavailable, err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("%w: get user by auth identity: %v", ErrProfileProvisionUnavailable, err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	_, _ = io.Copy(io.Discard, resp.Body)
	return resp.StatusCode, nil
}

func (c *Client) createUser(ctx context.Context, token, email, firstName, lastName string) (int, error) {
	payload, err := json.Marshal(map[string]any{
		"email":            email,
		"first_name":       firstName,
		"last_name":        lastName,
		"consent_accepted": true,
		"consent_type":     "privacy_policy",
		"consent_version":  "v1",
	})
	if err != nil {
		return 0, fmt.Errorf("%w: marshal create user: %v", ErrProfileProvisionUnavailable, err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/users", bytes.NewReader(payload))
	if err != nil {
		return 0, fmt.Errorf("%w: build create request: %v", ErrProfileProvisionUnavailable, err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("%w: create user: %v", ErrProfileProvisionUnavailable, err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	_, _ = io.Copy(io.Discard, resp.Body)
	return resp.StatusCode, nil
}

func deriveNames(rawName, email string) (string, string) {
	parts := strings.Fields(strings.TrimSpace(rawName))
	switch len(parts) {
	case 0:
		fallback := normalizeNamePart(strings.SplitN(email, "@", 2)[0])
		if fallback == "" {
			fallback = "User"
		}
		return fallback, fallback
	case 1:
		name := normalizeNamePart(parts[0])
		if name == "" {
			name = "User"
		}
		return name, name
	default:
		firstName := normalizeNamePart(parts[0])
		lastName := normalizeNamePart(strings.Join(parts[1:], " "))
		if firstName == "" {
			firstName = "User"
		}
		if lastName == "" {
			lastName = firstName
		}
		return firstName, lastName
	}
}

func normalizeNamePart(value string) string {
	value = strings.TrimSpace(nonWordPattern.ReplaceAllString(value, " "))
	parts := strings.Fields(value)
	if len(parts) == 0 {
		return ""
	}
	for i, part := range parts {
		lower := strings.ToLower(part)
		parts[i] = strings.ToUpper(lower[:1]) + lower[1:]
	}
	return strings.Join(parts, " ")
}
