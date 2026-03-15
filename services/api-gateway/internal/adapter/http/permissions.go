package http

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	permissionv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/permission/v1"
)

func (h *Handler) checkPermission(ctx context.Context, userID, organizationID int64, action, resource string) (bool, error) {
	if h.permissionGRPC == nil {
		return false, errors.New("permission grpc client is not configured")
	}
	var allowed bool
	err := h.executeDependencyCall(ctx, h.permissionBreaker, h.permissionBulkhead, 2, 40*time.Millisecond, 600*time.Millisecond, func(attemptCtx context.Context) (bool, bool, error) {
		internalToken, tokenErr := signInternalJWT(
			h.internalJWTSecret,
			h.internalJWTIssuer,
			"permission-service",
			internalTokenClaims{
				IdentityID:   "",
				UserID:       userID,
				Organization: organizationID,
			},
		)
		if tokenErr != nil {
			return false, false, tokenErr
		}

		callCtx, cancel := context.WithTimeout(attemptCtx, 700*time.Millisecond)
		defer cancel()

		resp, err := h.permissionGRPC.Check(callCtx, &permissionv1.CheckRequest{
			OrganizationId: organizationID,
			UserId:         userID,
			Action:         action,
			Resource:       resource,
		}, internalToken)
		if err != nil {
			return true, true, err
		}
		allowed = resp.GetAllowed()
		return false, true, nil
	})
	if err != nil {
		return false, err
	}
	return allowed, nil
}

func shouldEnforcePermission(r *http.Request) bool {
	if r.URL.Path == "/organizations" && r.Method == http.MethodPost {
		return false
	}
	if r.URL.Path == "/organizations/me" && r.Method == http.MethodGet {
		return false
	}
	if r.URL.Path == "/permissions/check" && r.Method == http.MethodPost {
		return false
	}
	if isAdminUsersRoute(r) {
		return false
	}
	return strings.HasPrefix(r.URL.Path, "/organizations/") ||
		strings.HasPrefix(r.URL.Path, "/projects") ||
		strings.HasPrefix(r.URL.Path, "/prompts") ||
		strings.HasPrefix(r.URL.Path, "/competitors") ||
		strings.HasPrefix(r.URL.Path, "/ai-models") ||
		strings.HasPrefix(r.URL.Path, "/analysis") ||
		strings.HasPrefix(r.URL.Path, "/permissions") ||
		strings.HasPrefix(r.URL.Path, "/billing") ||
		strings.HasPrefix(r.URL.Path, "/notifications")
}

func actionFromMethod(method string) string {
	switch method {
	case http.MethodGet:
		return "read"
	case http.MethodPost:
		return "create"
	case http.MethodPut, http.MethodPatch:
		return "update"
	case http.MethodDelete:
		return "delete"
	default:
		return "read"
	}
}

func resourceFromPath(path, fallback string) string {
	switch {
	case strings.Contains(path, "/teams"):
		return "teams"
	case strings.Contains(path, "/members"):
		return "members"
	case strings.Contains(path, "/roles"):
		return "roles"
	case strings.HasPrefix(path, "/organizations"):
		return "organizations"
	case strings.HasPrefix(path, "/permissions"):
		return "permissions"
	case strings.HasPrefix(path, "/billing"):
		return "billing"
	case strings.HasPrefix(path, "/notifications"):
		return "notifications"
	default:
		return fallback
	}
}
