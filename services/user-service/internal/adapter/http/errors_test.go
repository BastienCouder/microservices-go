package http

import (
	"encoding/json"
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bastiencouder/microservices-go/services/user-service/internal/usecase"
)

func TestUserHandlerWritesStructuredNotFoundError(t *testing.T) {
	repo := &handlerFakeRepo{}
	svc := usecase.NewService(repo)
	handler := NewHandler(svc, nil)
	mux := http.NewServeMux()
	handler.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/users/me", nil)
	req.Header.Set("X-Authenticated-Identity-ID", "missing-identity")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", rec.Code, rec.Body.String())
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
	if payload.Error.Code != "not_found" {
		t.Fatalf("expected not_found code, got %q", payload.Error.Code)
	}
	if payload.Error.Message != httpjson.NotFoundMessage {
		t.Fatalf("expected not found message %q, got %q", httpjson.NotFoundMessage, payload.Error.Message)
	}
}

func TestUserWriteErrorUsesRateLimitedCode(t *testing.T) {
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
