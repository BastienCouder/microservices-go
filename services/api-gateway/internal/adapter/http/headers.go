package http

import (
	"errors"
	"net"
	"net/http"
	"strconv"
	"strings"
)

func (h *Handler) clientIP(r *http.Request) string {
	remoteIP := parseRemoteIP(r.RemoteAddr)
	if remoteIP == nil {
		if r.RemoteAddr != "" {
			return r.RemoteAddr
		}
		return "unknown"
	}

	// Ignore XFF unless the direct peer is a trusted proxy.
	if !h.isTrustedProxy(remoteIP) {
		return remoteIP.String()
	}

	xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if xff == "" {
		return remoteIP.String()
	}

	chain := parseForwardedIPs(xff)
	if len(chain) == 0 {
		return remoteIP.String()
	}

	// Resolve the left-most non-trusted address after removing trusted proxy hops from the right.
	chain = append(chain, remoteIP)
	for i := len(chain) - 1; i >= 0; i-- {
		ip := chain[i]
		if h.isTrustedProxy(ip) {
			continue
		}
		return ip.String()
	}
	return remoteIP.String()
}

func parseRemoteIP(remoteAddr string) net.IP {
	host, _, err := net.SplitHostPort(strings.TrimSpace(remoteAddr))
	if err == nil && host != "" {
		return net.ParseIP(host)
	}
	return net.ParseIP(strings.TrimSpace(remoteAddr))
}

func parseForwardedIPs(xff string) []net.IP {
	parts := strings.Split(xff, ",")
	ips := make([]net.IP, 0, len(parts))
	for _, part := range parts {
		ip := net.ParseIP(strings.TrimSpace(part))
		if ip != nil {
			ips = append(ips, ip)
		}
	}
	return ips
}

func (h *Handler) isTrustedProxy(ip net.IP) bool {
	if ip == nil || h == nil || len(h.trustedProxyNets) == 0 {
		return false
	}
	for _, network := range h.trustedProxyNets {
		if network.Contains(ip) {
			return true
		}
	}
	return false
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
