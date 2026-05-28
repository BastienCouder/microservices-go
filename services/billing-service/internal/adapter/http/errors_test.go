package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/usecase"
)

func TestBillingHandlerWritesStructuredValidationError(t *testing.T) {
	repo := &memoryRepo{}
	svc := usecase.NewService(repo)
	h := NewHandler(svc, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodPost, "/billing/subscriptions", strings.NewReader(`{
		"organization_id": 7,
		"plan": "growth",
		"seats": 0,
		"monthly_quota": 250
	}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Organization-ID", "7")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", rec.Code, rec.Body.String())
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
	if payload.Error.Code != "invalid_request" {
		t.Fatalf("expected invalid_request code, got %q", payload.Error.Code)
	}
	if !strings.Contains(payload.Error.Message, "seats must be positive") {
		t.Fatalf("expected validation message, got %q", payload.Error.Message)
	}
}

func TestBillingWriteErrorUsesRateLimitedCode(t *testing.T) {
	rec := httptest.NewRecorder()

	writeError(rec, http.StatusTooManyRequests, "rate limit exceeded")

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d body=%s", rec.Code, rec.Body.String())
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
	if payload.Error.Code != "rate_limited" {
		t.Fatalf("expected rate_limited code, got %q", payload.Error.Code)
	}
	if payload.Error.Message != "rate limit exceeded" {
		t.Fatalf("expected rate limit message, got %q", payload.Error.Message)
	}
}
