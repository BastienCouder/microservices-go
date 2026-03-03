package http

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"
	"github.com/bastiencouder/microservices-go/services/billing-service/internal/usecase"
)

type Handler struct {
	svc        *usecase.Service
	readyCheck func(context.Context) error
}

func NewHandler(svc *usecase.Service, readyCheck func(context.Context) error) *Handler {
	return &Handler{svc: svc, readyCheck: readyCheck}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", h.health)
	mux.HandleFunc("GET /ready", h.ready)
	mux.HandleFunc("POST /billing/subscriptions", h.upsertSubscription)
	mux.HandleFunc("GET /billing/quotas/", h.getQuota)
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "billing-service"})
}

func (h *Handler) ready(w http.ResponseWriter, r *http.Request) {
	if h.readyCheck == nil || h.readyCheck(r.Context()) == nil {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "billing-service"})
		return
	}
	writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "service": "billing-service"})
}

type upsertSubscriptionRequest struct {
	OrganizationID int64  `json:"organization_id"`
	Plan           string `json:"plan"`
	Seats          int    `json:"seats"`
	MonthlyQuota   int    `json:"monthly_quota"`
}

func (h *Handler) upsertSubscription(w http.ResponseWriter, r *http.Request) {
	var req upsertSubscriptionRequest
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json payload"})
		return
	}

	sub, err := h.svc.UpsertSubscription(r.Context(), req.OrganizationID, req.Plan, req.Seats, req.MonthlyQuota)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidSubscription) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, sub)
}

func (h *Handler) getQuota(w http.ResponseWriter, r *http.Request) {
	orgIDStr := strings.TrimPrefix(r.URL.Path, "/billing/quotas/")
	orgID, err := strconv.ParseInt(orgIDStr, 10, 64)
	if err != nil || orgID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid organization id"})
		return
	}

	sub, err := h.svc.GetSubscription(r.Context(), orgID)
	if err != nil {
		if errors.Is(err, domain.ErrSubscriptionMissing) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "subscription not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"organization_id": sub.OrganizationID,
		"plan":            sub.Plan,
		"monthly_quota":   sub.MonthlyQuota,
		"seats":           sub.Seats,
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
