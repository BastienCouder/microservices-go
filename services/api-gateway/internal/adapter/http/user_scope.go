package http

import (
	"net/http"
	"strconv"
	"strings"
)

func enforceSelfScopedUserRoute(r *http.Request, identityID string, userID int64) (denyReason string, enforced bool) {
	if r == nil || r.Method != http.MethodGet {
		return "", false
	}
	path := strings.TrimSpace(r.URL.Path)
	if !strings.HasPrefix(path, "/users/") {
		return "", false
	}
	if path == "/users/me" {
		return "", false
	}
	if strings.HasPrefix(path, "/users/by-auth/") {
		requestedIdentity := strings.TrimSpace(strings.TrimPrefix(path, "/users/by-auth/"))
		if requestedIdentity == "" {
			return "missing by-auth identity", true
		}
		if requestedIdentity != identityID {
			return "cross-identity lookup", true
		}
		return "", true
	}

	requestedUserID, err := strconv.ParseInt(strings.TrimPrefix(path, "/users/"), 10, 64)
	if err != nil || requestedUserID <= 0 {
		return "", false
	}
	if userID <= 0 {
		return "missing resolved user id", true
	}
	if requestedUserID != userID {
		return "cross-user lookup", true
	}
	return "", true
}
