package projectapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/contracts/pkg/internalauth"
	"github.com/bastiencouder/microservices-go/services/attribution-service/internal/usecase"
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

func (c *Client) GetProject(ctx context.Context, projectID string, organizationID int64) (usecase.ProjectMetadata, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return usecase.ProjectMetadata{}, fmt.Errorf("project id is required")
	}

	token, err := internalauth.SignInternalJWT(
		c.jwtSecret,
		c.jwtIssuer,
		"project-service",
		"attribution-service",
		internalauth.Claims{Organization: organizationID},
	)
	if err != nil {
		return usecase.ProjectMetadata{}, fmt.Errorf("sign internal jwt: %w", err)
	}

	endpoint := c.baseURL + "/internal/projects/" + url.PathEscape(projectID) + "/impact-context"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return usecase.ProjectMetadata{}, fmt.Errorf("create project request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return usecase.ProjectMetadata{}, fmt.Errorf("send project request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<10))
		message := strings.TrimSpace(string(raw))
		if message == "" {
			message = http.StatusText(resp.StatusCode)
		}
		return usecase.ProjectMetadata{}, fmt.Errorf("project service error (%d): %s", resp.StatusCode, message)
	}

	var envelope struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		return usecase.ProjectMetadata{}, fmt.Errorf("decode project response: %w", err)
	}

	var project struct {
		ProjectID      string `json:"projectId"`
		OrganizationID int64  `json:"organizationId"`
		Domain         string `json:"domain"`
		WebsiteURL     string `json:"websiteUrl"`
		Integrations   struct {
			GA4 struct {
				PropertyID         string `json:"propertyId"`
				ServiceAccountJSON string `json:"serviceAccountJSON"`
				OAuthRefreshToken  string `json:"oauthRefreshToken"`
			} `json:"ga4"`
			Stripe struct {
				WebhookSecret string `json:"webhookSecret"`
			} `json:"stripe"`
			Ingestion struct {
				SigningToken string `json:"signingToken"`
			} `json:"ingestion"`
		} `json:"integrations"`
	}
	if err := json.Unmarshal(envelope.Data, &project); err != nil {
		return usecase.ProjectMetadata{}, fmt.Errorf("decode project payload: %w", err)
	}

	return usecase.ProjectMetadata{
		ID:             strings.TrimSpace(project.ProjectID),
		OrganizationID: project.OrganizationID,
		Domain:         strings.TrimSpace(project.Domain),
		WebsiteURL:     strings.TrimSpace(project.WebsiteURL),
		GA4: usecase.ProjectGA4Integration{
			PropertyID:         strings.TrimSpace(project.Integrations.GA4.PropertyID),
			ServiceAccountJSON: strings.TrimSpace(project.Integrations.GA4.ServiceAccountJSON),
			OAuthRefreshToken:  strings.TrimSpace(project.Integrations.GA4.OAuthRefreshToken),
		},
		Stripe: usecase.ProjectStripeIntegration{
			WebhookSecret: strings.TrimSpace(project.Integrations.Stripe.WebhookSecret),
		},
		Ingestion: usecase.ProjectIngestionIntegration{
			SigningToken: strings.TrimSpace(project.Integrations.Ingestion.SigningToken),
		},
	}, nil
}
