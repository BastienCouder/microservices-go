package security

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestInternalAuthMiddlewareAllowsHealthWithoutToken(t *testing.T) {
	t.Helper()

	var called bool
	handler := NewInternalAuthMiddleware("secret", "issuer", "project-service")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !called {
		t.Fatal("expected health request to reach downstream handler")
	}
	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, rec.Code)
	}
}

func TestInternalAuthMiddlewareProtectsMetricsWithoutToken(t *testing.T) {
	t.Helper()

	var called bool
	handler := NewInternalAuthMiddleware("secret", "issuer", "project-service")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if called {
		t.Fatal("expected metrics request without token to be blocked")
	}
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
	}
}
