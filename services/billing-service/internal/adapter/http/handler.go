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
	mux.HandleFunc("GET /billing/plans", h.listPlanSettings)
	mux.HandleFunc("GET /billing/public/plans", h.listPlanSettings)
	mux.HandleFunc("GET /billing/pricing-tiers", h.listPricingTiers)
	mux.HandleFunc("GET /billing/public/pricing-tiers", h.listPricingTiers)
	mux.HandleFunc("POST /billing/plans", h.updatePlanSettings)
	mux.HandleFunc("POST /billing/pricing-tiers", h.updatePricingTier)
	mux.HandleFunc("DELETE /billing/pricing-tiers/{prompt_volume}", h.deletePricingTier)
	mux.HandleFunc("POST /billing/subscriptions", h.upsertSubscription)
	mux.HandleFunc("GET /billing/quotas/", h.getQuota)
	mux.HandleFunc("POST /billing/stripe/checkout-session", h.createStripeCheckoutSession)
	mux.HandleFunc("POST /billing/stripe/customer-portal", h.createStripeCustomerPortalSession)
	mux.HandleFunc("POST /billing/stripe/pricing-catalog/plans/{plan}/sync", h.syncStripePricingCatalog)
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

type updatePlanSettingsRequest struct {
	Plan                    string `json:"plan"`
	MonthlyPriceCents       int    `json:"monthly_price_cents"`
	YearlyPriceCents        int    `json:"yearly_price_cents"`
	MonthlyQuota            int    `json:"monthly_quota"`
	ModelSelectionLimit     int    `json:"model_selection_limit"`
	MonthlyModelChangeLimit int    `json:"monthly_model_change_limit"`
	MaxProjects             int    `json:"max_projects"`
	IsMostChosen            bool   `json:"is_most_chosen"`
}

type updatePricingTierRequest struct {
	PromptVolume        int             `json:"prompt_volume"`
	Label               string          `json:"label"`
	Prices              map[string]*int `json:"prices"`
	DeveloperPriceCents *int            `json:"developer_price_cents"`
	StarterPriceCents   *int            `json:"starter_price_cents"`
	GrowthPriceCents    *int            `json:"growth_price_cents"`
	ProPriceCents       *int            `json:"pro_price_cents"`
}

