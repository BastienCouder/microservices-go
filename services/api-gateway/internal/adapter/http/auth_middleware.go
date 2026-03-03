package http

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
)

func (h *Handler) withAuth(next http.Handler, serviceAudience, defaultResource string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/health") || r.URL.Path == "/health" {
			h.serveProxyWithInternalAuth(w, r, next, serviceAudience, internalTokenClaims{})
			return
		}

		identityID, err := h.validateAuth(r.Context(), r.Header.Get("Cookie"), r.Header.Get("X-Session-Token"))
		if err != nil {
			if errors.Is(err, errUnauthorized) {
				writeJSONError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			writeJSONError(w, http.StatusServiceUnavailable, "auth dependency unavailable")
			return
		}

		r2 := r.Clone(r.Context())
		r2.Header = r.Header.Clone()
		r2.Header.Set("X-Authenticated-Identity-ID", identityID)
		claims := internalTokenClaims{IdentityID: identityID}

		if userID, err := h.resolveUserID(r.Context(), identityID); err == nil {
			r2.Header.Set("X-Authenticated-User-ID", strconv.FormatInt(userID, 10))
			claims.UserID = userID
		} else if requiresResolvedUserID(r) {
			if isDependencyUnavailableError(err) {
				writeJSONError(w, http.StatusServiceUnavailable, "user dependency unavailable")
				return
			}
			writeJSONError(w, http.StatusUnauthorized, "user profile required")
			return
		}
		if denyReason, enforce := enforceSelfScopedUserRoute(r2, identityID, claims.UserID); enforce {
			if denyReason != "" {
				writeJSONError(w, http.StatusForbidden, "forbidden")
				auditSecurityEvent("user_scope_check", map[string]any{
					"path":        r2.URL.Path,
					"method":      r2.Method,
					"identity_id": identityID,
					"user_id":     claims.UserID,
					"result":      "denied",
					"reason":      denyReason,
				})
				return
			}
			auditSecurityEvent("user_scope_check", map[string]any{
				"path":        r2.URL.Path,
				"method":      r2.Method,
				"identity_id": identityID,
				"user_id":     claims.UserID,
				"result":      "allowed",
			})
		}

		if isAdminUsersRoute(r2) {
			orgID, userID, ok := orgAndUserIDsFromRequest(w, r2)
			if !ok {
				return
			}

			allowed, err := h.checkPermission(r.Context(), userID, orgID, "admin", "users")
			if err != nil {
				writeJSONError(w, http.StatusBadGateway, "permission service unavailable")
				return
			}
			if !allowed {
				writeJSONError(w, http.StatusForbidden, "forbidden")
				return
			}
			claims.Organization = orgID
			auditSecurityEvent("admin_action", map[string]any{
				"user_id":         userID,
				"organization_id": orgID,
				"path":            r2.URL.Path,
				"method":          r2.Method,
				"result":          "allowed",
			})
		}

		if shouldEnforcePermission(r2) {
			orgID, userID, ok := orgAndUserIDsFromRequest(w, r2)
			if !ok {
				return
			}
			action := actionFromMethod(r2.Method)
			resource := resourceFromPath(r2.URL.Path, defaultResource)
			allowed, err := h.checkPermission(r.Context(), userID, orgID, action, resource)
			if err != nil {
				writeJSONError(w, http.StatusBadGateway, "permission service unavailable")
				auditSecurityEvent("permission_check", map[string]any{
					"user_id":         userID,
					"organization_id": orgID,
					"action":          action,
					"resource":        resource,
					"result":          "error",
					"path":            r2.URL.Path,
				})
				return
			}
			if !allowed {
				writeJSONError(w, http.StatusForbidden, "forbidden")
				auditSecurityEvent("permission_check", map[string]any{
					"user_id":         userID,
					"organization_id": orgID,
					"action":          action,
					"resource":        resource,
					"result":          "denied",
					"path":            r2.URL.Path,
				})
				return
			}
			claims.Organization = orgID
			auditSecurityEvent("permission_check", map[string]any{
				"user_id":         userID,
				"organization_id": orgID,
				"action":          action,
				"resource":        resource,
				"result":          "allowed",
				"path":            r2.URL.Path,
			})
		}

		h.serveProxyWithInternalAuth(w, r2, next, serviceAudience, claims)
	})
}

func requiresResolvedUserID(r *http.Request) bool {
	if r.URL.Path == "/users" && r.Method == http.MethodPost {
		return false
	}
	if r.URL.Path == "/users/me" && r.Method == http.MethodGet {
		return false
	}
	if r.URL.Path == "/auth" || strings.HasPrefix(r.URL.Path, "/auth/") {
		return false
	}
	return true
}

func isAdminUsersRoute(r *http.Request) bool {
	return r.URL.Path == "/admin/users" || strings.HasPrefix(r.URL.Path, "/admin/users/")
}
