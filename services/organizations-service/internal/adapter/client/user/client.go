package user

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	internaljwt "github.com/bastiencouder/microservices-go/contracts/pkg/internaljwt"
	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/usecase"
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
		return nil, fmt.Errorf("user service url is required")
	}

	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: defaultHTTPTimeout},
		jwtSecret:  strings.TrimSpace(jwtSecret),
		jwtIssuer:  strings.TrimSpace(jwtIssuer),
	}, nil
}

func (c *Client) UserEmail(ctx context.Context, userID int64) (string, error) {
	profile, err := c.UserProfile(ctx, userID)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(profile.Email) == "" {
		return "", fmt.Errorf("user email is empty")
	}
	return profile.Email, nil
}

func (c *Client) UserProfile(ctx context.Context, userID int64) (usecase.UserProfile, error) {
	if userID <= 0 {
		return usecase.UserProfile{}, fmt.Errorf("user id must be positive")
	}

	token, err := internaljwt.SignHS256(
		c.jwtSecret,
		c.jwtIssuer,
		"user-service",
		"organizations-service",
		internaljwt.TokenClaims{UserID: userID},
		60*time.Second,
	)
	if err != nil {
		return usecase.UserProfile{}, fmt.Errorf("sign internal jwt: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/users/"+url.PathEscape(fmt.Sprintf("%d", userID)), nil)
	if err != nil {
		return usecase.UserProfile{}, fmt.Errorf("create user request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return usecase.UserProfile{}, fmt.Errorf("send user request: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<10))
		message := strings.TrimSpace(string(raw))
		if message == "" {
			message = http.StatusText(resp.StatusCode)
		}
		return usecase.UserProfile{}, fmt.Errorf("user service error (%d): %s", resp.StatusCode, message)
	}

	var payload struct {
		Email     string `json:"email"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
	}
	if err := httpjson.DecodeSuccessData(resp.Body, &payload); err != nil {
		return usecase.UserProfile{}, fmt.Errorf("decode user response: %w", err)
	}
	return usecase.UserProfile{
		Email:     strings.TrimSpace(payload.Email),
		FirstName: strings.TrimSpace(payload.FirstName),
		LastName:  strings.TrimSpace(payload.LastName),
	}, nil
}
