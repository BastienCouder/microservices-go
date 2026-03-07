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

	"github.com/bastiencouder/microservices-go/services/auth-service/internal/domain"
	"github.com/bastiencouder/microservices-go/services/auth-service/internal/security"
)

var (
	ErrProfileProvisionUnavailable = errors.New("user profile provision unavailable")
	ErrProfileProvisionInvalid     = errors.New("user profile provision invalid")
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

func (c *Client) EnsureProfile(ctx context.Context, identity domain.Identity) error {
	authIdentityID := strings.TrimSpace(identity.ID)
	email := strings.TrimSpace(strings.ToLower(identity.Traits.Email))
	if authIdentityID == "" || email == "" {
		return fmt.Errorf("%w: missing identity or email", ErrProfileProvisionInvalid)
	}

	firstName, lastName := deriveNames(identity.Traits.Name, email)
	token, err := security.SignInternalJWT(c.secret, c.issuer, "user-service", "auth-service", security.OutboundTokenClaims{
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
		return nil
	}
	if status != http.StatusNotFound {
		return fmt.Errorf("%w: unexpected lookup status %d", ErrProfileProvisionUnavailable, status)
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
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	return resp.StatusCode, nil
}

func (c *Client) createUser(ctx context.Context, token, email, firstName, lastName string) (int, error) {
	payload, err := json.Marshal(map[string]string{
		"email":      email,
		"first_name": firstName,
		"last_name":  lastName,
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
	defer resp.Body.Close()
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
