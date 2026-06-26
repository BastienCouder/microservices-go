package billing

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	"github.com/bastiencouder/microservices-go/contracts/pkg/internalauth"
	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/usecase"
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
		jwtSecret:  strings.TrimSpace(jwtSecret),
		jwtIssuer:  strings.TrimSpace(jwtIssuer),
	}, nil
}

func (c *Client) GetMonthlyQuota(ctx context.Context, organizationID int64) (int, bool, error) {
	entitlements, found, err := c.GetOrganizationEntitlements(ctx, organizationID)
	if err != nil || !found {
		return 0, found, err
	}
	if entitlements.MonthlyQuota <= 0 {
		return 0, false, nil
	}
	return entitlements.MonthlyQuota, true, nil
}

func (c *Client) GetOrganizationEntitlements(ctx context.Context, organizationID int64) (usecase.BillingEntitlements, bool, error) {
	if organizationID <= 0 {
		return usecase.BillingEntitlements{}, false, fmt.Errorf("%w: organizationId must be positive", usecase.ErrValidation)
	}

	token, err := internalauth.SignInternalJWT(
		c.jwtSecret,
		c.jwtIssuer,
		"billing-service",
		"analysis-service",
		internalauth.Claims{Organization: organizationID},
	)
	if err != nil {
		return usecase.BillingEntitlements{}, false, fmt.Errorf("sign internal jwt: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		c.baseURL+"/billing/quotas/"+strconv.FormatInt(organizationID, 10),
		nil,
	)
	if err != nil {
		return usecase.BillingEntitlements{}, false, fmt.Errorf("create billing quota request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return usecase.BillingEntitlements{}, false, fmt.Errorf("send billing quota request: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode == http.StatusNotFound {
		return usecase.BillingEntitlements{}, false, nil
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<10))
		message := strings.TrimSpace(string(raw))
		if message == "" {
			message = http.StatusText(resp.StatusCode)
		}
		return usecase.BillingEntitlements{}, false, fmt.Errorf("billing service error (%d): %s", resp.StatusCode, message)
	}

	var payload struct {
		Plan          string `json:"plan"`
		MonthlyQuota  int    `json:"monthly_quota"`
		AllowAIBriefs bool   `json:"allow_ai_briefs"`
	}
	if err := httpjson.DecodeSuccessData(resp.Body, &payload); err != nil {
		return usecase.BillingEntitlements{}, false, fmt.Errorf("decode billing quota response: %w", err)
	}

	return usecase.BillingEntitlements{
		Plan:          strings.TrimSpace(payload.Plan),
		MonthlyQuota:  payload.MonthlyQuota,
		AllowAIBriefs: payload.AllowAIBriefs,
	}, true, nil
}
