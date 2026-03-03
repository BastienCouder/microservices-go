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

	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/domain"
	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/usecase"
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
	mux.HandleFunc("POST /organizations", h.createOrganization)
	mux.HandleFunc("/organizations/", h.organizationRoutes)
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "organizations-service"})
}

func (h *Handler) ready(w http.ResponseWriter, r *http.Request) {
	if h.readyCheck == nil || h.readyCheck(r.Context()) == nil {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "organizations-service"})
		return
	}
	writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "service": "organizations-service"})
}

type createOrganizationRequest struct {
	Name string `json:"name"`
}

func (h *Handler) createOrganization(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	authUserID, ok := authenticatedUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing authenticated user"})
		return
	}

	var req createOrganizationRequest
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json payload"})
		return
	}

	organization, err := h.svc.CreateOrganization(r.Context(), req.Name, authUserID)
	if err != nil {
		h.writeDomainError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, organization)
}

func (h *Handler) organizationRoutes(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/organizations/"), "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}

	organizationID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || organizationID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid organization id"})
		return
	}

	switch {
	case len(parts) == 1 && r.Method == http.MethodGet:
		h.getOrganizationByID(w, r, organizationID)
		return
	case len(parts) == 2 && parts[1] == "teams" && r.Method == http.MethodPost:
		h.createTeam(w, r, organizationID)
		return
	case len(parts) == 2 && parts[1] == "teams" && r.Method == http.MethodGet:
		h.listTeams(w, r, organizationID)
		return
	case len(parts) == 2 && parts[1] == "members" && r.Method == http.MethodPost:
		h.addMember(w, r, organizationID)
		return
	case len(parts) == 2 && parts[1] == "members" && r.Method == http.MethodGet:
		h.listMembers(w, r, organizationID)
		return
	case len(parts) == 4 && parts[1] == "members" && parts[3] == "roles" && r.Method == http.MethodPost:
		userID, parseErr := strconv.ParseInt(parts[2], 10, 64)
		if parseErr != nil || userID <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid user id"})
			return
		}
		h.assignRole(w, r, organizationID, userID)
		return
	default:
		http.NotFound(w, r)
		return
	}
}

func (h *Handler) getOrganizationByID(w http.ResponseWriter, r *http.Request, organizationID int64) {
	organization, err := h.svc.GetOrganization(r.Context(), organizationID)
	if err != nil {
		h.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, organization)
}

type createTeamRequest struct {
	Name string `json:"name"`
}

func (h *Handler) createTeam(w http.ResponseWriter, r *http.Request, organizationID int64) {
	var req createTeamRequest
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json payload"})
		return
	}

	team, err := h.svc.CreateTeam(r.Context(), organizationID, req.Name)
	if err != nil {
		h.writeDomainError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, team)
}

func (h *Handler) listTeams(w http.ResponseWriter, r *http.Request, organizationID int64) {
	teams, err := h.svc.ListTeams(r.Context(), organizationID)
	if err != nil {
		h.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, teams)
}

type addMemberRequest struct {
	UserID int64 `json:"user_id"`
	TeamID int64 `json:"team_id"`
}

func (h *Handler) addMember(w http.ResponseWriter, r *http.Request, organizationID int64) {
	authUserID, ok := authenticatedUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing authenticated user"})
		return
	}

	var req addMemberRequest
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json payload"})
		return
	}

	// Prevent privilege escalation via forged payloads: membership creation is for caller identity.
	member, err := h.svc.AddMember(r.Context(), organizationID, authUserID, req.TeamID)
	if err != nil {
		h.writeDomainError(w, err)
		auditSecurityEvent("organization_member_add", map[string]any{
			"organization_id": organizationID,
			"user_id":         authUserID,
			"team_id":         req.TeamID,
			"result":          "error",
		})
		return
	}
	auditSecurityEvent("organization_member_add", map[string]any{
		"organization_id": organizationID,
		"user_id":         authUserID,
		"team_id":         req.TeamID,
		"result":          "success",
	})
	writeJSON(w, http.StatusCreated, member)
}

func (h *Handler) listMembers(w http.ResponseWriter, r *http.Request, organizationID int64) {
	members, err := h.svc.ListMembers(r.Context(), organizationID)
	if err != nil {
		h.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, members)
}

type assignRoleRequest struct {
	Role string `json:"role"`
}

func (h *Handler) assignRole(w http.ResponseWriter, r *http.Request, organizationID, userID int64) {
	authUserID, ok := authenticatedUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing authenticated user"})
		return
	}
	if userID != authUserID {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden target user"})
		return
	}

	var req assignRoleRequest
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json payload"})
		return
	}

	member, err := h.svc.AssignRole(r.Context(), organizationID, userID, req.Role)
	if err != nil {
		h.writeDomainError(w, err)
		auditSecurityEvent("organization_role_assign", map[string]any{
			"organization_id": organizationID,
			"user_id":         userID,
			"role":            req.Role,
			"result":          "error",
		})
		return
	}
	auditSecurityEvent("organization_role_assign", map[string]any{
		"organization_id": organizationID,
		"user_id":         userID,
		"role":            req.Role,
		"result":          "success",
	})
	writeJSON(w, http.StatusOK, member)
}

func (h *Handler) writeDomainError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrInvalidOrganization),
		errors.Is(err, domain.ErrInvalidTeam),
		errors.Is(err, domain.ErrInvalidMember),
		errors.Is(err, domain.ErrInvalidRole):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
	case errors.Is(err, domain.ErrOrganizationNotFound),
		errors.Is(err, domain.ErrTeamNotFound),
		errors.Is(err, domain.ErrMemberNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
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

func auditSecurityEvent(event string, fields map[string]any) {
	payload := map[string]any{
		"event":     event,
		"component": "organizations-service",
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
