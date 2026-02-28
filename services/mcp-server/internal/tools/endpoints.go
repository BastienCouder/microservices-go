package tools

import "context"

import "github.com/modelcontextprotocol/go-sdk/mcp"

type EndpointsInput struct{}

type Endpoint struct {
	Service string `json:"service"`
	Method  string `json:"method"`
	Path    string `json:"path"`
}

type EndpointsOutput struct {
	BaseURL   string     `json:"base_url"`
	Endpoints []Endpoint `json:"endpoints"`
}

func ListEndpoints(_ context.Context, _ *mcp.CallToolRequest, _ EndpointsInput) (*mcp.CallToolResult, EndpointsOutput, error) {
	out := EndpointsOutput{
		BaseURL: "http://localhost:8080",
		Endpoints: []Endpoint{
			{Service: "api-gateway", Method: "GET", Path: "/health"},
			{Service: "auth-service", Method: "GET", Path: "/auth/validate"},
			{Service: "auth-service", Method: "GET", Path: "/auth/me"},
			{Service: "user-service", Method: "POST", Path: "/users"},
			{Service: "user-service", Method: "GET", Path: "/users/{id}"},
			{Service: "user-service", Method: "GET", Path: "/users/by-auth/{auth_identity_id}"},
			{Service: "organizations-service", Method: "POST", Path: "/organizations"},
			{Service: "organizations-service", Method: "GET", Path: "/organizations/{id}"},
			{Service: "organizations-service", Method: "POST", Path: "/organizations/{id}/teams"},
			{Service: "organizations-service", Method: "GET", Path: "/organizations/{id}/teams"},
			{Service: "organizations-service", Method: "POST", Path: "/organizations/{id}/members"},
			{Service: "organizations-service", Method: "GET", Path: "/organizations/{id}/members"},
			{Service: "organizations-service", Method: "POST", Path: "/organizations/{id}/members/{user_id}/roles"},
			{Service: "permission-service", Method: "POST", Path: "/permissions/check"},
			{Service: "billing-service", Method: "POST", Path: "/billing/subscriptions"},
			{Service: "billing-service", Method: "GET", Path: "/billing/quotas/{organization_id}"},
			{Service: "notification-service", Method: "POST", Path: "/notifications/send"},
			{Service: "notification-service", Method: "GET", Path: "/notifications?limit=20"},
		},
	}
	return nil, out, nil
}
