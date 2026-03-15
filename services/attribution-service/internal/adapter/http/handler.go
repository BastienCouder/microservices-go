package http

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/attribution-service/internal/usecase"
)

type Handler struct {
	svc *usecase.Service
}

func NewHandler(svc *usecase.Service) *Handler {
	return &Handler{svc: svc}
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
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "attribution-service"})
}

func (h *Handler) ready(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "attribution-service"})
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
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing user identity"})
		return
	}

	var req recordEventRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	occurredAt, err := parseRFC3339Optional(req.OccurredAt)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
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
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}

	var req recordEventRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	occurredAt, err := parseRFC3339Optional(req.OccurredAt)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
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
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid webhook payload"})
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
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	occurredAt, err := parseRFC3339Optional(req.OccurredAt)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
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
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing user identity"})
		return
	}

	from, to, err := parseWindow(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
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
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing user identity"})
		return
	}
	organizationID, _ := authenticatedOrganizationID(r)

	from, to, err := parseWindow(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	funnel, err := h.svc.GetFunnel(r.Context(), projectID, userID, organizationID, from, to)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, funnel)
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
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
	case errors.Is(err, usecase.ErrUnauthorized):
		writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
	case errors.Is(err, usecase.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
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
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(out); err != nil {
		return err
	}
	return nil
}

func writeSuccess(w http.ResponseWriter, status int, data any) {
	writeJSON(w, status, map[string]any{"success": true, "data": data})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