type createStripeCheckoutSessionRequest struct {
	OrganizationID    int64  `json:"organization_id"`
	ProjectID         string `json:"project_id"`
	AttributionSource string `json:"attribution_source"`
	Plan              string `json:"plan"`
	BillingCycle      string `json:"billing_cycle"`
	PromptVolume      int    `json:"prompt_volume"`
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

func (h *Handler) listPlanSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.svc.ListPlanSettings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

func (h *Handler) updatePlanSettings(w http.ResponseWriter, r *http.Request) {
	if _, err := scopedOrganizationID(r, 0); err != nil {
		writeError(w, http.StatusUnauthorized, "missing authenticated organization")
		return
	}

	var req updatePlanSettingsRequest
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json payload")
		return
	}

	settings, err := h.svc.UpdatePlanSettings(r.Context(), domain.PlanSettings{
		Plan:                    req.Plan,
		MonthlyPriceCents:       req.MonthlyPriceCents,
		YearlyPriceCents:        req.YearlyPriceCents,
		MonthlyQuota:            req.MonthlyQuota,
		ModelSelectionLimit:     req.ModelSelectionLimit,
		MonthlyModelChangeLimit: req.MonthlyModelChangeLimit,
		MaxProjects:             req.MaxProjects,
		IsMostChosen:            req.IsMostChosen,
	})
	if err != nil {
		if errors.Is(err, domain.ErrInvalidPlanSettings) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

func (h *Handler) listPricingTiers(w http.ResponseWriter, r *http.Request) {
	tiers, err := h.svc.ListPricingTiers(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, tiers)
}

func (h *Handler) updatePricingTier(w http.ResponseWriter, r *http.Request) {
	if _, err := scopedOrganizationID(r, 0); err != nil {
		writeError(w, http.StatusUnauthorized, "missing authenticated organization")
		return
	}

	var req updatePricingTierRequest
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json payload")
		return
	}

	tier, err := h.svc.UpdatePricingTier(r.Context(), domain.PricingTier{
		PromptVolume:        req.PromptVolume,
		Label:               strings.TrimSpace(req.Label),
		Prices:              req.Prices,
		DeveloperPriceCents: req.DeveloperPriceCents,
		StarterPriceCents:   req.StarterPriceCents,
		GrowthPriceCents:    req.GrowthPriceCents,
		ProPriceCents:       req.ProPriceCents,
	})
	if err != nil {
		if errors.Is(err, domain.ErrInvalidPricingTier) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, tier)
}

func (h *Handler) deletePricingTier(w http.ResponseWriter, r *http.Request) {
	promptVolume, err := strconv.Atoi(strings.TrimSpace(r.PathValue("prompt_volume")))
	if err != nil || promptVolume <= 0 {
		writeError(w, http.StatusBadRequest, "invalid prompt volume")
		return
	}
	if err := h.svc.DeletePricingTier(r.Context(), promptVolume); err != nil {
		if errors.Is(err, domain.ErrInvalidPricingTier) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

func (h *Handler) upsertSubscription(w http.ResponseWriter, r *http.Request) {
	var req upsertSubscriptionRequest
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json payload")
		return
	}
	organizationID, err := scopedOrganizationID(r, req.OrganizationID)
	if err != nil {
		switch {
		case errors.Is(err, errMissingOrganizationScope), errors.Is(err, errInvalidOrganizationScope):
			writeError(w, http.StatusUnauthorized, "missing authenticated organization")
		case errors.Is(err, errMismatchedOrganizationScope):
			writeError(w, http.StatusForbidden, "forbidden")
		default:
			writeError(w, http.StatusBadRequest, err.Error())
		}
		return
	}

	sub, err := h.svc.UpdateSubscriptionEntitlements(r.Context(), organizationID, req.Plan, req.Seats, req.MonthlyQuota)
	if err != nil {
		if errors.Is(err, domain.ErrInvalidSubscription) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusOK, sub)
}

func (h *Handler) getQuota(w http.ResponseWriter, r *http.Request) {
	orgIDStr := strings.TrimPrefix(r.URL.Path, "/billing/quotas/")
	orgID, err := strconv.ParseInt(orgIDStr, 10, 64)
	if err != nil || orgID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid organization id")
		return
	}
	if _, err := scopedOrganizationID(r, orgID); err != nil {
		switch {
		case errors.Is(err, errMissingOrganizationScope), errors.Is(err, errInvalidOrganizationScope):
			writeError(w, http.StatusUnauthorized, "missing authenticated organization")
		case errors.Is(err, errMismatchedOrganizationScope):
			writeError(w, http.StatusForbidden, "forbidden")
		default:
			writeError(w, http.StatusBadRequest, err.Error())
		}
		return
	}

	entitlements, err := h.svc.GetOrganizationEntitlements(r.Context(), orgID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusOK, entitlements)
}

func (h *Handler) createStripeCheckoutSession(w http.ResponseWriter, r *http.Request) {
	var req createStripeCheckoutSessionRequest
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json payload")
		return
	}
	organizationID, err := scopedOrganizationID(r, req.OrganizationID)
	if err != nil {
		switch {
		case errors.Is(err, errMissingOrganizationScope), errors.Is(err, errInvalidOrganizationScope):
			writeError(w, http.StatusUnauthorized, "missing authenticated organization")
		case errors.Is(err, errMismatchedOrganizationScope):
			writeError(w, http.StatusForbidden, "forbidden")
		default:
			writeError(w, http.StatusBadRequest, err.Error())
		}
		return
	}

	out, err := h.svc.CreateStripeCheckoutSession(r.Context(), usecase.CreateStripeCheckoutSessionInput{
		OrganizationID:    organizationID,
		ProjectID:         req.ProjectID,
		AttributionSource: req.AttributionSource,
		Plan:              req.Plan,
		BillingCycle:      req.BillingCycle,
		PromptVolume:      req.PromptVolume,
		Seats:             req.Seats,
		CorrectionCredits: req.CorrectionCredits,
		SuccessURL:        req.SuccessURL,
		CancelURL:         req.CancelURL,
		RequestID:         req.RequestID,
	})
	if err != nil {
		switch {
		case errors.Is(err, usecase.ErrStripeDisabled):
			writeError(w, http.StatusServiceUnavailable, "stripe integration is disabled")
		case errors.Is(err, usecase.ErrStripeInvalidRequest),
			errors.Is(err, usecase.ErrStripeUnsupportedPlan),
			errors.Is(err, usecase.ErrStripeUnsupportedCycle),
			errors.Is(err, domain.ErrInvalidSubscription):
			writeError(w, http.StatusBadRequest, err.Error())
		default:
			writeError(w, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) createStripeCustomerPortalSession(w http.ResponseWriter, r *http.Request) {
	var req createStripeCustomerPortalSessionRequest
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json payload")
		return
	}
	organizationID, err := scopedOrganizationID(r, req.OrganizationID)
	if err != nil {
		switch {
		case errors.Is(err, errMissingOrganizationScope), errors.Is(err, errInvalidOrganizationScope):
			writeError(w, http.StatusUnauthorized, "missing authenticated organization")
		case errors.Is(err, errMismatchedOrganizationScope):
			writeError(w, http.StatusForbidden, "forbidden")
		default:
			writeError(w, http.StatusBadRequest, err.Error())
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
			writeError(w, http.StatusServiceUnavailable, "stripe integration is disabled")
		case errors.Is(err, usecase.ErrStripeInvalidRequest),
			errors.Is(err, usecase.ErrStripeCustomerMissing),
			errors.Is(err, domain.ErrSubscriptionMissing):
			writeError(w, http.StatusBadRequest, err.Error())
		default:
			writeError(w, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) syncStripePricingCatalog(w http.ResponseWriter, r *http.Request) {
	if _, err := scopedOrganizationID(r, 0); err != nil {
		writeError(w, http.StatusUnauthorized, "missing authenticated organization")
		return
	}

	out, err := h.svc.SyncStripePricingCatalog(r.Context(), r.PathValue("plan"))
	if err != nil {
		switch {
		case errors.Is(err, usecase.ErrStripeDisabled):
			writeError(w, http.StatusServiceUnavailable, "stripe integration is disabled")
		case errors.Is(err, usecase.ErrStripeInvalidRequest):
			writeError(w, http.StatusBadRequest, err.Error())
		default:
			writeError(w, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) handleStripeWebhook(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	payload, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid webhook payload")
		return
	}

	signature := strings.TrimSpace(r.Header.Get("Stripe-Signature"))
	if err := h.svc.HandleStripeWebhook(r.Context(), payload, signature); err != nil {
		switch {
		case errors.Is(err, usecase.ErrStripeDisabled):
			writeError(w, http.StatusServiceUnavailable, "stripe integration is disabled")
		case errors.Is(err, usecase.ErrStripeInvalidSignature):
			writeError(w, http.StatusBadRequest, "invalid stripe signature")
		default:
			writeError(w, http.StatusInternalServerError, "internal server error")
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
