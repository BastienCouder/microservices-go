package http

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
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
	mux.HandleFunc("GET /organizations/me", h.listMyOrganizations)
	mux.HandleFunc("POST /internal/api-keys/validate", h.validateOrganizationAPIKey)
	mux.HandleFunc("/organizations/", h.organizationRoutes)
	mux.HandleFunc("/invitations/", h.invitationRoutes)
	mux.HandleFunc("/projects/", h.projectRoutes)
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "organizations-service"})
}

func (h *Handler) projectRoutes(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/projects/"), "/"), "/")
	if len(parts) < 2 || parts[0] == "" || parts[1] != "members" {
		http.NotFound(w, r)
		return
	}
	projectID := parts[0]
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	switch {
	case len(parts) == 2 && r.Method == http.MethodPost:
		h.assignProjectMember(w, r, projectID, organizationID)
	case len(parts) == 2 && r.Method == http.MethodGet:
		h.listProjectMembers(w, r, projectID, organizationID)
	case len(parts) == 3 && r.Method == http.MethodDelete:
		userID, err := strconv.ParseInt(parts[2], 10, 64)
		if err != nil || userID <= 0 {
			httpjson.WriteError(w, http.StatusBadRequest, "invalid user id")
			return
		}
		h.removeProjectMember(w, r, projectID, organizationID, userID)
	default:
		http.NotFound(w, r)
	}
}

type assignProjectMemberRequest struct {
	UserID int64  `json:"userId"`
	Role   string `json:"role"`
}

func (h *Handler) assignProjectMember(w http.ResponseWriter, r *http.Request, projectID string, organizationID int64) {
	var req assignProjectMemberRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}
	member, err := h.svc.AssignProjectMember(r.Context(), projectID, organizationID, req.UserID, req.Role)
	if err != nil {
		h.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, member)
}

func (h *Handler) listProjectMembers(w http.ResponseWriter, r *http.Request, projectID string, organizationID int64) {
	members, err := h.svc.ListProjectMembers(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, members)
}

func (h *Handler) removeProjectMember(w http.ResponseWriter, r *http.Request, projectID string, organizationID, userID int64) {
	if err := h.svc.RemoveProjectMember(r.Context(), projectID, organizationID, userID); err != nil {
		h.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

func (h *Handler) ready(w http.ResponseWriter, r *http.Request) {
	if h.readyCheck == nil || h.readyCheck(r.Context()) == nil {
		httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "organizations-service"})
		return
	}
	httpjson.WriteJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "service": "organizations-service"})
}

type createOrganizationRequest struct {
	Name string `json:"name"`
}

type membershipResponse struct {
	ID             string `json:"id"`
	OrganizationID string `json:"organizationId"`
	InternalID     string `json:"internalId"`
	PublicID       string `json:"publicId"`
	Role           string `json:"role"`
}

type organizationResponse struct {
	ID              int64      `json:"id"`
	PublicID        string     `json:"publicId"`
	Name            string     `json:"name"`
	OwnerIdentityID int64      `json:"ownerIdentityId"`
	CreatedAt       time.Time  `json:"createdAt"`
	DeletedAt       *time.Time `json:"deletedAt,omitempty"`
}

type organizationHierarchyResponse struct {
	Organization organizationResponse     `json:"organization"`
	Projects     []usecase.ProjectSummary `json:"projects"`
}

func toOrganizationResponse(organization *domain.Organization) organizationResponse {
	return organizationResponse{
		ID:              organization.ID,
		PublicID:        strings.TrimSpace(organization.PublicID),
		Name:            organization.Name,
		OwnerIdentityID: organization.OwnerIdentityID,
		CreatedAt:       organization.CreatedAt,
		DeletedAt:       organization.DeletedAt,
	}
}

func (h *Handler) createOrganization(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httpjson.WriteMethodNotAllowed(w)
		return
	}

	authUserID, ok := authenticatedUserID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	var req createOrganizationRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}

	organization, err := h.svc.CreateOrganization(r.Context(), req.Name, authUserID)
	if err != nil {
		h.writeDomainError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, toOrganizationResponse(organization))
}

