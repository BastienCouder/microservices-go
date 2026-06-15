package onboarding

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestBootstrapUsesOrganizationIDFromSuccessEnvelope(t *testing.T) {
	organizationServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/organizations" {
			t.Fatalf("unexpected organization request: %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"success":true,"data":{"ID":42,"Name":"Acme"}}`))
	}))
	defer organizationServer.Close()

	projectServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/projects":
			_, _ = w.Write([]byte(`{"success":true,"data":{"ID":"project-42"}}`))
		case r.Method == http.MethodPatch && r.URL.Path == "/projects/project-42/brand-canon":
			_, _ = w.Write([]byte(`{"success":true,"data":{}}`))
		case r.Method == http.MethodPatch && r.URL.Path == "/projects/project-42/models":
			_, _ = w.Write([]byte(`{"success":true,"data":{}}`))
		default:
			t.Fatalf("unexpected project request: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer projectServer.Close()

	svc := NewService(
		http.DefaultClient,
		organizationServer.URL,
		projectServer.URL,
		"test-secret",
		"api-gateway",
	)

	result, err := svc.Bootstrap(context.Background(), Identity{
		IdentityID: "identity-1",
		UserID:     1,
	}, Request{
		OrganizationName: "Acme",
		BrandName:        "Acme",
		WebsiteURL:       "https://acme.example",
		ModelIDs:         []string{"gemma-3-4b-free"},
	})
	if err != nil {
		t.Fatalf("unexpected bootstrap error: %v", err)
	}
	if result.OrganizationID != "42" {
		t.Fatalf("expected organization id 42, got %q", result.OrganizationID)
	}
	if result.ProjectID != "project-42" {
		t.Fatalf("expected project id project-42, got %q", result.ProjectID)
	}
}
