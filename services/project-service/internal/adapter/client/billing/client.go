package billing

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	"github.com/bastiencouder/microservices-go/contracts/pkg/internalauth"
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

	token, err := internalauth.SignInternalJWT(
		c.jwtSecret,
		c.jwtIssuer,
		"billing-service",
		"project-service",
		internalauth.Claims{Organization: organizationID},
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
	defer func() {
		_ = resp.Body.Close()
	}()

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
	if err := httpjson.DecodeSuccessData(resp.Body, &payload); err != nil {
		return usecase.BillingEntitlements{}, fmt.Errorf("decode billing response: %w", err)
	}

	return usecase.BillingEntitlements{
		Plan:                    strings.TrimSpace(payload.Plan),
		ModelSelectionLimit:     payload.ModelSelectionLimit,
		MonthlyModelChangeLimit: payload.MonthlyModelChangeLimit,
		MaxProjects:             payload.MaxProjects,
	}, nil
}

func (c *Client) GetCreditCostSettings(ctx context.Context) (usecase.CreditCostSettings, error) {
	token, err := internalauth.SignInternalJWT(
		c.jwtSecret,
		c.jwtIssuer,
		"billing-service",
		"project-service",
		internalauth.Claims{},
	)
	if err != nil {
		return usecase.CreditCostSettings{}, fmt.Errorf("sign internal jwt: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/billing/credit-cost-settings", nil)
	if err != nil {
		return usecase.CreditCostSettings{}, fmt.Errorf("create billing request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return usecase.CreditCostSettings{}, fmt.Errorf("send billing request: %w", err)
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
		return usecase.CreditCostSettings{}, fmt.Errorf("billing service error (%d): %s", resp.StatusCode, message)
	}

	var payload struct {
		DefaultCreditCost int `json:"default_credit_cost"`
		Rules             []struct {
			MinPricePerMillion float64 `json:"min_price_per_million"`
			CreditCost         int     `json:"credit_cost"`
		} `json:"rules"`
	}
	if err := httpjson.DecodeSuccessData(resp.Body, &payload); err != nil {
		return usecase.CreditCostSettings{}, fmt.Errorf("decode billing response: %w", err)
	}

	settings := usecase.CreditCostSettings{
		DefaultCreditCost: payload.DefaultCreditCost,
		Rules:             make([]usecase.CreditCostRule, 0, len(payload.Rules)),
	}
	for _, rule := range payload.Rules {
		settings.Rules = append(settings.Rules, usecase.CreditCostRule{
			MinPricePerMillion: rule.MinPricePerMillion,
			CreditCost:         rule.CreditCost,
		})
	}
	return settings, nil
}
