package httpjson

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDecodeJSONRejectsInvalidPayload(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader("{"))
	rec := httptest.NewRecorder()

	var payload struct {
		Name string `json:"name"`
	}
	err := DecodeJSON(rec, req, &payload)
	if err == nil {
		t.Fatal("expected invalid json error")
	}
	if err != ErrInvalidJSON {
		t.Fatalf("expected ErrInvalidJSON, got %v", err)
	}
}

func TestDecodeJSONRejectsTrailingPayload(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"ok"}{"extra":true}`))
	rec := httptest.NewRecorder()

	var payload struct {
		Name string `json:"name"`
	}
	err := DecodeJSON(rec, req, &payload)
	if err == nil {
		t.Fatal("expected invalid json error")
	}
	if err != ErrInvalidJSON {
		t.Fatalf("expected ErrInvalidJSON, got %v", err)
	}
}

func TestWriteMethodNotAllowed(t *testing.T) {
	rec := httptest.NewRecorder()

	WriteMethodNotAllowed(rec)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected %d, got %d", http.StatusMethodNotAllowed, rec.Code)
	}
	if !strings.Contains(rec.Body.String(), MethodNotAllowedMessage) {
		t.Fatalf("expected method not allowed message, got %q", rec.Body.String())
	}
}

func TestWriteRateLimitExceeded(t *testing.T) {
	rec := httptest.NewRecorder()

	WriteRateLimitExceeded(rec)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected %d, got %d", http.StatusTooManyRequests, rec.Code)
	}
	if !strings.Contains(rec.Body.String(), RateLimitExceededMessage) {
		t.Fatalf("expected rate limit exceeded message, got %q", rec.Body.String())
	}
}

func TestWriteQuotaExceeded(t *testing.T) {
	rec := httptest.NewRecorder()

	WriteQuotaExceeded(rec)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected %d, got %d", http.StatusTooManyRequests, rec.Code)
	}
	if !strings.Contains(rec.Body.String(), QuotaExceededMessage) {
		t.Fatalf("expected quota exceeded message, got %q", rec.Body.String())
	}

	var payload struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Error.Code != "quota_exceeded" {
		t.Fatalf("expected quota_exceeded code, got %q", payload.Error.Code)
	}
}

func TestDecodeSuccessDataFromEnvelope(t *testing.T) {
	var payload struct {
		Name string `json:"name"`
	}

	err := DecodeSuccessData(strings.NewReader(`{"success":true,"data":{"name":"Acme"}}`), &payload)
	if err != nil {
		t.Fatalf("decode envelope: %v", err)
	}
	if payload.Name != "Acme" {
		t.Fatalf("expected Acme, got %q", payload.Name)
	}
}

func TestDecodeSuccessDataFromRawPayload(t *testing.T) {
	var payload struct {
		Name string `json:"name"`
	}

	err := DecodeSuccessData(strings.NewReader(`{"name":"Acme"}`), &payload)
	if err != nil {
		t.Fatalf("decode raw payload: %v", err)
	}
	if payload.Name != "Acme" {
		t.Fatalf("expected Acme, got %q", payload.Name)
	}
}
