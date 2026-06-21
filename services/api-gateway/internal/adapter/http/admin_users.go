package http

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
)

type adminUser struct {
	ID             int64      `json:"ID"`
	AuthIdentityID string     `json:"AuthIdentityID"`
	Email          string     `json:"Email"`
	FirstName      string     `json:"FirstName"`
	LastName       string     `json:"LastName"`
	Banned         bool       `json:"Banned"`
	BannedAt       *time.Time `json:"BannedAt"`
	CreatedAt      time.Time  `json:"CreatedAt"`
	DeletedAt      *time.Time `json:"DeletedAt"`
	IsSuperAdmin   bool       `json:"is_super_admin"`
}

type adminBootstrapStatus struct {
	Exists bool `json:"exists"`
}

func isAdminBootstrapSuperAdminStatusRequest(r *http.Request) bool {
	return r.Method == http.MethodGet && r.URL.Path == "/admin/bootstrap-super-admin/status"
}

func isAdminUsersListRequest(r *http.Request) bool {
	return r.Method == http.MethodGet && r.URL.Path == "/admin/users"
}

func isAdminUserGrantSuperAdminRequest(r *http.Request) bool {
	if r.Method != http.MethodPost {
		return false
	}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	return len(parts) == 4 &&
		parts[0] == "admin" &&
		parts[1] == "users" &&
		parts[2] != "" &&
		parts[3] == "super-admin"
}

func (h *Handler) handleAdminBootstrapSuperAdminStatus(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := h.resolveAuthenticatedGatewayUser(w, r); !ok {
		return
	}
	status, err := h.loadGlobalSuperAdminStatus(r.Context())
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, "permission service unavailable")
		return
	}
	httpjson.WriteSuccess(w, http.StatusOK, status)
}

func (h *Handler) handleAdminUsers(w http.ResponseWriter, r *http.Request) {
	identityID, userID, ok := h.resolveAuthenticatedGatewayUser(w, r)
	if !ok {
		return
	}
	if !h.currentUserIsGlobalSuperAdmin(r.Context(), userID) {
		writeJSONError(w, http.StatusForbidden, "forbidden")
		return
	}

	users, err := h.loadAdminUsers(r.Context(), identityID, userID)
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, "user service unavailable")
		return
	}
	superAdminIDs, err := h.loadGlobalSuperAdminIDs(r.Context())
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, "permission service unavailable")
		return
	}

	superAdminSet := make(map[int64]struct{}, len(superAdminIDs))
	for _, id := range superAdminIDs {
		superAdminSet[id] = struct{}{}
	}
	for index := range users {
		_, users[index].IsSuperAdmin = superAdminSet[users[index].ID]
	}
	httpjson.WriteSuccess(w, http.StatusOK, users)
}

