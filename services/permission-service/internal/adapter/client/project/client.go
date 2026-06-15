package project

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	internaljwt "github.com/bastiencouder/microservices-go/contracts/pkg/internaljwt"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
	secret     string
	issuer     string
}

func NewClient(baseURL, secret, issuer string) *Client {
	return &Client{
		baseURL:    strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		httpClient: &http.Client{},
		secret:     secret,
		issuer:     issuer,
	}
}

func (c *Client) ResolveProjectID(ctx context.Context, organizationID int64, resource, resourceID string) (string, error) {
	resource = strings.ToLower(strings.TrimSpace(resource))
	resourceID = strings.TrimSpace(resourceID)
	if resourceID == "" {
		return "", nil
	}

	path := ""
	switch resource {
	case "projects":
		return resourceID, nil
	case "prompts":
		path = "/internal/prompts/" + resourceID + "/scope"
	case "competitors":
		path = "/internal/competitors/" + resourceID + "/scope"
	default:
		return "", nil
	}

	token, err := internaljwt.SignHS256(
		c.secret,
		c.issuer,
		"project-service",
		"permission-service",
		internaljwt.TokenClaims{OrganizationID: organizationID},
		60*time.Second,
	)
	if err != nil {
		return "", fmt.Errorf("sign internal jwt: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-Organization-ID", fmt.Sprintf("%d", organizationID))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return "", nil
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("project scope response status: %d", resp.StatusCode)
	}

	var payload struct {
		ProjectID string `json:"projectId"`
	}
	if err := httpjson.DecodeSuccessData(resp.Body, &payload); err != nil {
		return "", err
	}
	return strings.TrimSpace(payload.ProjectID), nil
}
