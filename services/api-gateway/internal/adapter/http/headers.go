package http

import (
	"errors"
	"net"
	"net/http"
	"strconv"
	"strings"
)

func clientIP(r *http.Request) string {
	if xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	if r.RemoteAddr != "" {
		return r.RemoteAddr
	}
	return "unknown"
}

func organizationIDFromHeader(raw string) (int64, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return 0, errors.New("missing X-Organization-ID header")
	}
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id <= 0 {
		return 0, errors.New("invalid X-Organization-ID header")
	}
	return id, nil
}

func authenticatedUserIDFromHeader(raw string) (int64, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return 0, errors.New("missing authenticated user")
	}
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id <= 0 {
		return 0, errors.New("missing authenticated user")
	}
	return id, nil
}

func orgAndUserIDsFromRequest(w http.ResponseWriter, r *http.Request) (orgID, userID int64, ok bool) {
	orgID, err := organizationIDFromHeader(r.Header.Get("X-Organization-ID"))
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return 0, 0, false
	}
	userID, err = authenticatedUserIDFromHeader(r.Header.Get("X-Authenticated-User-ID"))
	if err != nil {
		writeJSONError(w, http.StatusUnauthorized, err.Error())
		return 0, 0, false
	}
	return orgID, userID, true
}
