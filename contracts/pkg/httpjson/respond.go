package httpjson

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

const (
	InvalidJSONMessage           = "invalid json payload"
	MethodNotAllowedMessage      = "method not allowed"
	RateLimitExceededMessage     = "rate limit exceeded"
	QuotaExceededMessage         = "quota exceeded"
	ValidationErrorMessage       = "validation error"
	NotFoundMessage              = "resource not found"
	ForbiddenMessage             = "forbidden"
	ConflictMessage              = "conflict"
	DependencyUnavailableMessage = "dependency unavailable"
	InternalErrorMessage         = "internal server error"
)

var ErrInvalidJSON = errors.New(InvalidJSONMessage)

func DecodeJSON(w http.ResponseWriter, r *http.Request, out any) error {
	if r.Body == nil {
		return ErrInvalidJSON
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(out); err != nil {
		return ErrInvalidJSON
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return ErrInvalidJSON
	}
	return nil
}

func WriteInvalidJSON(w http.ResponseWriter) {
	WriteError(w, http.StatusBadRequest, InvalidJSONMessage)
}

func WriteMethodNotAllowed(w http.ResponseWriter) {
	WriteError(w, http.StatusMethodNotAllowed, MethodNotAllowedMessage)
}

func WriteRateLimitExceeded(w http.ResponseWriter) {
	WriteError(w, http.StatusTooManyRequests, RateLimitExceededMessage)
}

func WriteQuotaExceeded(w http.ResponseWriter) {
	WriteErrorWithCode(w, http.StatusTooManyRequests, "quota_exceeded", QuotaExceededMessage)
}

func WriteValidationError(w http.ResponseWriter) {
	WriteError(w, http.StatusBadRequest, ValidationErrorMessage)
}

func WriteNotFoundError(w http.ResponseWriter) {
	WriteError(w, http.StatusNotFound, NotFoundMessage)
}

func WriteForbiddenError(w http.ResponseWriter) {
	WriteError(w, http.StatusForbidden, ForbiddenMessage)
}

func WriteConflictError(w http.ResponseWriter) {
	WriteError(w, http.StatusConflict, ConflictMessage)
}

func WriteDependencyUnavailable(w http.ResponseWriter) {
	WriteError(w, http.StatusServiceUnavailable, DependencyUnavailableMessage)
}

func WriteInternalError(w http.ResponseWriter) {
	WriteError(w, http.StatusInternalServerError, InternalErrorMessage)
}

func WriteSuccess(w http.ResponseWriter, status int, data any) {
	WriteJSON(w, status, map[string]any{"success": true, "data": data})
}

func WriteJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func DecodeSuccessData(r io.Reader, out any) error {
	body, err := io.ReadAll(r)
	if err != nil {
		return err
	}
	body = bytes.TrimSpace(body)
	if len(body) == 0 {
		return nil
	}

	var envelope struct {
		Success *bool           `json:"success"`
		Data    json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(body, &envelope); err == nil && (envelope.Success != nil || envelope.Data != nil) {
		if len(envelope.Data) == 0 || bytes.Equal(bytes.TrimSpace(envelope.Data), []byte("null")) {
			return nil
		}
		return json.Unmarshal(envelope.Data, out)
	}

	return json.Unmarshal(body, out)
}
