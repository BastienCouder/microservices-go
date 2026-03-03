package http

import (
	"encoding/json"
	"errors"
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

func (h *Handler) projectRoutes(w http.ResponseWriter, r *http.Request) {
	h.projectRoutesWithPrefix(w, r, "/projects/")
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

	from, to, err := parseWindow(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	funnel, err := h.svc.GetFunnel(r.Context(), projectID, userID, from, to)
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
