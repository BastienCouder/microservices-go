package http

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
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
	mux.HandleFunc("/attribution/projects/", h.projectRoutes)
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

func (h *Handler) projectRoutes(w http.ResponseWriter, r *http.Request) {
	parts := splitPathAfter(r.URL.Path, "/attribution/projects/")
	if len(parts) != 2 || parts[0] == "" || parts[1] != "traffic" || r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	h.getTrafficReport(w, r, parts[0])
}

func (h *Handler) getTrafficReport(w http.ResponseWriter, r *http.Request, projectID string) {
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
	httpjson.WriteSuccess(w, http.StatusOK, report)
}

func parseWindow(r *http.Request) (time.Time, time.Time, error) {
	from, err := parseRFC3339Optional(r.URL.Query().Get("from"))
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	to, err := parseRFC3339Optional(r.URL.Query().Get("to"))
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

func splitPathAfter(path, prefix string) []string {
	trimmed := strings.Trim(strings.TrimPrefix(path, prefix), "/")
	if trimmed == "" {
		return nil
	}
	return strings.Split(trimmed, "/")
}
