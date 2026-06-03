package http

import (
	"context"
	"errors"
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/attribution-service/internal/usecase"
)

type Handler struct {
	svc        *usecase.Service
	readyCheck func(context.Context) error
}

func NewHandler(svc *usecase.Service, readyCheck ...func(context.Context) error) *Handler {
	var readiness func(context.Context) error
	if len(readyCheck) > 0 {
		readiness = readyCheck[0]
	}
	return &Handler{svc: svc, readyCheck: readiness}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", h.health)
	mux.HandleFunc("GET /ready", h.ready)
	mux.HandleFunc("/internal/attribution/projects/", h.internalAttributionProjectRoutes)
	mux.HandleFunc("/attribution/ingest/", h.ingestionRoutes)
	mux.HandleFunc("/attribution/stripe/webhook/", h.stripeWebhookRoutes)
	mux.HandleFunc("/attribution/projects/", h.attributionProjectRoutes)

	// Compatibility alias.
	mux.HandleFunc("/projects/", h.projectRoutes)
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "attribution-service"})
}

func (h *Handler) ready(w http.ResponseWriter, r *http.Request) {
	if h.readyCheck == nil || h.readyCheck(r.Context()) == nil {
		httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "attribution-service"})
		return
	}
	httpjson.WriteJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "service": "attribution-service"})
}

func (h *Handler) attributionProjectRoutes(w http.ResponseWriter, r *http.Request) {
	h.projectRoutesWithPrefix(w, r, "/attribution/projects/")
}

func (h *Handler) internalAttributionProjectRoutes(w http.ResponseWriter, r *http.Request) {
	h.internalProjectRoutesWithPrefix(w, r, "/internal/attribution/projects/")
}

func (h *Handler) projectRoutes(w http.ResponseWriter, r *http.Request) {
	h.projectRoutesWithPrefix(w, r, "/projects/")
}

func (h *Handler) stripeWebhookRoutes(w http.ResponseWriter, r *http.Request) {
	parts := splitPathAfter(r.URL.Path, "/attribution/stripe/webhook/")
	if len(parts) != 1 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}
	h.handleStripeWebhook(w, r, parts[0])
}

func (h *Handler) ingestionRoutes(w http.ResponseWriter, r *http.Request) {
	parts := splitPathAfter(r.URL.Path, "/attribution/ingest/")
	if len(parts) != 1 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}
	h.recordIngestionEvent(w, r, parts[0])
}

func (h *Handler) projectRoutesWithPrefix(w http.ResponseWriter, r *http.Request, prefix string) {
	parts := splitPathAfter(r.URL.Path, prefix)
	if len(parts) < 2 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	projectID := parts[0]

	switch {
	case len(parts) == 2 && parts[1] == "events" && r.Method == http.MethodPost:
		h.recordEvent(w, r, projectID)
	case len(parts) == 2 && parts[1] == "events" && r.Method == http.MethodGet:
		h.listEvents(w, r, projectID)
	case len(parts) == 2 && parts[1] == "funnel" && r.Method == http.MethodGet:
		h.getFunnel(w, r, projectID)
	case len(parts) == 2 && parts[1] == "traffic" && r.Method == http.MethodGet:
		h.getTrafficReport(w, r, projectID)
	default:
		http.NotFound(w, r)
	}
}

func (h *Handler) internalProjectRoutesWithPrefix(w http.ResponseWriter, r *http.Request, prefix string) {
	parts := splitPathAfter(r.URL.Path, prefix)
	if len(parts) < 2 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	projectID := parts[0]

	switch {
	case len(parts) == 2 && parts[1] == "events" && r.Method == http.MethodPost:
		h.recordInternalEvent(w, r, projectID)
	default:
		http.NotFound(w, r)
	}
}

type recordEventRequest struct {
	Stage        string `json:"stage"`
	Source       string `json:"source"`
	Count        int64  `json:"count"`
	RevenueCents int64  `json:"revenueCents"`
	OccurredAt   string `json:"occurredAt"`
}

func (h *Handler) recordEvent(w http.ResponseWriter, r *http.Request, projectID string) {
	userID, ok := authenticatedUserID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	var req recordEventRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	occurredAt, err := parseRFC3339Optional(req.OccurredAt)
	if err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	event, err := h.svc.RecordEvent(r.Context(), usecase.RecordEventInput{
		ProjectID:    projectID,
		UserID:       userID,
		Stage:        req.Stage,
		Source:       req.Source,
		Count:        req.Count,
		RevenueCents: req.RevenueCents,
		OccurredAt:   occurredAt,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusCreated, event)
}

func (h *Handler) recordInternalEvent(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	var req recordEventRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	occurredAt, err := parseRFC3339Optional(req.OccurredAt)
	if err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	event, err := h.svc.RecordInternalEvent(r.Context(), usecase.RecordInternalEventInput{
		ProjectID:      projectID,
		OrganizationID: organizationID,
		Stage:          req.Stage,
		Source:         req.Source,
		Count:          req.Count,
		RevenueCents:   req.RevenueCents,
		OccurredAt:     occurredAt,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusCreated, event)
}

func (h *Handler) handleStripeWebhook(w http.ResponseWriter, r *http.Request, projectID string) {
	payload, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, "invalid webhook payload")
		return
	}

	if err := h.svc.RecordStripeWebhook(r.Context(), projectID, payload, strings.TrimSpace(r.Header.Get("Stripe-Signature"))); err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) recordIngestionEvent(w http.ResponseWriter, r *http.Request, projectID string) {
	var req recordEventRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	occurredAt, err := parseRFC3339Optional(req.OccurredAt)
	if err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	event, err := h.svc.RecordIngestionEvent(r.Context(), usecase.RecordIngestionEventInput{
		ProjectID:    projectID,
		SigningToken: ingestionSigningToken(r),
		Stage:        req.Stage,
		Source:       req.Source,
		Count:        req.Count,
		RevenueCents: req.RevenueCents,
		OccurredAt:   occurredAt,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusCreated, event)
}

func (h *Handler) listEvents(w http.ResponseWriter, r *http.Request, projectID string) {
	userID, ok := authenticatedUserID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	from, to, err := parseWindow(r)
	if err != nil {
		httpjson.WriteValidationError(w)
		return
	}
	limit := 50
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err == nil && parsed > 0 {
			limit = parsed
		}
	}

	events, err := h.svc.ListEvents(r.Context(), projectID, userID, from, to, limit)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, events)
}