func (h *Handler) listMyOrganizations(w http.ResponseWriter, r *http.Request) {
	authUserID, ok := authenticatedUserID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	memberships, err := h.svc.ListOrganizationsByUser(r.Context(), authUserID)
	if err != nil {
		h.writeDomainError(w, err)
		return
	}

	if r.URL.Query().Get("scope") == "admin" && hasGlobalSuperAdminMembership(memberships) {
		organizations, err := h.svc.ListOrganizations(r.Context())
		if err != nil {
			h.writeDomainError(w, err)
			return
		}
		response := make([]membershipResponse, 0, len(organizations))
		for _, organization := range organizations {
			response = append(response, membershipResponseForOrganization(&organization, domain.RoleSuperAdmin))
		}
		writeJSON(w, http.StatusOK, response)
		return
	}

	response := make([]membershipResponse, 0, len(memberships))
	for _, membership := range memberships {
		if membership.OrganizationID == 0 {
			continue
		}
		organization, getErr := h.svc.GetOrganization(r.Context(), membership.OrganizationID)
		if getErr != nil {
			h.writeDomainError(w, getErr)
			return
		}
		response = append(response, membershipResponseForOrganization(organization, primaryMembershipRole(membership.Roles)))
	}

	writeJSON(w, http.StatusOK, response)
}

func hasGlobalSuperAdminMembership(memberships []domain.Membership) bool {
	for _, membership := range memberships {
		if membership.OrganizationID != 0 {
			continue
		}
		for _, role := range membership.Roles {
			if strings.TrimSpace(strings.ToLower(role)) == domain.RoleSuperAdmin {
				return true
			}
		}
	}
	return false
}

func primaryMembershipRole(roles []string) string {
	role := domain.RoleViewer
	for _, candidate := range roles {
		normalized := strings.TrimSpace(strings.ToLower(candidate))
		if normalized == domain.RoleSuperAdmin {
			return domain.RoleSuperAdmin
		}
		if normalized == domain.RoleEditor {
			role = domain.RoleEditor
		}
	}
	return role
}

func membershipResponseForOrganization(organization *domain.Organization, role string) membershipResponse {
	organizationID := strings.TrimSpace(organization.PublicID)
	if organizationID == "" {
		organizationID = strconv.FormatInt(organization.ID, 10)
	}
	return membershipResponse{
		ID:             organizationID,
		OrganizationID: organizationID,
		InternalID:     strconv.FormatInt(organization.ID, 10),
		PublicID:       organizationID,
		Role:           role,
	}
}

