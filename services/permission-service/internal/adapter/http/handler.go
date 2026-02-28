package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/bastiencouder/microservices-go/services/permission-service/internal/domain"
	"github.com/bastiencouder/microservices-go/services/permission-service/internal/usecase"
)

type Handler struct {
	svc *usecase.Service
}

func NewHandler(svc *usecase.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", h.health)
	mux.HandleFunc("POST /permissions/check", h.check)
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "permission-service"})
}

func (h *Handler) check(w http.ResponseWriter, r *http.Request) {
	var req struct {
		OrganizationID int64  `json:"organization_id"`
		Action         string `json:"action"`
		Resource       string `json:"resource"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json payload"})
		return
	}

	userID, ok := authenticatedUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing authenticated user"})
		return
	}

	result, err := h.svc.Check(r.Context(), domain.CheckInput{
		OrganizationID: req.OrganizationID,
		UserID:         userID,
		Action:         req.Action,
		Resource:       req.Resource,
	})
	if err != nil {
		if errors.Is(err, domain.ErrInvalidPermissionCheck) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func authenticatedUserID(r *http.Request) (int64, bool) {
	raw := strings.TrimSpace(r.Header.Get("X-Authenticated-User-ID"))
	if raw == "" {
		return 0, false
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return 0, false
	}
	return id, true
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
