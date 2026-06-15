package permission

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	internaljwt "github.com/bastiencouder/microservices-go/contracts/pkg/internaljwt"
	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/domain"
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
		return nil, fmt.Errorf("permission service url is required")
	}

	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: defaultHTTPTimeout},
		jwtSecret:  strings.TrimSpace(jwtSecret),
		jwtIssuer:  strings.TrimSpace(jwtIssuer),
	}, nil
}

func (c *Client) ListOrganizationsByUser(ctx context.Context, userID int64) ([]domain.Membership, error) {
	req, err := c.newRequest(ctx, http.MethodGet, fmt.Sprintf("/internal/users/%d/organizations", userID), nil, 0, 0)
	if err != nil {
		return nil, err
	}

	var memberships []domain.Membership
	if err := c.do(req, &memberships); err != nil {
		return nil, err
	}
	return memberships, nil
}

func (c *Client) ListMembers(ctx context.Context, organizationID int64) ([]domain.Member, error) {
	req, err := c.newRequest(ctx, http.MethodGet, fmt.Sprintf("/internal/organizations/%d/members", organizationID), nil, organizationID, 0)
	if err != nil {
		return nil, err
	}

	var members []domain.Member
	if err := c.do(req, &members); err != nil {
		return nil, err
	}
	return members, nil
}

func (c *Client) UpsertMember(ctx context.Context, member *domain.Member) error {
	req, err := c.newRequest(
		ctx,
		http.MethodPut,
		fmt.Sprintf("/internal/organizations/%d/members/%d", member.OrganizationID, member.UserID),
		map[string]any{"roles": member.Roles},
		member.OrganizationID,
		member.UserID,
	)
	if err != nil {
		return err
	}

	var stored domain.Member
	return c.do(req, &stored)
}

func (c *Client) UpdateMemberRoles(ctx context.Context, organizationID, userID int64, roles []string) (*domain.Member, error) {
	req, err := c.newRequest(
		ctx,
		http.MethodPatch,
		fmt.Sprintf("/internal/organizations/%d/members/%d/roles", organizationID, userID),
		map[string]any{"roles": roles},
		organizationID,
		userID,
	)
	if err != nil {
		return nil, err
	}

	var member domain.Member
	if err := c.do(req, &member); err != nil {
		return nil, err
	}
	return &member, nil
}

func (c *Client) RemoveMember(ctx context.Context, organizationID, userID int64) error {
	req, err := c.newRequest(ctx, http.MethodDelete, fmt.Sprintf("/internal/organizations/%d/members/%d", organizationID, userID), nil, organizationID, userID)
	if err != nil {
		return err
	}
	return c.do(req, nil)
}

func (c *Client) ListProjectMembers(ctx context.Context, organizationID int64, projectID string) ([]domain.ProjectMember, error) {
	req, err := c.newRequest(
		ctx,
		http.MethodGet,
		fmt.Sprintf("/internal/organizations/%d/projects/%s/members", organizationID, strings.TrimSpace(projectID)),
		nil,
		organizationID,
		0,
	)
	if err != nil {
		return nil, err
	}

	var members []domain.ProjectMember
	if err := c.do(req, &members); err != nil {
		return nil, err
	}
	return members, nil
}

func (c *Client) ListProjectMembersByUser(ctx context.Context, organizationID, userID int64) ([]domain.ProjectMember, error) {
	req, err := c.newRequest(
		ctx,
		http.MethodGet,
		fmt.Sprintf("/internal/organizations/%d/users/%d/project-memberships", organizationID, userID),
		nil,
		organizationID,
		userID,
	)
	if err != nil {
		return nil, err
	}

	var members []domain.ProjectMember
	if err := c.do(req, &members); err != nil {
		return nil, err
	}
	return members, nil
}

func (c *Client) UpsertProjectMember(ctx context.Context, member *domain.ProjectMember) error {
	req, err := c.newRequest(
		ctx,
		http.MethodPut,
		fmt.Sprintf("/internal/organizations/%d/projects/%s/members/%d/role", member.OrganizationID, strings.TrimSpace(member.ProjectID), member.UserID),
		map[string]any{"role": member.Role},
		member.OrganizationID,
		member.UserID,
	)
	if err != nil {
		return err
	}

	var stored domain.ProjectMember
	return c.do(req, &stored)
}

func (c *Client) RemoveProjectMember(ctx context.Context, organizationID int64, projectID string, userID int64) error {
	req, err := c.newRequest(
		ctx,
		http.MethodDelete,
		fmt.Sprintf("/internal/organizations/%d/projects/%s/members/%d", organizationID, strings.TrimSpace(projectID), userID),
		nil,
		organizationID,
		userID,
	)
	if err != nil {
		return err
	}
	return c.do(req, nil)
}

func (c *Client) DeleteOrganizationPermissions(ctx context.Context, organizationID int64) error {
	req, err := c.newRequest(
		ctx,
		http.MethodDelete,
		fmt.Sprintf("/internal/organizations/%d/permissions", organizationID),
		nil,
		organizationID,
		0,
	)
	if err != nil {
		return err
	}
	return c.do(req, nil)
}

func (c *Client) newRequest(ctx context.Context, method, path string, body any, organizationID, userID int64) (*http.Request, error) {
	var payload io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("encode request body: %w", err)
		}
		payload = bytes.NewReader(raw)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, payload)
	if err != nil {
		return nil, fmt.Errorf("create permission request: %w", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	token, err := internaljwt.SignHS256(
		c.jwtSecret,
		c.jwtIssuer,
		"permission-service",
		"organizations-service",
		internaljwt.TokenClaims{OrganizationID: organizationID, UserID: userID},
		60*time.Second,
	)
	if err != nil {
		return nil, fmt.Errorf("sign internal jwt: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	if organizationID > 0 {
		req.Header.Set("X-Organization-ID", fmt.Sprintf("%d", organizationID))
	}
	return req, nil
}

func (c *Client) do(req *http.Request, out any) error {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send permission request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNoContent {
		return nil
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<10))
		message := strings.TrimSpace(string(raw))
		if message == "" {
			message = http.StatusText(resp.StatusCode)
		}
		return fmt.Errorf("permission service error (%d): %s", resp.StatusCode, message)
	}
	if out == nil {
		return nil
	}
	if err := httpjson.DecodeSuccessData(resp.Body, out); err != nil {
		return fmt.Errorf("decode permission response: %w", err)
	}
	return nil
}