func (h *Handler) organizationRoutes(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/organizations/"), "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}

	organization, err := h.resolveOrganization(parts[0], r.Context())
	if err != nil {
		h.writeDomainError(w, err)
		return
	}
	organizationID := organization.ID
	if err := enforceScopedOrganization(r, organizationID); err != nil {
		httpjson.WriteForbiddenError(w)
		return
	}

	switch {
	case len(parts) == 1 && r.Method == http.MethodGet:
		h.getOrganizationByID(w, r, organizationID)
		return
	case len(parts) == 1 && (r.Method == http.MethodPatch || r.Method == http.MethodPut):
		h.updateOrganization(w, r, organizationID)
		return
	case len(parts) == 1 && r.Method == http.MethodDelete:
		h.deleteOrganization(w, r, organizationID)
		return
	case len(parts) == 2 && parts[1] == "api-keys" && r.Method == http.MethodGet:
		h.listOrganizationAPIKeys(w, r, organizationID)
		return
	case len(parts) == 2 && parts[1] == "api-keys" && r.Method == http.MethodPost:
		h.createOrganizationAPIKey(w, r, organizationID)
		return
	case len(parts) == 3 && parts[1] == "api-keys" && r.Method == http.MethodDelete:
		keyID, parseErr := strconv.ParseInt(parts[2], 10, 64)
		if parseErr != nil || keyID <= 0 {
			httpjson.WriteError(w, http.StatusBadRequest, "invalid api key id")
			return
		}
		h.revokeOrganizationAPIKey(w, r, organizationID, keyID)
		return
	case len(parts) == 2 && parts[1] == "hierarchy" && r.Method == http.MethodGet:
		h.getOrganizationHierarchy(w, r, organizationID)
		return
	case len(parts) == 2 && parts[1] == "invitations" && r.Method == http.MethodPost:
		h.createInvitation(w, r, organizationID)
		return
	case len(parts) == 2 && parts[1] == "invitations" && r.Method == http.MethodGet:
		h.listInvitations(w, r, organizationID)
		return
	case len(parts) == 3 && parts[1] == "invitations" && r.Method == http.MethodGet:
		invitationID, parseErr := strconv.ParseInt(parts[2], 10, 64)
		if parseErr != nil || invitationID <= 0 {
			httpjson.WriteError(w, http.StatusBadRequest, "invalid invitation id")
			return
		}
		h.getInvitationByID(w, r, organizationID, invitationID)
		return
	case len(parts) == 3 && parts[1] == "invitations" && r.Method == http.MethodPut:
		invitationID, parseErr := strconv.ParseInt(parts[2], 10, 64)
		if parseErr != nil || invitationID <= 0 {
			httpjson.WriteError(w, http.StatusBadRequest, "invalid invitation id")
			return
		}
		h.updateInvitation(w, r, organizationID, invitationID)
		return
	case len(parts) == 3 && parts[1] == "invitations" && r.Method == http.MethodDelete:
		invitationID, parseErr := strconv.ParseInt(parts[2], 10, 64)
		if parseErr != nil || invitationID <= 0 {
			httpjson.WriteError(w, http.StatusBadRequest, "invalid invitation id")
			return
		}
		h.deleteInvitation(w, r, organizationID, invitationID)
		return
	case len(parts) == 2 && parts[1] == "members" && r.Method == http.MethodPost:
		h.addMember(w, r, organizationID)
		return
	case len(parts) == 2 && parts[1] == "members" && r.Method == http.MethodGet:
		h.listMembers(w, r, organizationID)
		return
	case len(parts) == 3 && parts[1] == "members" && (r.Method == http.MethodPatch || r.Method == http.MethodPut):
		userID, parseErr := strconv.ParseInt(parts[2], 10, 64)
		if parseErr != nil || userID <= 0 {
			httpjson.WriteError(w, http.StatusBadRequest, "invalid user id")
			return
		}
		h.updateMemberRoles(w, r, organizationID, userID)
		return
	case len(parts) == 3 && parts[1] == "members" && r.Method == http.MethodDelete:
		userID, parseErr := strconv.ParseInt(parts[2], 10, 64)
		if parseErr != nil || userID <= 0 {
			httpjson.WriteError(w, http.StatusBadRequest, "invalid user id")
			return
		}
		h.removeMember(w, r, organizationID, userID)
		return
	case len(parts) == 4 && parts[1] == "members" && parts[3] == "roles" && r.Method == http.MethodPost:
		userID, parseErr := strconv.ParseInt(parts[2], 10, 64)
		if parseErr != nil || userID <= 0 {
			httpjson.WriteError(w, http.StatusBadRequest, "invalid user id")
			return
		}
		h.assignRole(w, r, organizationID, userID)
		return
	// Teams are disabled in the organization page for now.
	// Keep this API path documented but inactive until the UI needs it again.
	// case len(parts) == 4 && parts[1] == "members" && parts[3] == "team" && r.Method == http.MethodPatch:
	// 	userID, parseErr := strconv.ParseInt(parts[2], 10, 64)
	// 	if parseErr != nil || userID <= 0 {
	// 		httpjson.WriteError(w, http.StatusBadRequest, "invalid user id")
	// 		return
	// 	}
	// 	h.updateMemberTeam(w, r, organizationID, userID)
	// 	return
	default:
		http.NotFound(w, r)
		return
	}
}

