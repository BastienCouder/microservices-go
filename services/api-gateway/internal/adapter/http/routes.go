package http

import (
	"net/http"
	"strings"
)

type routeEntry struct {
	match   func(*http.Request) bool
	handler http.Handler
}

func isHealthRequest(r *http.Request) bool {
	return r.Method == http.MethodGet && r.URL.Path == "/health"
}

func (h *Handler) buildRoutes() []routeEntry {
	authHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h.serveProxyWithInternalAuth(w, r, h.authProxy, "auth-service", internalTokenClaims{})
	})
	userHandler := h.withAuth(h.userProxy, "user-service", "users")

	routes := []routeEntry{
		{
			match: func(r *http.Request) bool { return isHealthRequest(r) },
			handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				h.health(w, r)
			}),
		},
		{match: matchPathPrefix("/auth"), handler: authHandler},
		{match: matchPathPrefix("/users"), handler: userHandler},
		{match: matchPathPrefix("/admin/users"), handler: userHandler},
		{match: matchPathPrefix("/organizations"), handler: h.withAuth(h.organizationsProxy, "organizations-service", "organizations")},
		{match: matchPathPrefix("/permissions"), handler: h.withAuth(h.permissionProxy, "permission-service", "permissions")},
		{match: matchPathPrefix("/billing"), handler: h.withAuth(h.billingProxy, "billing-service", "billing")},
		{match: matchPathPrefix("/notifications"), handler: h.withAuth(h.notificationProxy, "notification-service", "notifications")},
		{match: matchPathPrefix("/projects"), handler: h.withAuth(h.projectProxy, "project-service", "projects")},
		{match: matchPathPrefix("/analysis"), handler: h.withAuth(h.analysisProxy, "analysis-service", "analysis")},
		{match: matchPathPrefix("/ai"), handler: h.withAuth(h.iaProxy, "ia-service", "ia")},
		{match: matchPathPrefix("/attribution"), handler: h.withAuth(h.attributionProxy, "attribution-service", "attribution")},
	}

	return routes
}

func matchPathPrefix(base string) func(*http.Request) bool {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	return func(r *http.Request) bool {
		path := r.URL.Path
		return path == base || strings.HasPrefix(path, base+"/")
	}
}
