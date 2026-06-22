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

func isBillingPublicPlansRequest(r *http.Request) bool {
	return r.Method == http.MethodGet &&
		(r.URL.Path == "/billing/public/plans" || r.URL.Path == "/billing/public/pricing-tiers")
}

func isAppEntryRequest(r *http.Request) bool {
	return r.Method == http.MethodGet && r.URL.Path == "/auth/app-entry"
}

func isOnboardingModelCatalogRequest(r *http.Request) bool {
	return r.Method == http.MethodGet && r.URL.Path == "/onboarding/ai-models"
}

func isOnboardingProjectCreateRequest(r *http.Request) bool {
	return r.Method == http.MethodPost && r.URL.Path == "/onboarding/project"
}

func isOnboardingBootstrapRequest(r *http.Request) bool {
	return r.Method == http.MethodPost && r.URL.Path == "/onboarding/bootstrap"
}

func isAdminBootstrapSuperAdminRequest(r *http.Request) bool {
	return r.Method == http.MethodPost && r.URL.Path == "/admin/bootstrap-super-admin"
}

func isOnboardingProjectModelsRequest(r *http.Request) bool {
	if r.Method != http.MethodPatch {
		return false
	}
	path := strings.Trim(r.URL.Path, "/")
	parts := strings.Split(path, "/")
	return len(parts) == 4 &&
		parts[0] == "onboarding" &&
		parts[1] == "projects" &&
		parts[2] != "" &&
		parts[3] == "models"
}

func isCanonicalProjectAnalysisRunRequest(r *http.Request) bool {
	if r.Method != http.MethodPost {
		return false
	}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	return len(parts) == 4 &&
		parts[0] == "analysis" &&
		parts[1] == "projects" &&
		parts[2] != "" &&
		parts[3] == "run"
}

func isProjectMembersRequest(r *http.Request) bool {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	return len(parts) >= 3 &&
		parts[0] == "projects" &&
		parts[1] != "" &&
		parts[2] == "members"
}

func isOrganizationDeleteRequest(r *http.Request) bool {
	if r.Method != http.MethodDelete {
		return false
	}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	return len(parts) == 2 && parts[0] == "organizations" && parts[1] != ""
}

