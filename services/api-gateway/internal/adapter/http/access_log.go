package http

import (
	"net/http"
	"time"
)

type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func newStatusRecorder(w http.ResponseWriter) *statusRecorder {
	return &statusRecorder{ResponseWriter: w, status: http.StatusOK}
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func (r *statusRecorder) Write(body []byte) (int, error) {
	written, err := r.ResponseWriter.Write(body)
	r.bytes += written
	return written, err
}

func auditAccess(r *http.Request, service string, status int, bytes int, started time.Time) {
	identityID := r.Header.Get("X-Authenticated-Identity-ID")
	userID := r.Header.Get("X-Authenticated-User-ID")
	orgID := r.Header.Get("X-Organization-ID")

	auditSecurityEvent("http_access", map[string]any{
		"service":      service,
		"method":       r.Method,
		"path":         r.URL.Path,
		"query":        r.URL.RawQuery,
		"status":       status,
		"bytes":        bytes,
		"duration_ms":  time.Since(started).Milliseconds(),
		"origin":       r.Header.Get("Origin"),
		"referer":      r.Header.Get("Referer"),
		"identity_id":  identityID,
		"user_id":      userID,
		"organization": orgID,
	})
}
