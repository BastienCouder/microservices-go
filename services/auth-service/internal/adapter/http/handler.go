package http

import (
	"encoding/json"
	"net/http"

	"github.com/bastiencouder/microservices-go/services/auth-service/internal/usecase"
)

type Handler struct {
	svc           *usecase.Service
	allowedOrigin string
}

func NewHandler(svc *usecase.Service, allowedOrigin string) *Handler {
	return &Handler{svc: svc, allowedOrigin: allowedOrigin}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", h.health)
	mux.HandleFunc("/auth/validate", h.validate)
	mux.HandleFunc("/auth/me", h.me)
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "auth-service"})
}

func (h *Handler) validate(w http.ResponseWriter, r *http.Request) {
	if h.handlePreflight(w, r) {
		return
	}
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	h.setCORSHeaders(w)

	session, statusCode, err := h.svc.WhoAmI(r.Context(), r.Header.Get("Cookie"), r.Header.Get("X-Session-Token"))
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "kratos unavailable"})
		return
	}
	if statusCode != http.StatusOK || session == nil || !session.Active {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"authenticated": true,
		"session_id":    session.ID,
		"identity_id":   session.Identity.ID,
	})
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	if h.handlePreflight(w, r) {
		return
	}
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	h.setCORSHeaders(w)

	session, statusCode, err := h.svc.WhoAmI(r.Context(), r.Header.Get("Cookie"), r.Header.Get("X-Session-Token"))
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "kratos unavailable"})
		return
	}
	if statusCode != http.StatusOK || session == nil || !session.Active {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"identity_id": session.Identity.ID,
		"email":       session.Identity.Traits.Email,
		"name":        session.Identity.Traits.Name,
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func (h *Handler) setCORSHeaders(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", h.allowedOrigin)
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Session-Token, Cookie")
}

func (h *Handler) handlePreflight(w http.ResponseWriter, r *http.Request) bool {
	if r.Method != http.MethodOptions {
		return false
	}
	h.setCORSHeaders(w)
	w.WriteHeader(http.StatusNoContent)
	return true
}
