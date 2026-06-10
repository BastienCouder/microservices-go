package http

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
)

const appEntryOnboardingRedirect = "/onboarding?setup=account"

func (h *Handler) handleAppEntry(w http.ResponseWriter, r *http.Request) {
	originalPath := appEntryOriginalPath(r)
	identityID, err := h.validateAuth(r.Context(), r.Header.Get("Cookie"), r.Header.Get("X-Session-Token"))
	if err != nil {
		if errors.Is(err, errUnauthorized) {
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

	if appEntryBypassPath(originalPath) {
		w.Header().Set("X-Authenticated-Identity-ID", identityID)
		w.Header().Set("X-Authenticated-User-ID", strconv.FormatInt(userID, 10))
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if _, err := h.resolveOrganizationID(r.Context(), userID); err != nil {
		if isDependencyUnavailableError(err) {
			writeJSONError(w, http.StatusServiceUnavailable, "organization dependency unavailable")
			return
		}
		w.Header().Set("X-App-Redirect", appEntryOnboardingRedirect)
		writeJSONError(w, http.StatusForbidden, "organization required")
		return
	}

	w.Header().Set("X-Authenticated-Identity-ID", identityID)
	w.Header().Set("X-Authenticated-User-ID", strconv.FormatInt(userID, 10))
	w.WriteHeader(http.StatusNoContent)
}

func appEntryOriginalPath(r *http.Request) string {
	originalURI := strings.TrimSpace(r.Header.Get("X-Original-URI"))
	if originalURI == "" {
		return r.URL.Path
	}
	path := originalURI
	if index := strings.Index(path, "?"); index >= 0 {
		path = path[:index]
	}
	if path == "" {
		return "/"
	}
	return path
}

func appEntryBypassPath(path string) bool {
	return path == "/onboarding" ||
		strings.HasPrefix(path, "/onboarding/") ||
		path == "/invitations" ||
		strings.HasPrefix(path, "/invitations/") ||
		path == "/billing" ||
		strings.HasPrefix(path, "/billing/")
}
