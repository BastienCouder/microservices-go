package http

import (
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	"net/http"
	"strings"
	"time"
)

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("/", h.route)
}

func (h *Handler) route(w http.ResponseWriter, r *http.Request) {
	if h.handleCORS(w, r) {
		return
	}

	if !isHealthRequest(r) && !h.rateLimiter.Allow(h.clientIP(r)) {
		httpjson.WriteRateLimitExceeded(w)
		auditAccess(r, "api-gateway", http.StatusTooManyRequests, 0, time.Now().UTC())
		return
	}

	for _, route := range h.routes {
		if route.match(r) {
			started := time.Now().UTC()
			recorder := newStatusRecorder(w)
			route.handler.ServeHTTP(recorder, r)
			auditAccess(r, route.service, recorder.status, recorder.bytes, started)
			return
		}
	}
	started := time.Now().UTC()
	http.NotFound(w, r)
	auditAccess(r, "api-gateway", http.StatusNotFound, 0, started)
}

func (h *Handler) handleCORS(w http.ResponseWriter, r *http.Request) bool {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return false
	}

	if _, ok := h.corsAllowedOrigins[origin]; !ok {
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return true
		}
		return false
	}

	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Session-Token, X-Organization-ID")
	w.Header().Add("Vary", "Origin")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return true
	}
	return false
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "api-gateway",
	})
}
