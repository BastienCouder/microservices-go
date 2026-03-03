package http

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/permission-service/internal/domain"
	"github.com/bastiencouder/microservices-go/services/permission-service/internal/usecase"
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
	mux.HandleFunc("POST /permissions/check", h.check)
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "permission-service"})
}

func (h *Handler) ready(w http.ResponseWriter, r *http.Request) {
	if h.readyCheck == nil || h.readyCheck(r.Context()) == nil {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "permission-service"})
		return
	}
	writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "service": "permission-service"})
}

func (h *Handler) check(w http.ResponseWriter, r *http.Request) {
	var req struct {
		OrganizationID int64  `json:"organization_id"`
		Action         string `json:"action"`
		Resource       string `json:"resource"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // SEC-003: 1 MiB body limit
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
			auditSecurityEvent("permission_check", map[string]any{"organization_id": req.OrganizationID, "user_id": userID, "action": req.Action, "resource": req.Resource, "result": "invalid"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		auditSecurityEvent("permission_check", map[string]any{"organization_id": req.OrganizationID, "user_id": userID, "action": req.Action, "resource": req.Resource, "result": "error"})
		return
	}

	if result.Allowed {
		auditSecurityEvent("permission_check", map[string]any{"organization_id": req.OrganizationID, "user_id": userID, "action": req.Action, "resource": req.Resource, "result": "allowed"})
	} else {
		auditSecurityEvent("permission_check", map[string]any{"organization_id": req.OrganizationID, "user_id": userID, "action": req.Action, "resource": req.Resource, "result": "denied"})
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

func auditSecurityEvent(event string, fields map[string]any) {
	payload := map[string]any{
		"event":     event,
		"component": "permission-service",
		"ts":        time.Now().UTC().Format(time.RFC3339Nano),
	}
	for k, v := range fields {
		payload[k] = v
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		log.Printf("audit event=%s marshal_error=%v", event, err)
		return
	}
	log.Printf("audit %s", string(raw))
}