func (h *Handler) getFunnel(w http.ResponseWriter, r *http.Request, projectID string) {
	userID, ok := authenticatedUserID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}
	organizationID, _ := authenticatedOrganizationID(r)

	from, to, err := parseWindow(r)
	if err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	funnel, err := h.svc.GetFunnel(r.Context(), projectID, userID, organizationID, from, to)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, funnel)
}

func (h *Handler) getTrafficReport(w http.ResponseWriter, r *http.Request, projectID string) {
	userID, ok := authenticatedUserID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	from, to, err := parseWindow(r)
	if err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	report, err := h.svc.GetTrafficReport(
		r.Context(),
		projectID,
		userID,
		organizationID,
		from,
		to,
		usecase.TrafficFilters{
			Search: strings.TrimSpace(r.URL.Query().Get("search")),
			Engine: strings.TrimSpace(r.URL.Query().Get("engine")),
		},
	)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, report)
}

func parseWindow(r *http.Request) (time.Time, time.Time, error) {
	fromRaw := strings.TrimSpace(r.URL.Query().Get("from"))
	toRaw := strings.TrimSpace(r.URL.Query().Get("to"))
	from, err := parseRFC3339Optional(fromRaw)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	to, err := parseRFC3339Optional(toRaw)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	return from, to, nil
}

func parseRFC3339Optional(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, nil
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return time.Time{}, errors.New("invalid time format, expected RFC3339")
	}
	return parsed.UTC(), nil
}

func (h *Handler) writeUsecaseError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, usecase.ErrValidation):
		httpjson.WriteValidationError(w)
	case errors.Is(err, usecase.ErrUnauthorized):
		httpjson.WriteForbiddenError(w)
	case errors.Is(err, usecase.ErrNotFound):
		httpjson.WriteNotFoundError(w)
	case errors.Is(err, usecase.ErrDependencyUnavailable):
		log.Printf("attribution dependency unavailable: %v", err)
		httpjson.WriteError(w, http.StatusServiceUnavailable, userFacingDependencyError(err))
	default:
		httpjson.WriteInternalError(w)
	}
}

func userFacingDependencyError(err error) string {
	message := strings.ToLower(err.Error())
	if strings.Contains(message, "access_token_scope_insufficient") ||
		strings.Contains(message, "insufficient authentication scopes") {
		return "Relance la connexion Google Analytics pour autoriser la lecture des rapports GA4, puis réessaie."
	}
	if strings.Contains(message, "service_disabled") ||
		strings.Contains(message, "analyticsdata.googleapis.com") ||
		strings.Contains(message, "google analytics data api has not been used") ||
		(strings.Contains(message, "google analytics data api") && strings.Contains(message, "disabled")) {
		return "Active Google Analytics Data API dans le projet Google Cloud utilise pour cette connexion GA4, puis reessaie dans quelques minutes."
	}
	if strings.Contains(message, "ga4") || strings.Contains(message, "google analytics") {
		return "Google Analytics est momentanément indisponible pour ce projet. Vérifie l'accès à la propriété GA4, puis réessaie."
	}
	return "Service momentanément indisponible. Réessaie dans quelques instants."
}

func splitPathAfter(path, prefix string) []string {
	trimmed := strings.Trim(strings.TrimPrefix(path, prefix), "/")
	if trimmed == "" {
		return nil
	}
	return strings.Split(trimmed, "/")
}

func authenticatedUserID(r *http.Request) (string, bool) {
	value := strings.TrimSpace(r.Header.Get("X-Authenticated-User-ID"))
	if value == "" {
		value = strings.TrimSpace(r.Header.Get("x-user-id"))
	}
	if value == "" {
		return "", false
	}
	return value, true
}

func authenticatedOrganizationID(r *http.Request) (int64, bool) {
	value := strings.TrimSpace(r.Header.Get("X-Organization-ID"))
	if value == "" {
		value = strings.TrimSpace(r.Header.Get("x-organization-id"))
	}
	if value == "" {
		return 0, false
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed <= 0 {
		return 0, false
	}
	return parsed, true
}

func ingestionSigningToken(r *http.Request) string {
	authz := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(authz, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(authz, "Bearer "))
	}
	return strings.TrimSpace(r.Header.Get("X-Attribution-Key"))
}

func decodeJSON(w http.ResponseWriter, r *http.Request, out any) error {
	return httpjson.DecodeJSON(w, r, out)
}

func writeSuccess(w http.ResponseWriter, status int, data any) {
	httpjson.WriteSuccess(w, status, data)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	httpjson.WriteSuccess(w, status, payload)
}
