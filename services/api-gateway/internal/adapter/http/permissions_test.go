package http

import (
	"net/http"
	"testing"
)

func TestShouldEnforcePermissionForProjectAndAnalysisRoutes(t *testing.T) {
	tests := []struct {
		name   string
		method string
		path   string
		want   bool
	}{
		{name: "projects list", method: http.MethodGet, path: "/projects", want: true},
		{name: "prompt update", method: http.MethodPatch, path: "/prompts/prm-1", want: true},
		{name: "competitor delete", method: http.MethodDelete, path: "/competitors/cmp-1", want: true},
		{name: "analysis dashboard", method: http.MethodGet, path: "/analysis/dashboard", want: true},
		{name: "health remains public", method: http.MethodGet, path: "/health", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := http.NewRequest(tt.method, tt.path, nil)
			if err != nil {
				t.Fatalf("new request: %v", err)
			}
			if got := shouldEnforcePermission(req); got != tt.want {
				t.Fatalf("expected %v, got %v for %s %s", tt.want, got, tt.method, tt.path)
			}
		})
	}
}

func TestRequiresOrganizationContextForProjectScopedRoutes(t *testing.T) {
	tests := []struct {
		name string
		path string
		want bool
	}{
		{name: "projects", path: "/projects", want: true},
		{name: "prompts", path: "/prompts/prm-1", want: true},
		{name: "competitors", path: "/competitors/cmp-1", want: true},
		{name: "analysis", path: "/analysis/dashboard", want: true},
		{name: "organizations", path: "/organizations/1", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, tt.path, nil)
			if err != nil {
				t.Fatalf("new request: %v", err)
			}
			if got := requiresOrganizationContext(req); got != tt.want {
				t.Fatalf("expected %v, got %v for %s", tt.want, got, tt.path)
			}
		})
	}
}
