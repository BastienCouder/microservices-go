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
	if organizationID <= 0 {
		return 0, false, fmt.Errorf("%w: organizationId must be positive", usecase.ErrValidation)
	}

	token, err := internalauth.SignInternalJWT(
		c.jwtSecret,
		c.jwtIssuer,
		"billing-service",
		"analysis-service",
		internalauth.Claims{Organization: organizationID},
	)
	if err != nil {
		return 0, false, fmt.Errorf("sign internal jwt: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		c.baseURL+"/billing/quotas/"+strconv.FormatInt(organizationID, 10),
		nil,
	)
	if err != nil {
		return 0, false, fmt.Errorf("create billing quota request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, false, fmt.Errorf("send billing quota request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return 0, false, nil
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<10))
		message := strings.TrimSpace(string(raw))
		if message == "" {
			message = http.StatusText(resp.StatusCode)
		}
		return 0, false, fmt.Errorf("billing service error (%d): %s", resp.StatusCode, message)
	}

	var payload struct {
		MonthlyQuota int `json:"monthly_quota"`
	}
	if err := httpjson.DecodeSuccessData(resp.Body, &payload); err != nil {
		return 0, false, fmt.Errorf("decode billing quota response: %w", err)
	}

	if payload.MonthlyQuota <= 0 {
		return 0, false, nil
	}

	return payload.MonthlyQuota, true, nil
}