func (h *Handler) invitationRoutes(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/invitations/"), "/"), "/")
	if len(parts) != 2 || strings.TrimSpace(parts[0]) == "" {
		http.NotFound(w, r)
		return
	}

	token := strings.TrimSpace(parts[0])
	switch {
	case parts[1] == "accept" && r.Method == http.MethodPost:
		h.acceptInvitation(w, r, token)
		return
	case parts[1] == "refuse" && r.Method == http.MethodPost:
		h.refuseInvitation(w, r, token)
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
	writeJSON(w, http.StatusOK, toOrganizationResponse(organization))
}

type updateOrganizationRequest struct {
	Name string `json:"name"`
}

func (h *Handler) updateOrganization(w http.ResponseWriter, r *http.Request, organizationID int64) {
	authUserID, ok := authenticatedUserID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	var req updateOrganizationRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}

	organization, err := h.svc.UpdateOrganizationName(r.Context(), organizationID, req.Name)
	if err != nil {
		h.writeDomainError(w, err)
		auditSecurityEvent("organization_update", map[string]any{
			"organization_id": organizationID,
			"user_id":         authUserID,
			"result":          "error",
		})
		return
	}
	auditSecurityEvent("organization_update", map[string]any{
		"organization_id": organizationID,
		"user_id":         authUserID,
		"result":          "success",
	})
	writeJSON(w, http.StatusOK, toOrganizationResponse(organization))
}

func (h *Handler) deleteOrganization(w http.ResponseWriter, r *http.Request, organizationID int64) {
	authUserID, ok := authenticatedUserID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	if err := h.svc.DeleteOrganization(r.Context(), organizationID); err != nil {
		h.writeDomainError(w, err)
		auditSecurityEvent("organization_delete", map[string]any{
			"organization_id": organizationID,
			"user_id":         authUserID,
			"result":          "error",
		})
		return
	}
	auditSecurityEvent("organization_delete", map[string]any{
		"organization_id": organizationID,
		"user_id":         authUserID,
		"result":          "success",
	})
	w.WriteHeader(http.StatusNoContent)
}

type createOrganizationAPIKeyRequest struct {
	Name string `json:"name"`
}

type validateOrganizationAPIKeyRequest struct {
	APIKey string `json:"api_key"`
}

func (h *Handler) validateOrganizationAPIKey(w http.ResponseWriter, r *http.Request) {
	var req validateOrganizationAPIKeyRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}

	key, err := h.svc.ValidateOrganizationAPIKey(r.Context(), req.APIKey)
	if err != nil {
		h.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, key)
}

func (h *Handler) createOrganizationAPIKey(w http.ResponseWriter, r *http.Request, organizationID int64) {
	authUserID, ok := authenticatedUserID(r)
	if !ok {
		if _, publicOK := publicAPIKeyID(r); !publicOK {
			httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
			return
		}
	}

	var req createOrganizationAPIKeyRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}

	key, err := h.svc.CreateOrganizationAPIKey(r.Context(), organizationID, req.Name)
	if err != nil {
		h.writeDomainError(w, err)
		payload := map[string]any{
			"organization_id": organizationID,
			"result":          "error",
		}
		if authUserID > 0 {
			payload["user_id"] = authUserID
		}
		if apiKeyID, publicOK := publicAPIKeyID(r); publicOK {
			payload["api_key_id"] = apiKeyID
		}
		auditSecurityEvent("organization_api_key_create", payload)
		return
	}
	payload := map[string]any{
		"organization_id": organizationID,
		"api_key_id":      key.ID,
		"result":          "success",
	}
	if authUserID > 0 {
		payload["user_id"] = authUserID
	}
	if actorAPIKeyID, publicOK := publicAPIKeyID(r); publicOK {
		payload["actor_api_key_id"] = actorAPIKeyID
	}
	auditSecurityEvent("organization_api_key_create", payload)
	writeJSON(w, http.StatusCreated, key)
}

func (h *Handler) listOrganizationAPIKeys(w http.ResponseWriter, r *http.Request, organizationID int64) {
	keys, err := h.svc.ListOrganizationAPIKeys(r.Context(), organizationID)
	if err != nil {
		h.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, keys)
}

