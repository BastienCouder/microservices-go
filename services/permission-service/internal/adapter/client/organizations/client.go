package organizations

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{baseURL: strings.TrimRight(baseURL, "/"), httpClient: &http.Client{}}
}

func (c *Client) RolesForUser(ctx context.Context, organizationID, userID int64) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/organizations/%d/members", c.baseURL, organizationID), nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("organizations response status: %d", resp.StatusCode)
	}

	var members []struct {
		UserID int64    `json:"user_id"`
		Roles  []string `json:"roles"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&members); err != nil {
		return nil, err
	}

	for _, member := range members {
		if member.UserID == userID {
			return append([]string(nil), member.Roles...), nil
		}
	}
	return nil, nil
}
