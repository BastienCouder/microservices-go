package http

import (
	"net/http"
	"strings"
)

type routeEntry struct {
	match   func(*http.Request) bool
	handler http.Handler
	service string
}

func isHealthRequest(r *http.Request) bool {
	return r.Method == http.MethodGet && r.URL.Path == "/health"
}

func isBillingStripeWebhookRequest(r *http.Request) bool {
	return r.Method == http.MethodPost && r.URL.Path == "/billing/stripe/webhook"
}

func (h *Handler) buildRoutes() []routeEntry {
	authHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h.serveProxyWithInternalAuth(w, r, h.authProxy, "auth-service", internalTokenClaims{})
	})
	userHandler := h.withAuth(h.userProxy, "user-service", "users")
	billingStripeWebhookHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h.serveProxyWithInternalAuth(w, r, h.billingProxy, "billing-service", internalTokenClaims{})
	})

	routes := []routeEntry{
		{
			match: func(r *http.Request) bool { return isHealthRequest(r) },
			handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				h.health(w, r)
			}),
			service: "api-gateway",
		},
		{match: matchPathPrefix("/auth"), handler: authHandler, service: "auth-service"},
		{match: matchPathPrefix("/users"), handler: userHandler, service: "user-service"},
		{match: matchPathPrefix("/admin/users"), handler: userHandler, service: "user-service"},
		{match: matchPathPrefix("/organizations"), handler: h.withAuth(h.organizationsProxy, "organizations-service", "organizations"), service: "organizations-service"},
		{match: matchPathPrefix("/invitations"), handler: h.withAuth(h.organizationsProxy, "organizations-service", "organizations"), service: "organizations-service"},
		{match: matchPathPrefix("/permissions"), handler: h.withAuth(h.permissionProxy, "permission-service", "permissions"), service: "permission-service"},
		{match: isBillingStripeWebhookRequest, handler: billingStripeWebhookHandler, service: "billing-service"},
		{match: matchPathPrefix("/billing"), handler: h.withAuth(h.billingProxy, "billing-service", "billing"), service: "billing-service"},
		{match: matchPathPrefix("/notifications"), handler: h.withAuth(h.notificationProxy, "notification-service", "notifications"), service: "notification-service"},
		{match: matchPathPrefix("/projects"), handler: h.withAuth(h.projectProxy, "project-service", "projects"), service: "project-service"},
		{match: matchPathPrefix("/analysis"), handler: h.withAuth(h.analysisProxy, "analysis-service", "analysis"), service: "analysis-service"},
		{match: matchPathPrefix("/ai"), handler: h.withAuth(h.iaProxy, "ia-service", "ia"), service: "ia-service"},
		{match: matchPathPrefix("/attribution"), handler: h.withAuth(h.attributionProxy, "attribution-service", "attribution"), service: "attribution-service"},
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