func (h *Handler) revokeOrganizationAPIKey(w http.ResponseWriter, r *http.Request, organizationID, keyID int64) {
	authUserID, ok := authenticatedUserID(r)
	if !ok {
		if _, publicOK := publicAPIKeyID(r); !publicOK {
			httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
			return
		}
	}

	if err := h.svc.RevokeOrganizationAPIKey(r.Context(), organizationID, keyID); err != nil {
		h.writeDomainError(w, err)
		payload := map[string]any{
			"organization_id": organizationID,
			"api_key_id":      keyID,
			"result":          "error",
		}
		if authUserID > 0 {
			payload["user_id"] = authUserID
		}
		if actorAPIKeyID, publicOK := publicAPIKeyID(r); publicOK {
			payload["actor_api_key_id"] = actorAPIKeyID
		}
		auditSecurityEvent("organization_api_key_revoke", payload)
		return
	}
	payload := map[string]any{
		"organization_id": organizationID,
		"api_key_id":      keyID,
		"result":          "success",
	}
	if authUserID > 0 {
		payload["user_id"] = authUserID
	}
	if actorAPIKeyID, publicOK := publicAPIKeyID(r); publicOK {
		payload["actor_api_key_id"] = actorAPIKeyID
	}
	auditSecurityEvent("organization_api_key_revoke", payload)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) getOrganizationHierarchy(w http.ResponseWriter, r *http.Request, organizationID int64) {
	var hierarchy usecase.OrganizationHierarchy
	var err error
	if hasOrganizationFullAccess(r) {
		hierarchy, err = h.svc.GetOrganizationHierarchy(r.Context(), organizationID)
	} else if userID, ok := authenticatedUserID(r); ok {
		hierarchy, err = h.svc.GetOrganizationHierarchyForUser(r.Context(), organizationID, userID)
	} else {
		hierarchy, err = h.svc.GetOrganizationHierarchy(r.Context(), organizationID)
	}
	if err != nil {
		h.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, organizationHierarchyResponse{
		Organization: toOrganizationResponse(&hierarchy.Organization),
		Projects:     hierarchy.Projects,
	})
}

type addMemberRequest struct {
	UserID int64 `json:"user_id"`
}

func (h *Handler) addMember(w http.ResponseWriter, r *http.Request, organizationID int64) {
	authUserID, ok := authenticatedUserID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	var req addMemberRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}

	// Prevent privilege escalation via forged payloads: membership creation is for caller identity.
	member, err := h.svc.AddMember(r.Context(), organizationID, authUserID)
	if err != nil {
		h.writeDomainError(w, err)
		auditSecurityEvent("organization_member_add", map[string]any{
			"organization_id": organizationID,
			"user_id":         authUserID,
			"result":          "error",
		})
		return
	}
	auditSecurityEvent("organization_member_add", map[string]any{
		"organization_id": organizationID,
		"user_id":         authUserID,
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

type createInvitationRequest struct {
	Email     string `json:"email"`
	Locale    string `json:"locale"`
	Role      string `json:"role"`
	Message   string `json:"message"`
	ProjectID string `json:"projectId"`
	ExpiresAt string `json:"expires_at"`
}

func (h *Handler) createInvitation(w http.ResponseWriter, r *http.Request, organizationID int64) {
	authUserID, ok := authenticatedUserID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	var req createInvitationRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}

	expiresAt, err := parseOptionalRFC3339(req.ExpiresAt)
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, "invalid expires_at format")
		return
	}

	var invitation *domain.Invitation
	if strings.TrimSpace(req.ProjectID) == "" {
		invitation, err = h.svc.CreateInvitation(r.Context(), organizationID, authUserID, req.Email, req.Locale, req.Role, req.Message, expiresAt)
	} else {
		invitation, err = h.svc.CreateProjectInvitation(
			r.Context(),
			organizationID,
			authUserID,
			req.Email,
			req.Locale,
			req.Role,
			req.Message,
			req.ProjectID,
			expiresAt,
		)
	}
	if err != nil {
		h.writeDomainError(w, err)
		auditSecurityEvent("organization_invitation_create", map[string]any{
			"organization_id": organizationID,
			"user_id":         authUserID,
			"email":           req.Email,
			"result":          "error",
		})
		return
	}
	auditSecurityEvent("organization_invitation_create", map[string]any{
		"organization_id": organizationID,
		"user_id":         authUserID,
		"invitation_id":   invitation.ID,
		"result":          "success",
	})
	writeJSON(w, http.StatusCreated, invitation)
}

func (h *Handler) listInvitations(w http.ResponseWriter, r *http.Request, organizationID int64) {
	invitations, err := h.svc.ListInvitations(r.Context(), organizationID)
	if err != nil {
		h.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, invitations)
}

