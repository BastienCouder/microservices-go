package project

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

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
		return nil, fmt.Errorf("project service url is required")
	}

	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: defaultHTTPTimeout},
		jwtSecret:  strings.TrimSpace(jwtSecret),
		jwtIssuer:  strings.TrimSpace(jwtIssuer),
	}, nil
}

func (c *Client) ListProjectsByOrganization(ctx context.Context, organizationID int64) ([]usecase.ProjectSummary, error) {
	return c.listProjects(ctx, organizationID, 0)
}

func (c *Client) ListProjectsByOrganizationForUser(ctx context.Context, organizationID, userID int64) ([]usecase.ProjectSummary, error) {
	if userID <= 0 {
		return nil, fmt.Errorf("user id must be positive")
	}
	return c.listProjects(ctx, organizationID, userID)
}

func (c *Client) listProjects(ctx context.Context, organizationID, userID int64) ([]usecase.ProjectSummary, error) {
	if organizationID <= 0 {
		return nil, fmt.Errorf("organization id must be positive")
	}

	token, err := internaljwt.SignHS256(
		c.jwtSecret,
		c.jwtIssuer,
		"project-service",
		"organizations-service",
		internaljwt.TokenClaims{OrganizationID: organizationID, UserID: userID},
		60*time.Second,
	)
	if err != nil {
		return nil, fmt.Errorf("sign internal jwt: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/projects", nil)
	if err != nil {
		return nil, fmt.Errorf("create project request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send project request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<10))
		message := strings.TrimSpace(string(raw))
		if message == "" {
			message = http.StatusText(resp.StatusCode)
		}
		return nil, fmt.Errorf("project service error (%d): %s", resp.StatusCode, message)
	}

	var envelope struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		return nil, fmt.Errorf("decode project response: %w", err)
	}

	rawProjects := envelope.Data
	if len(rawProjects) == 0 {
		rawProjects = []byte("[]")
	}

	var items []struct {
		ID                string `json:"id"`
		OrganizationID    int64  `json:"organizationId"`
		Name              string `json:"name"`
		BrandName         string `json:"brandName"`
		BrandDescription  string `json:"brandDescription"`
		AttributionSource string `json:"attributionSource"`
		CreatedAt         string `json:"createdAt"`
	}
	if err := json.Unmarshal(rawProjects, &items); err != nil {
		return nil, fmt.Errorf("decode projects payload: %w", err)
	}

	projects := make([]usecase.ProjectSummary, 0, len(items))
	for _, item := range items {
		var createdAt time.Time
		if strings.TrimSpace(item.CreatedAt) != "" {
			if parsed, err := time.Parse(time.RFC3339, item.CreatedAt); err == nil {
				createdAt = parsed.UTC()
			}
		}

		projects = append(projects, usecase.ProjectSummary{
			ID:                strings.TrimSpace(item.ID),
			OrganizationID:    item.OrganizationID,
			Name:              strings.TrimSpace(item.Name),
			BrandName:         strings.TrimSpace(item.BrandName),
			BrandDescription:  strings.TrimSpace(item.BrandDescription),
			AttributionSource: strings.TrimSpace(item.AttributionSource),
			CreatedAt:         createdAt,
		})
	}

	return projects, nil
}

func (c *Client) AssignProjectMember(ctx context.Context, projectID string, organizationID, userID int64, role string) error {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return fmt.Errorf("project id is required")
	}
	if organizationID <= 0 || userID <= 0 {
		return fmt.Errorf("organization id and user id must be positive")
	}

	token, err := internaljwt.SignHS256(
		c.jwtSecret,
		c.jwtIssuer,
		"project-service",
		"organizations-service",
		internaljwt.TokenClaims{OrganizationID: organizationID},
		60*time.Second,
	)
	if err != nil {
		return fmt.Errorf("sign internal jwt: %w", err)
	}

	payload, err := json.Marshal(struct {
		UserID int64  `json:"userId"`
		Role   string `json:"role"`
	}{
		UserID: userID,
		Role:   strings.TrimSpace(role),
	})
	if err != nil {
		return fmt.Errorf("encode project member request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/projects/"+url.PathEscape(projectID)+"/members", bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create project member request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send project member request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<10))
		message := strings.TrimSpace(string(raw))
		if message == "" {
			message = http.StatusText(resp.StatusCode)
		}
		return fmt.Errorf("project service error (%d): %s", resp.StatusCode, message)
	}
	return nil
}
