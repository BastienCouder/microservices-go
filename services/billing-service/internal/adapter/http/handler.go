package http

import (
	"context"
	"encoding/json"
	"errors"
	"io"
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
	mux.HandleFunc("POST /billing/stripe/checkout-session", h.createStripeCheckoutSession)
	mux.HandleFunc("POST /billing/stripe/customer-portal", h.createStripeCustomerPortalSession)
	mux.HandleFunc("POST /billing/stripe/webhook", h.handleStripeWebhook)
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

type createStripeCheckoutSessionRequest struct {
	OrganizationID    int64  `json:"organization_id"`
	ProjectID         string `json:"project_id"`
	AttributionSource string `json:"attribution_source"`
	Plan              string `json:"plan"`
	BillingCycle      string `json:"billing_cycle"`
	Seats             int    `json:"seats"`
	CorrectionCredits int    `json:"correction_credits"`
	SuccessURL        string `json:"success_url"`
	CancelURL         string `json:"cancel_url"`
	RequestID         string `json:"request_id"`
}

type createStripeCustomerPortalSessionRequest struct {
	OrganizationID int64  `json:"organization_id"`
	ReturnURL      string `json:"return_url"`
	RequestID      string `json:"request_id"`
}

var (
	errMissingOrganizationScope    = errors.New("missing organization scope")
	errInvalidOrganizationScope    = errors.New("invalid organization scope")
	errMismatchedOrganizationScope = errors.New("organization scope mismatch")
)

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
	if _, err := scopedOrganizationID(r, orgID); err != nil {
		switch {
		case errors.Is(err, errMissingOrganizationScope), errors.Is(err, errInvalidOrganizationScope):
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing authenticated organization"})
		case errors.Is(err, errMismatchedOrganizationScope):
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		default:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		}
		return
	}

	sub, err := h.svc.GetSubscription(r.Context(), orgID)
	entitlements := usecase.DefaultOrganizationEntitlements(orgID)
	if err != nil {
		if !errors.Is(err, domain.ErrSubscriptionMissing) {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
			return
		}
	} else {
		entitlements = usecase.EntitlementsFromSubscription(sub)
	}

	writeJSON(w, http.StatusOK, entitlements)
}

func (h *Handler) createStripeCheckoutSession(w http.ResponseWriter, r *http.Request) {
	var req createStripeCheckoutSessionRequest
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json payload"})
		return
	}
	organizationID, err := scopedOrganizationID(r, req.OrganizationID)
	if err != nil {
		switch {
		case errors.Is(err, errMissingOrganizationScope), errors.Is(err, errInvalidOrganizationScope):
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing authenticated organization"})
		case errors.Is(err, errMismatchedOrganizationScope):
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		default:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		}
		return
	}

	out, err := h.svc.CreateStripeCheckoutSession(r.Context(), usecase.CreateStripeCheckoutSessionInput{
		OrganizationID:    organizationID,
		ProjectID:         req.ProjectID,
		AttributionSource: req.AttributionSource,
		Plan:              req.Plan,
		BillingCycle:      req.BillingCycle,
		Seats:             req.Seats,
		CorrectionCredits: req.CorrectionCredits,
		SuccessURL:        req.SuccessURL,
		CancelURL:         req.CancelURL,
		RequestID:         req.RequestID,
	})
	if err != nil {
		switch {
		case errors.Is(err, usecase.ErrStripeDisabled):
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "stripe integration is disabled"})
		case errors.Is(err, usecase.ErrStripeInvalidRequest),
			errors.Is(err, usecase.ErrStripeUnsupportedPlan),
			errors.Is(err, usecase.ErrStripeUnsupportedCycle),
			errors.Is(err, domain.ErrInvalidSubscription):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		}
		return
	}

	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) createStripeCustomerPortalSession(w http.ResponseWriter, r *http.Request) {
	var req createStripeCustomerPortalSessionRequest
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json payload"})
		return
	}
	organizationID, err := scopedOrganizationID(r, req.OrganizationID)
	if err != nil {
		switch {
		case errors.Is(err, errMissingOrganizationScope), errors.Is(err, errInvalidOrganizationScope):
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing authenticated organization"})
		case errors.Is(err, errMismatchedOrganizationScope):
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		default:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		}
		return
	}

	out, err := h.svc.CreateStripeCustomerPortalSession(r.Context(), usecase.CreateStripeCustomerPortalSessionInput{
		OrganizationID: organizationID,
		ReturnURL:      req.ReturnURL,
		RequestID:      req.RequestID,
	})
	if err != nil {
		switch {
		case errors.Is(err, usecase.ErrStripeDisabled):
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "stripe integration is disabled"})
		case errors.Is(err, usecase.ErrStripeInvalidRequest),
			errors.Is(err, usecase.ErrStripeCustomerMissing),
			errors.Is(err, domain.ErrSubscriptionMissing):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		}
		return
	}

	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) handleStripeWebhook(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	payload, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid webhook payload"})
		return
	}

	signature := strings.TrimSpace(r.Header.Get("Stripe-Signature"))
	if err := h.svc.HandleStripeWebhook(r.Context(), payload, signature); err != nil {
		switch {
		case errors.Is(err, usecase.ErrStripeDisabled):
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "stripe integration is disabled"})
		case errors.Is(err, usecase.ErrStripeInvalidSignature):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid stripe signature"})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		}
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func scopedOrganizationID(r *http.Request, requestedOrgID int64) (int64, error) {
	raw := strings.TrimSpace(r.Header.Get("X-Organization-ID"))
	if raw == "" {
		return 0, errMissingOrganizationScope
	}
	orgID, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || orgID <= 0 {
		return 0, errInvalidOrganizationScope
	}
	if requestedOrgID > 0 && requestedOrgID != orgID {
		return 0, errMismatchedOrganizationScope
	}
	return orgID, nil
}