func (h *Handler) getInvitationByID(w http.ResponseWriter, r *http.Request, organizationID, invitationID int64) {
	invitation, err := h.svc.GetInvitation(r.Context(), organizationID, invitationID)
	if err != nil {
		h.writeDomainError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, invitation)
}

type updateInvitationRequest struct {
	Email     string `json:"email"`
	Locale    string `json:"locale"`
	Role      string `json:"role"`
	Message   string `json:"message"`
	ExpiresAt string `json:"expires_at"`
}

func (h *Handler) updateInvitation(w http.ResponseWriter, r *http.Request, organizationID, invitationID int64) {
	authUserID, ok := authenticatedUserID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	var req updateInvitationRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}
	expiresAt, err := parseOptionalRFC3339(req.ExpiresAt)
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, "invalid expires_at format")
		return
	}

	invitation, err := h.svc.UpdateInvitation(
		r.Context(),
		organizationID,
		invitationID,
		req.Email,
		req.Locale,
		req.Role,
		req.Message,
		expiresAt,
	)
	if err != nil {
		h.writeDomainError(w, err)
		auditSecurityEvent("organization_invitation_update", map[string]any{
			"organization_id": organizationID,
			"invitation_id":   invitationID,
			"user_id":         authUserID,
			"result":          "error",
		})
		return
	}
	auditSecurityEvent("organization_invitation_update", map[string]any{
		"organization_id": organizationID,
		"invitation_id":   invitationID,
		"user_id":         authUserID,
		"result":          "success",
	})
	writeJSON(w, http.StatusOK, invitation)
}

func (h *Handler) deleteInvitation(w http.ResponseWriter, r *http.Request, organizationID, invitationID int64) {
	authUserID, ok := authenticatedUserID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	if err := h.svc.DeleteInvitation(r.Context(), organizationID, invitationID); err != nil {
		h.writeDomainError(w, err)
		auditSecurityEvent("organization_invitation_delete", map[string]any{
			"organization_id": organizationID,
			"invitation_id":   invitationID,
			"user_id":         authUserID,
			"result":          "error",
		})
		return
	}
	auditSecurityEvent("organization_invitation_delete", map[string]any{
		"organization_id": organizationID,
		"invitation_id":   invitationID,
		"user_id":         authUserID,
		"result":          "success",
	})
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) acceptInvitation(w http.ResponseWriter, r *http.Request, token string) {
	authUserID, ok := authenticatedUserID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	invitation, member, err := h.svc.AcceptInvitation(r.Context(), token, authUserID)
	if err != nil {
		h.writeDomainError(w, err)
		auditSecurityEvent("organization_invitation_accept", map[string]any{
			"user_id": authUserID,
			"result":  "error",
		})
		return
	}
	auditSecurityEvent("organization_invitation_accept", map[string]any{
		"organization_id": invitation.OrganizationID,
		"invitation_id":   invitation.ID,
		"user_id":         authUserID,
		"result":          "success",
	})
	writeJSON(w, http.StatusOK, map[string]any{
		"invitation": invitation,
		"member":     member,
	})
}

func (h *Handler) refuseInvitation(w http.ResponseWriter, r *http.Request, token string) {
	authUserID, ok := authenticatedUserID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	invitation, err := h.svc.RefuseInvitation(r.Context(), token, authUserID)
	if err != nil {
		h.writeDomainError(w, err)
		auditSecurityEvent("organization_invitation_refuse", map[string]any{
			"user_id": authUserID,
			"result":  "error",
		})
		return
	}
	auditSecurityEvent("organization_invitation_refuse", map[string]any{
		"organization_id": invitation.OrganizationID,
		"invitation_id":   invitation.ID,
		"user_id":         authUserID,
		"result":          "success",
	})
	writeJSON(w, http.StatusOK, invitation)
}

type assignRoleRequest struct {
	Role string `json:"role"`
}

type updateMemberRolesRequest struct {
	Roles []string `json:"roles"`
}

