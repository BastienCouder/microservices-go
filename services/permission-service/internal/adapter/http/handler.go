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
	mux.HandleFunc("/internal/users/", h.internalUserRoutes)
	mux.HandleFunc("/internal/organizations/", h.internalOrganizationRoutes)
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
		ProjectID      string `json:"project_id"`
		ResourceID     string `json:"resource_id"`
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
		ProjectID:      req.ProjectID,
		ResourceID:     req.ResourceID,
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

func (h *Handler) internalUserRoutes(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/internal/users/"), "/"), "/")
	if len(parts) != 2 || parts[0] == "" || parts[1] != "organizations" || r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	userID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || userID <= 0 {
		httpjson.WriteValidationError(w)
		return
	}
	memberships, err := h.svc.ListOrganizationsByUser(r.Context(), userID)
	if err != nil {
		h.writePermissionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, memberships)
}

func (h *Handler) internalOrganizationRoutes(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/internal/organizations/"), "/"), "/")
	if len(parts) < 2 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	organizationID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || organizationID <= 0 {
		httpjson.WriteValidationError(w)
		return
	}

	switch {
	case len(parts) == 2 && parts[1] == "members" && r.Method == http.MethodGet:
		h.listMembers(w, r, organizationID)
	case len(parts) == 4 && parts[1] == "members" && parts[3] == "roles" && r.Method == http.MethodPatch:
		userID, ok := parsePositiveInt64(parts[2])
		if !ok {
			httpjson.WriteValidationError(w)
			return
		}
		h.updateMemberRoles(w, r, organizationID, userID)
	case len(parts) == 3 && parts[1] == "members" && r.Method == http.MethodPut:
		userID, ok := parsePositiveInt64(parts[2])
		if !ok {
			httpjson.WriteValidationError(w)
			return
		}
		h.upsertMember(w, r, organizationID, userID)
	case len(parts) == 3 && parts[1] == "members" && r.Method == http.MethodDelete:
		userID, ok := parsePositiveInt64(parts[2])
		if !ok {
			httpjson.WriteValidationError(w)
			return
		}
		h.removeMember(w, r, organizationID, userID)
	case len(parts) == 4 && parts[1] == "users" && parts[3] == "project-memberships" && r.Method == http.MethodGet:
		userID, ok := parsePositiveInt64(parts[2])
		if !ok {
			httpjson.WriteValidationError(w)
			return
		}
		h.listProjectMembersByUser(w, r, organizationID, userID)
	case len(parts) == 4 && parts[1] == "projects" && parts[3] == "members" && r.Method == http.MethodGet:
		h.listProjectMembers(w, r, organizationID, parts[2])
	case len(parts) == 6 && parts[1] == "projects" && parts[3] == "members" && r.Method == http.MethodPut:
		userID, ok := parsePositiveInt64(parts[4])
		if !ok || parts[5] != "role" {
			http.NotFound(w, r)
			return
		}
		h.upsertProjectMember(w, r, organizationID, parts[2], userID)
	case len(parts) == 5 && parts[1] == "projects" && parts[3] == "members" && r.Method == http.MethodDelete:
		userID, ok := parsePositiveInt64(parts[4])
		if !ok {
			httpjson.WriteValidationError(w)
			return
		}
		h.removeProjectMember(w, r, organizationID, parts[2], userID)
	case len(parts) == 2 && parts[1] == "permissions" && r.Method == http.MethodDelete:
		h.deleteOrganizationPermissions(w, r, organizationID)
	default:
		http.NotFound(w, r)
	}
}

type upsertMemberRequest struct {
	Roles []string `json:"roles"`
}

type upsertProjectMemberRequest struct {
	Role string `json:"role"`
}

func (h *Handler) listMembers(w http.ResponseWriter, r *http.Request, organizationID int64) {
	members, err := h.svc.ListMembers(r.Context(), organizationID)
	if err != nil {
		h.writePermissionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, members)
}

func (h *Handler) upsertMember(w http.ResponseWriter, r *http.Request, organizationID, userID int64) {
	var req upsertMemberRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}
	member, err := h.svc.UpsertMember(r.Context(), domain.Member{
		OrganizationID: organizationID,
		UserID:         userID,
		Roles:          req.Roles,
	})
	if err != nil {
		h.writePermissionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, member)
}

func (h *Handler) updateMemberRoles(w http.ResponseWriter, r *http.Request, organizationID, userID int64) {
	var req upsertMemberRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}
	member, err := h.svc.UpdateMemberRoles(r.Context(), organizationID, userID, req.Roles)
	if err != nil {
		h.writePermissionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, member)
}

func (h *Handler) removeMember(w http.ResponseWriter, r *http.Request, organizationID, userID int64) {
	if err := h.svc.RemoveMember(r.Context(), organizationID, userID); err != nil {
		h.writePermissionError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) listProjectMembersByUser(w http.ResponseWriter, r *http.Request, organizationID, userID int64) {
	members, err := h.svc.ListProjectMembersByUser(r.Context(), organizationID, userID)
	if err != nil {
		h.writePermissionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, members)
}

func (h *Handler) listProjectMembers(w http.ResponseWriter, r *http.Request, organizationID int64, projectID string) {
	members, err := h.svc.ListProjectMembers(r.Context(), organizationID, projectID)
	if err != nil {
		h.writePermissionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, members)
}

func (h *Handler) upsertProjectMember(w http.ResponseWriter, r *http.Request, organizationID int64, projectID string, userID int64) {
	var req upsertProjectMemberRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}
	member, err := h.svc.UpsertProjectMember(r.Context(), domain.ProjectMember{
		ProjectID:      projectID,
		OrganizationID: organizationID,
		UserID:         userID,
		Role:           req.Role,
	})
	if err != nil {
		h.writePermissionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, member)
}

func (h *Handler) removeProjectMember(w http.ResponseWriter, r *http.Request, organizationID int64, projectID string, userID int64) {
	if err := h.svc.RemoveProjectMember(r.Context(), organizationID, projectID, userID); err != nil {
		h.writePermissionError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) deleteOrganizationPermissions(w http.ResponseWriter, r *http.Request, organizationID int64) {
	if err := h.svc.DeleteOrganizationPermissions(r.Context(), organizationID); err != nil {
		h.writePermissionError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
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

func (h *Handler) writePermissionError(w http.ResponseWriter, err error) {
	if errors.Is(err, domain.ErrInvalidPermissionCheck) {
		httpjson.WriteValidationError(w)
		return
	}
	httpjson.WriteInternalError(w)
}

func parsePositiveInt64(value string) (int64, bool) {
	parsed, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
	if err != nil || parsed <= 0 {
		return 0, false
	}
	return parsed, true
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
