package http

import (
	"encoding/json"
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPermissionWriteErrorUsesRateLimitedCode(t *testing.T) {
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