func (h *Handler) updateMemberRoles(w http.ResponseWriter, r *http.Request, organizationID, userID int64) {
	authUserID, ok := authenticatedUserID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	var req updateMemberRolesRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}

	member, err := h.svc.UpdateMemberRoles(r.Context(), organizationID, userID, req.Roles)
	if err != nil {
		h.writeDomainError(w, err)
		auditSecurityEvent("organization_member_roles_update", map[string]any{
			"organization_id": organizationID,
			"user_id":         userID,
			"actor_user_id":   authUserID,
			"result":          "error",
		})
		return
	}
	auditSecurityEvent("organization_member_roles_update", map[string]any{
		"organization_id": organizationID,
		"user_id":         userID,
		"actor_user_id":   authUserID,
		"result":          "success",
	})
	writeJSON(w, http.StatusOK, member)
}

func (h *Handler) removeMember(w http.ResponseWriter, r *http.Request, organizationID, userID int64) {
	authUserID, ok := authenticatedUserID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	if err := h.svc.RemoveMember(r.Context(), organizationID, userID); err != nil {
		h.writeDomainError(w, err)
		auditSecurityEvent("organization_member_remove", map[string]any{
			"organization_id": organizationID,
			"user_id":         userID,
			"actor_user_id":   authUserID,
			"result":          "error",
		})
		return
	}
	auditSecurityEvent("organization_member_remove", map[string]any{
		"organization_id": organizationID,
		"user_id":         userID,
		"actor_user_id":   authUserID,
		"result":          "success",
	})
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) assignRole(w http.ResponseWriter, r *http.Request, organizationID, userID int64) {
	if _, ok := authenticatedUserID(r); !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	var req assignRoleRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
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
		errors.Is(err, domain.ErrInvalidMember),
		errors.Is(err, domain.ErrInvalidRole),
		errors.Is(err, domain.ErrInvalidInvitation):
		httpjson.WriteValidationError(w)
	case errors.Is(err, domain.ErrOrganizationNotFound),
		errors.Is(err, domain.ErrMemberNotFound),
		errors.Is(err, domain.ErrInvitationNotFound):
		httpjson.WriteNotFoundError(w)
	case errors.Is(err, domain.ErrInvitationExpired),
		errors.Is(err, domain.ErrInvitationAlreadyHandled):
		httpjson.WriteConflictError(w)
	case errors.Is(err, domain.ErrInvitationEmailMismatch):
		httpjson.WriteForbiddenError(w)
	default:
		httpjson.WriteInternalError(w)
	}
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	httpjson.WriteSuccess(w, status, value)
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

func authenticatedOrganizationID(r *http.Request) (int64, bool) {
	raw := strings.TrimSpace(r.Header.Get("X-Organization-ID"))
	if raw == "" {
		return 0, false
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return 0, false
	}
	return id, true
}

func hasOrganizationFullAccess(r *http.Request) bool {
	raw := strings.TrimSpace(r.Header.Get("X-Organization-Full-Access"))
	if raw == "" {
		return false
	}
	switch strings.ToLower(raw) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func (h *Handler) resolveOrganization(raw string, ctx context.Context) (*domain.Organization, error) {
	identifier := strings.TrimSpace(raw)
	if identifier == "" {
		return nil, fmt.Errorf("%w: organization id is required", domain.ErrInvalidOrganization)
	}
	if organizationID, err := strconv.ParseInt(identifier, 10, 64); err == nil && organizationID > 0 {
		return h.svc.GetOrganization(ctx, organizationID)
	}
	return h.svc.GetOrganizationByPublicID(ctx, identifier)
}

func publicAPIKeyID(r *http.Request) (int64, bool) {
	raw := strings.TrimSpace(r.Header.Get("X-Public-API-Key-ID"))
	if raw == "" {
		return 0, false
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return 0, false
	}
	return id, true
}

func enforceScopedOrganization(r *http.Request, organizationID int64) error {
	raw := strings.TrimSpace(r.Header.Get("X-Organization-ID"))
	if raw == "" {
		return nil
	}
	scopedID, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || scopedID <= 0 {
		return errors.New("invalid organization scope")
	}
	if scopedID != organizationID {
		return errors.New("organization scope mismatch")
	}
	return nil
}

func parseOptionalRFC3339(raw string) (*time.Time, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return nil, err
	}
	parsed = parsed.UTC()
	return &parsed, nil
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
