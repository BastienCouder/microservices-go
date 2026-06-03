package http

import (
	"encoding/json"
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/usecase"
)

func TestOrganizationHandlerWritesStructuredValidationError(t *testing.T) {
	svc := usecase.NewService(stubRepo{})
	handler := NewHandler(svc, nil)
	mux := http.NewServeMux()
	handler.Register(mux)

	req := httptest.NewRequest(http.MethodPost, "/organizations", strings.NewReader(`{"name": ""}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Authenticated-User-ID", "7")
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
	if payload.Error.Message != httpjson.ValidationErrorMessage {
		t.Fatalf("expected validation message %q, got %q", httpjson.ValidationErrorMessage, payload.Error.Message)
	}
}

func TestOrganizationWriteErrorUsesRateLimitedCode(t *testing.T) {
	rec := httptest.NewRecorder()

	httpjson.WriteError(rec, http.StatusTooManyRequests, "rate limit exceeded")

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
