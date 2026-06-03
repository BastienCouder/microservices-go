package http

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
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
	httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "permission-service"})
}

func (h *Handler) ready(w http.ResponseWriter, r *http.Request) {
	if h.readyCheck == nil || h.readyCheck(r.Context()) == nil {
		httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "permission-service"})
		return
	}
	httpjson.WriteJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "service": "permission-service"})
}

func (h *Handler) check(w http.ResponseWriter, r *http.Request) {
	var req struct {
		OrganizationID int64  `json:"organization_id"`
		Action         string `json:"action"`
		Resource       string `json:"resource"`
	}
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}

	userID, ok := authenticatedUserID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	result, err := h.svc.Check(r.Context(), domain.CheckInput{
		OrganizationID: req.OrganizationID,
		UserID:         userID,
		Action:         req.Action,
		Resource:       req.Resource,
	})
	if err != nil {
		log.Printf("permission check failed: organization_id=%d user_id=%d action=%s resource=%s err=%v", req.OrganizationID, userID, req.Action, req.Resource, err)
		if errors.Is(err, domain.ErrInvalidPermissionCheck) {
			httpjson.WriteValidationError(w)
			auditSecurityEvent("permission_check", map[string]any{"organization_id": req.OrganizationID, "user_id": userID, "action": req.Action, "resource": req.Resource, "result": "invalid"})
			return
		}
		httpjson.WriteInternalError(w)
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
	httpjson.WriteSuccess(w, status, value)
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
