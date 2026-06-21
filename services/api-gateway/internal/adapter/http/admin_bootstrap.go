package http

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
)

var errSuperAdminAlreadyClaimed = errors.New("super admin already claimed")

type adminBootstrapSuperAdminRequest struct {
	Code string `json:"code"`
}

func (h *Handler) handleAdminBootstrapSuperAdmin(w http.ResponseWriter, r *http.Request) {
	if h.adminBootstrapCode == "" {
		writeJSONError(w, http.StatusServiceUnavailable, "admin bootstrap unavailable")
		return
	}

	identityID, err := h.validateAuth(r.Context(), r.Header.Get("Cookie"), r.Header.Get("X-Session-Token"))
	if err != nil {
		if err == errUnauthorized {
			writeJSONError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		writeJSONError(w, http.StatusServiceUnavailable, "auth dependency unavailable")
		return
	}
	userID, err := h.resolveUserID(r.Context(), identityID)
	if err != nil {
		if isDependencyUnavailableError(err) {
			writeJSONError(w, http.StatusServiceUnavailable, "user dependency unavailable")
			return
		}
		writeJSONError(w, http.StatusUnauthorized, "user profile required")
		return
	}

	var req adminBootstrapSuperAdminRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}
	if subtle.ConstantTimeCompare([]byte(strings.TrimSpace(req.Code)), []byte(h.adminBootstrapCode)) != 1 {
		auditSecurityEvent("admin_bootstrap_super_admin_denied", map[string]any{
			"identity_id": identityID,
			"user_id":     userID,
			"reason":      "invalid_code",
		})
		writeJSONError(w, http.StatusForbidden, "forbidden")
		return
	}

	if err := h.claimGlobalSuperAdmin(r, identityID, userID); err != nil {
		if errors.Is(err, errSuperAdminAlreadyClaimed) {
			writeJSONError(w, http.StatusForbidden, "forbidden")
			return
		}
		writeJSONError(w, http.StatusBadGateway, "permission service unavailable")
		return
	}

	auditSecurityEvent("admin_bootstrap_super_admin_claimed", map[string]any{
		"identity_id": identityID,
		"user_id":     userID,
	})
	httpjson.WriteSuccess(w, http.StatusOK, map[string]any{
		"role":           "super_admin",
		"organizationId": 0,
	})
}

func (h *Handler) claimGlobalSuperAdmin(r *http.Request, identityID string, userID int64) error {
	return h.executeDependencyCall(r.Context(), h.permissionBreaker, h.permissionBulkhead, 2, 40*time.Millisecond, 600*time.Millisecond, func(attemptCtx context.Context) (bool, bool, error) {
		internalToken, tokenErr := signInternalJWT(
			h.internalJWTSecret,
			h.internalJWTIssuer,
			"permission-service",
			internalTokenClaims{
				IdentityID: identityID,
				UserID:     userID,
			},
		)
		if tokenErr != nil {
			return false, false, tokenErr
		}

		callCtx, cancel := context.WithTimeout(attemptCtx, 700*time.Millisecond)
		defer cancel()
		req, err := http.NewRequestWithContext(callCtx, http.MethodPost, h.permissionURL+"/internal/admin/bootstrap-super-admin", nil)
		if err != nil {
			return false, false, err
		}
		req.Header.Set("Authorization", "Bearer "+internalToken)
		req.Header.Set("X-Authenticated-Identity-ID", identityID)
		req.Header.Set("X-Authenticated-User-ID", fmt.Sprintf("%d", userID))

		resp, err := h.httpClient.Do(req)
		if err != nil {
			return isTransientNetError(err), true, err
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			return false, true, nil
		}
		if resp.StatusCode == http.StatusForbidden {
			return false, false, errSuperAdminAlreadyClaimed
		}
		return isTransientHTTPStatus(resp.StatusCode), true, fmt.Errorf("permission status=%d", resp.StatusCode)
	})
}
