package organizations

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
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{},
		secret:     secret,
		issuer:     issuer,
	}
}

func (c *Client) RolesForUser(ctx context.Context, organizationID, userID int64) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/organizations/%d/members", c.baseURL, organizationID), nil)
	if err != nil {
		return nil, err
	}
	token, err := internaljwt.SignHS256(
		c.secret,
		c.issuer,
		"organizations-service",
		"permission-service",
		internaljwt.TokenClaims{
			UserID:         userID,
			OrganizationID: organizationID,
		},
		60*time.Second,
	)
	if err != nil {
		return nil, fmt.Errorf("sign internal jwt: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("organizations response status: %d", resp.StatusCode)
	}

	var members []struct {
		UserID int64
		Roles  []string
	}
	if err := httpjson.DecodeSuccessData(resp.Body, &members); err != nil {
		return nil, err
	}

	for _, member := range members {
		if member.UserID == userID {
			return append([]string(nil), member.Roles...), nil
		}
	}
	return nil, nil
}
