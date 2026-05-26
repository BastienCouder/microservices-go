package billing

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/project-service/internal/security"
	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
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
		return nil, fmt.Errorf("billing service url is required")
	}
	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: defaultHTTPTimeout},
		jwtSecret:  jwtSecret,
		jwtIssuer:  jwtIssuer,
	}, nil
}

func (c *Client) GetOrganizationEntitlements(ctx context.Context, organizationID int64) (usecase.BillingEntitlements, error) {
	if organizationID <= 0 {
		return usecase.BillingEntitlements{}, fmt.Errorf("organization id is required")
	}

	token, err := security.SignInternalJWT(
		c.jwtSecret,
		c.jwtIssuer,
		"billing-service",
		"project-service",
		security.OutboundTokenClaims{Organization: organizationID},
	)
	if err != nil {
		return usecase.BillingEntitlements{}, fmt.Errorf("sign internal jwt: %w", err)
	}

	endpoint := c.baseURL + "/billing/quotas/" + url.PathEscape(strconv.FormatInt(organizationID, 10))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return usecase.BillingEntitlements{}, fmt.Errorf("create billing request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return usecase.BillingEntitlements{}, fmt.Errorf("send billing request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<10))
		message := strings.TrimSpace(string(raw))
		if message == "" {
			message = http.StatusText(resp.StatusCode)
		}
		return usecase.BillingEntitlements{}, fmt.Errorf("billing service error (%d): %s", resp.StatusCode, message)
	}

	var payload struct {
		Plan                    string `json:"plan"`
		ModelSelectionLimit     int    `json:"model_selection_limit"`
		MonthlyModelChangeLimit int    `json:"monthly_model_change_limit"`
		MaxProjects             int    `json:"max_projects"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return usecase.BillingEntitlements{}, fmt.Errorf("decode billing response: %w", err)
	}

	return usecase.BillingEntitlements{
		Plan:                    strings.TrimSpace(payload.Plan),
		ModelSelectionLimit:     payload.ModelSelectionLimit,
		MonthlyModelChangeLimit: payload.MonthlyModelChangeLimit,
		MaxProjects:             payload.MaxProjects,
	}, nil
}