func (h *Handler) buildRoutes() []routeEntry {
	authHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h.serveProxyWithInternalAuth(w, r, h.authProxy, "auth-service", internalTokenClaims{})
	})
	userHandler := h.withAuth(h.userProxy, "user-service", "users")
	billingStripeWebhookHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h.serveProxyWithInternalAuth(w, r, h.billingProxy, "billing-service", internalTokenClaims{})
	})
	billingPublicPlansHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h.serveProxyWithInternalAuth(w, r, h.billingProxy, "billing-service", internalTokenClaims{})
	})
	onboardingModelCatalogHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r2 := r.Clone(r.Context())
		urlCopy := *r.URL
		r2.URL = &urlCopy
		r2.URL.Path = "/ai-models"
		r2.URL.RawPath = ""
		h.serveProxyWithInternalAuth(w, r2, h.iaProxy, "ia-service", internalTokenClaims{})
	})
	onboardingProjectCreateHandler := h.withAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r2 := r.Clone(r.Context())
		urlCopy := *r.URL
		r2.URL = &urlCopy
		r2.URL.Path = "/projects"
		r2.URL.RawPath = ""
		h.projectProxy.ServeHTTP(w, r2)
	}), "project-service", "projects")
	onboardingProjectModelsHandler := h.withAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		projectID := parts[2]
		r2 := r.Clone(r.Context())
		r2.Header = r.Header.Clone()
		r2.Header.Set("X-Organization-Full-Access", "true")
		urlCopy := *r.URL
		r2.URL = &urlCopy
		r2.URL.Path = "/projects/" + projectID + "/models"
		r2.URL.RawPath = ""
		h.projectProxy.ServeHTTP(w, r2)
	}), "project-service", "projects")
	deleteOrganizationHandler := h.withAuth(http.HandlerFunc(h.handleDeleteOrganizationCascade), "api-gateway", "organizations")
	projectAnalysisRunHandler := h.withAuth(h.projectProxy, "project-service", "projects")

	routes := []routeEntry{
		{
			match: func(r *http.Request) bool { return isHealthRequest(r) },
			handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				h.health(w, r)
			}),
			service: "api-gateway",
		},
		{match: isPublicAPIRequest, handler: http.HandlerFunc(h.handlePublicAPI), service: "public-api"},
		{match: isAppEntryRequest, handler: http.HandlerFunc(h.handleAppEntry), service: "api-gateway"},
		{match: isAdminBootstrapSuperAdminStatusRequest, handler: http.HandlerFunc(h.handleAdminBootstrapSuperAdminStatus), service: "api-gateway"},
		{match: isAdminBootstrapSuperAdminRequest, handler: http.HandlerFunc(h.handleAdminBootstrapSuperAdmin), service: "api-gateway"},
		{match: isAdminUsersListRequest, handler: http.HandlerFunc(h.handleAdminUsers), service: "api-gateway"},
		{match: isAdminUserGrantSuperAdminRequest, handler: http.HandlerFunc(h.handleGrantAdminUserSuperAdmin), service: "api-gateway"},
		{match: isOnboardingBootstrapRequest, handler: http.HandlerFunc(h.handleOnboardingBootstrap), service: "api-gateway"},
		{match: isOnboardingModelCatalogRequest, handler: onboardingModelCatalogHandler, service: "ia-service"},
		{match: isOnboardingProjectCreateRequest, handler: onboardingProjectCreateHandler, service: "project-service"},
		{match: isOnboardingProjectModelsRequest, handler: onboardingProjectModelsHandler, service: "project-service"},
		{match: isCanonicalProjectAnalysisRunRequest, handler: projectAnalysisRunHandler, service: "project-service"},
		{match: isProjectMembersRequest, handler: h.withAuth(h.organizationsProxy, "organizations-service", "organizations"), service: "organizations-service"},
		{match: isOrganizationDeleteRequest, handler: deleteOrganizationHandler, service: "api-gateway"},
		{match: matchPathPrefix("/auth"), handler: authHandler, service: "auth-service"},
		{match: matchPathPrefix("/users"), handler: userHandler, service: "user-service"},
		{match: matchPathPrefix("/admin/users"), handler: userHandler, service: "user-service"},
		{match: matchPathPrefix("/organizations"), handler: h.withAuth(h.organizationsProxy, "organizations-service", "organizations"), service: "organizations-service"},
		{match: matchPathPrefix("/invitations"), handler: h.withAuth(h.organizationsProxy, "organizations-service", "organizations"), service: "organizations-service"},
		{match: matchPathPrefix("/permissions"), handler: h.withAuth(h.permissionProxy, "permission-service", "permissions"), service: "permission-service"},
		{match: isBillingStripeWebhookRequest, handler: billingStripeWebhookHandler, service: "billing-service"},
		{match: isBillingPublicPlansRequest, handler: billingPublicPlansHandler, service: "billing-service"},
		{match: matchPathPrefix("/billing"), handler: h.withAuth(h.billingProxy, "billing-service", "billing"), service: "billing-service"},
		{match: matchPathPrefix("/notifications"), handler: h.withAuth(h.notificationProxy, "notification-service", "notifications"), service: "notification-service"},
		{match: matchPathPrefix("/onboarding"), handler: h.withAuth(h.analysisProxy, "analysis-service", "analysis"), service: "analysis-service"},
		{match: matchPathPrefix("/projects"), handler: h.withAuth(h.projectProxy, "project-service", "projects"), service: "project-service"},
		{match: matchPathPrefix("/prompts"), handler: h.withAuth(h.projectProxy, "project-service", "projects"), service: "project-service"},
		{match: matchPathPrefix("/competitors"), handler: h.withAuth(h.projectProxy, "project-service", "projects"), service: "project-service"},
		{match: matchPathPrefix("/ai-models"), handler: h.withAuth(h.iaProxy, "ia-service", "ia"), service: "ia-service"},
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