func (h *Handler) handleGrantAdminUserSuperAdmin(w http.ResponseWriter, r *http.Request) {
	_, currentUserID, ok := h.resolveAuthenticatedGatewayUser(w, r)
	if !ok {
		return
	}
	if !h.currentUserIsGlobalSuperAdmin(r.Context(), currentUserID) {
		writeJSONError(w, http.StatusForbidden, "forbidden")
		return
	}

	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	targetUserID, err := strconv.ParseInt(parts[2], 10, 64)
	if err != nil || targetUserID <= 0 {
		writeJSONError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	if err := h.grantGlobalSuperAdmin(r.Context(), targetUserID); err != nil {
		writeJSONError(w, http.StatusBadGateway, "permission service unavailable")
		return
	}
	httpjson.WriteSuccess(w, http.StatusOK, map[string]any{
		"user_id":        targetUserID,
		"is_super_admin": true,
	})
}

func (h *Handler) resolveAuthenticatedGatewayUser(w http.ResponseWriter, r *http.Request) (string, int64, bool) {
	identityID, err := h.validateAuth(r.Context(), r.Header.Get("Cookie"), r.Header.Get("X-Session-Token"))
	if err != nil {
		if err == errUnauthorized {
			writeJSONError(w, http.StatusUnauthorized, "unauthorized")
			return "", 0, false
		}
		writeJSONError(w, http.StatusServiceUnavailable, "auth dependency unavailable")
		return "", 0, false
	}
	userID, err := h.resolveUserID(r.Context(), identityID)
	if err != nil {
		if isDependencyUnavailableError(err) {
			writeJSONError(w, http.StatusServiceUnavailable, "user dependency unavailable")
			return "", 0, false
		}
		writeJSONError(w, http.StatusUnauthorized, "user profile required")
		return "", 0, false
	}
	return identityID, userID, true
}

func (h *Handler) currentUserIsGlobalSuperAdmin(ctx context.Context, userID int64) bool {
	memberships, err := h.loadUserPermissionMemberships(ctx, userID)
	if err != nil {
		return false
	}
	for _, membership := range memberships {
		if membership.OrganizationID != 0 {
			continue
		}
		for _, role := range membership.Roles {
			if strings.TrimSpace(strings.ToLower(role)) == "super_admin" {
				return true
			}
		}
	}
	return false
}

type permissionMembership struct {
	OrganizationID int64    `json:"organization_id"`
	UserID         int64    `json:"user_id"`
	Roles          []string `json:"roles"`
}

func (h *Handler) loadUserPermissionMemberships(ctx context.Context, userID int64) ([]permissionMembership, error) {
	var memberships []permissionMembership
	err := h.executeGatewayJSONDependency(ctx, "permission-service", h.permissionURL+"/internal/users/"+strconv.FormatInt(userID, 10)+"/organizations", http.MethodGet, 0, &memberships)
	return memberships, err
}

func (h *Handler) loadGlobalSuperAdminStatus(ctx context.Context) (adminBootstrapStatus, error) {
	var status adminBootstrapStatus
	err := h.executeGatewayJSONDependency(ctx, "permission-service", h.permissionURL+"/internal/admin/bootstrap-super-admin/status", http.MethodGet, 0, &status)
	return status, err
}

func (h *Handler) loadGlobalSuperAdminIDs(ctx context.Context) ([]int64, error) {
	var payload struct {
		UserIDs []int64 `json:"user_ids"`
	}
	err := h.executeGatewayJSONDependency(ctx, "permission-service", h.permissionURL+"/internal/admin/super-admins", http.MethodGet, 0, &payload)
	return payload.UserIDs, err
}

func (h *Handler) loadAdminUsers(ctx context.Context, identityID string, userID int64) ([]adminUser, error) {
	var users []adminUser
	err := h.executeGatewayJSONDependency(ctx, "user-service", h.userURL+"/admin/users", http.MethodGet, userID, &users, identityID)
	return users, err
}

func (h *Handler) grantGlobalSuperAdmin(ctx context.Context, userID int64) error {
	return h.executeGatewayJSONDependency(ctx, "permission-service", h.permissionURL+"/internal/admin/users/"+strconv.FormatInt(userID, 10)+"/super-admin", http.MethodPost, 0, nil)
}

func (h *Handler) executeGatewayJSONDependency(ctx context.Context, audience string, url string, method string, userID int64, out any, identityID ...string) error {
	tokenClaims := internalTokenClaims{UserID: userID}
	if len(identityID) > 0 {
		tokenClaims.IdentityID = identityID[0]
	}
	return h.executeDependencyCall(ctx, h.permissionBreaker, h.permissionBulkhead, 2, 40*time.Millisecond, 800*time.Millisecond, func(attemptCtx context.Context) (bool, bool, error) {
		internalToken, tokenErr := signInternalJWT(h.internalJWTSecret, h.internalJWTIssuer, audience, tokenClaims)
		if tokenErr != nil {
			return false, false, tokenErr
		}
		callCtx, cancel := context.WithTimeout(attemptCtx, 900*time.Millisecond)
		defer cancel()
		req, err := http.NewRequestWithContext(callCtx, method, url, nil)
		if err != nil {
			return false, false, err
		}
		req.Header.Set("Authorization", "Bearer "+internalToken)
		if tokenClaims.IdentityID != "" {
			req.Header.Set("X-Authenticated-Identity-ID", tokenClaims.IdentityID)
		}
		if tokenClaims.UserID > 0 {
			req.Header.Set("X-Authenticated-User-ID", strconv.FormatInt(tokenClaims.UserID, 10))
		}
		resp, err := h.httpClient.Do(req)
		if err != nil {
			return isTransientNetError(err), true, err
		}
		defer resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return isTransientHTTPStatus(resp.StatusCode), true, fmt.Errorf("%s status=%d", audience, resp.StatusCode)
		}
		if out != nil {
			if err := httpjson.DecodeSuccessData(resp.Body, out); err != nil {
				return false, false, err
			}
		}
		return false, true, nil
	})
}
