package internalauth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHTTPMiddlewareAllowsHealthWithoutToken(t *testing.T) {
	var called bool
	handler := NewHTTPMiddleware("secret", "issuer", "project-service")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
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

func TestHTTPMiddlewareProtectsMetricsWithoutToken(t *testing.T) {
	var called bool
	handler := NewHTTPMiddleware("secret", "issuer", "project-service")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
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

	var payload struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Error.Code != "unauthorized" {
		t.Fatalf("expected unauthorized code, got %q", payload.Error.Code)
	}
	if payload.Error.Message != "invalid internal authorization" {
		t.Fatalf("expected internal authorization message, got %q", payload.Error.Message)
	}
}
