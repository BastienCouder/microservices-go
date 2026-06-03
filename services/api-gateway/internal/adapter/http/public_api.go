package http

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
)

type PublicAPIConfig struct {
	Enabled       bool
	RateLimitRPM  int
	Burst         int
	AllowedPlans  []string
	APIKeyHeader  string
	APIKeyPrefix  string
	DefaultScopes []string
}

func DefaultPublicAPIConfig() PublicAPIConfig {
	return PublicAPIConfig{
		Enabled:      true,
		AllowedPlans: []string{"developer", "growth", "pro", "agency-enterprise"},
		APIKeyHeader: "Authorization",
		APIKeyPrefix: "org_",
	}
}

func (cfg PublicAPIConfig) withDefaults() PublicAPIConfig {
	if cfg.APIKeyHeader == "" {
		cfg.APIKeyHeader = "Authorization"
	}
	if cfg.APIKeyPrefix == "" {
		cfg.APIKeyPrefix = "org_"
	}
	if len(cfg.AllowedPlans) == 0 {
		cfg.AllowedPlans = DefaultPublicAPIConfig().AllowedPlans
	}
	return cfg
}

type publicAPIKey struct {
	ID             int64  `json:"id"`
	OrganizationID int64  `json:"organizationId"`
	Name           string `json:"name"`
	Prefix         string `json:"prefix"`
}

type publicEntitlements struct {
	OrganizationID     int64  `json:"organization_id"`
	Plan               string `json:"plan"`
	SubscriptionStatus string `json:"subscription_status"`
	IsPaid             bool   `json:"is_paid"`
}

type publicRouteTarget struct {
	handler http.Handler
	service string
	path    string
	query   string
	claims  internalTokenClaims
	direct  func(http.ResponseWriter, *http.Request, publicAPIKey, publicEntitlements)
}

func isPublicAPIRequest(r *http.Request) bool {
	return r.URL.Path == "/v1" || strings.HasPrefix(r.URL.Path, "/v1/")
}

func (h *Handler) handlePublicAPI(w http.ResponseWriter, r *http.Request) {
	if !h.publicAPI.Enabled {
		http.NotFound(w, r)
		return
	}

	apiKeyValue, ok := h.publicAPIKeyFromRequest(r)
	if !ok {
		writeJSONError(w, http.StatusUnauthorized, "missing api key")
		return
	}

	apiKey, err := h.validatePublicAPIKey(r.Context(), apiKeyValue)
	if err != nil {
		if errors.Is(err, errUnauthorized) {
			writeJSONError(w, http.StatusUnauthorized, "invalid api key")
			return
		}
		writeJSONError(w, http.StatusServiceUnavailable, "organization dependency unavailable")
		return
	}

	entitlements, err := h.loadPublicEntitlements(r.Context(), apiKey.OrganizationID)
	if err != nil {
		writeJSONError(w, http.StatusServiceUnavailable, "billing dependency unavailable")
		return
	}
	if !h.publicAPIPlanAllowed(entitlements.Plan, entitlements.SubscriptionStatus, entitlements.IsPaid) {
		writeJSONError(w, http.StatusForbidden, "public api is not available for this plan")
		return
	}

	target, ok := h.publicRouteTarget(r, apiKey, entitlements)
	if !ok {
		http.NotFound(w, r)
		return
	}
	if target.direct != nil {
		target.direct(w, r, apiKey, entitlements)
		return
	}

	r2 := r.Clone(r.Context())
	r2.Header = r.Header.Clone()
	r2.Header.Set("X-Organization-ID", strconv.FormatInt(apiKey.OrganizationID, 10))
	r2.Header.Set("X-Public-API-Key-ID", strconv.FormatInt(apiKey.ID, 10))
	r2.Header.Set("X-Public-API-Key-Name", apiKey.Name)
	urlCopy := *r.URL
	r2.URL = &urlCopy
	r2.URL.Path = target.path
	r2.URL.RawPath = ""
	r2.URL.RawQuery = target.query
	h.serveProxyWithInternalAuth(w, r2, target.handler, target.service, target.claims)
}

func (h *Handler) publicAPIKeyFromRequest(r *http.Request) (string, bool) {
	header := h.publicAPI.APIKeyHeader
	value := strings.TrimSpace(r.Header.Get(header))
	if header == "Authorization" {
		if !strings.HasPrefix(value, "Bearer ") {
			return "", false
		}
		value = strings.TrimSpace(strings.TrimPrefix(value, "Bearer "))
	}
	return value, value != ""
}

func (h *Handler) validatePublicAPIKey(ctx context.Context, rawKey string) (publicAPIKey, error) {
	var key publicAPIKey
	token, err := signInternalJWT(h.internalJWTSecret, h.internalJWTIssuer, "organizations-service", internalTokenClaims{})
	if err != nil {
		return key, fmt.Errorf("sign internal jwt: %w", err)
	}
	body, err := json.Marshal(map[string]string{"api_key": rawKey})
	if err != nil {
		return key, err
	}

	err = h.executeDependencyCall(ctx, h.organizationBreaker, h.organizationBulkhead, 2, 40*time.Millisecond, 700*time.Millisecond, func(attemptCtx context.Context) (bool, bool, error) {
		req, err := http.NewRequestWithContext(attemptCtx, http.MethodPost, h.organizationsURL+"/internal/api-keys/validate", bytes.NewReader(body))
		if err != nil {
			return false, true, err
		}
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		resp, err := h.httpClient.Do(req)
		if err != nil {
			return isTransientNetError(err), true, err
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusNotFound {
			return false, false, errUnauthorized
		}
		if resp.StatusCode != http.StatusOK {
			return isTransientHTTPStatus(resp.StatusCode), true, fmt.Errorf("api key validation status=%d", resp.StatusCode)
		}
		if err := httpjson.DecodeSuccessData(resp.Body, &key); err != nil {
			return false, true, err
		}
		if key.ID <= 0 || key.OrganizationID <= 0 {
			return false, true, errors.New("invalid api key validation response")
		}
		return false, true, nil
	})
	return key, err
}

func (h *Handler) loadPublicEntitlements(ctx context.Context, organizationID int64) (publicEntitlements, error) {
	var entitlements publicEntitlements
	token, err := signInternalJWT(h.internalJWTSecret, h.internalJWTIssuer, "billing-service", internalTokenClaims{Organization: organizationID})
	if err != nil {
		return entitlements, fmt.Errorf("sign internal jwt: %w", err)
	}
	err = h.executeDependencyCall(ctx, h.organizationBreaker, h.organizationBulkhead, 2, 40*time.Millisecond, 700*time.Millisecond, func(attemptCtx context.Context) (bool, bool, error) {
		req, err := http.NewRequestWithContext(attemptCtx, http.MethodGet, h.billingURL+"/billing/quotas/"+strconv.FormatInt(organizationID, 10), nil)
		if err != nil {
			return false, true, err
		}
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("X-Organization-ID", strconv.FormatInt(organizationID, 10))

		resp, err := h.httpClient.Do(req)
		if err != nil {
			return isTransientNetError(err), true, err
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return isTransientHTTPStatus(resp.StatusCode), true, fmt.Errorf("billing entitlements status=%d", resp.StatusCode)
		}
		if err := httpjson.DecodeSuccessData(resp.Body, &entitlements); err != nil {
			return false, true, err
		}
		if entitlements.OrganizationID == 0 {
			entitlements.OrganizationID = organizationID
		}
		return false, true, nil
	})
	return entitlements, err
}

func (h *Handler) publicAPIPlanAllowed(plan, status string, paid bool) bool {
	normalizedPlan := strings.ToLower(strings.TrimSpace(plan))
	allowed := false
	for _, candidate := range h.publicAPI.AllowedPlans {
		if strings.ToLower(strings.TrimSpace(candidate)) == normalizedPlan {
			allowed = true
			break
		}
	}
	if !allowed {
		return false
	}
	normalizedStatus := strings.ToLower(strings.TrimSpace(status))
	return paid || normalizedStatus == "active" || normalizedStatus == "trialing"
}

func (h *Handler) publicRouteTarget(r *http.Request, apiKey publicAPIKey, entitlements publicEntitlements) (publicRouteTarget, bool) {
	path := strings.TrimPrefix(r.URL.Path, "/v1")
	if path == "" {
		path = "/"
	}
	claims := internalTokenClaims{Organization: apiKey.OrganizationID}
	switch {
	case path == "/me" && r.Method == http.MethodGet:
		return publicRouteTarget{direct: h.writePublicMe}, true
	case path == "/usage" && r.Method == http.MethodGet:
		return publicRouteTarget{direct: h.writePublicUsage}, true
	case path == "/billing/entitlements" && r.Method == http.MethodGet:
		return publicRouteTarget{direct: h.writePublicEntitlements}, true
	case path == "/api-keys" || strings.HasPrefix(path, "/api-keys/"):
		targetPath := "/organizations/" + strconv.FormatInt(apiKey.OrganizationID, 10) + "/api-keys" + strings.TrimPrefix(path, "/api-keys")
		return publicRouteTarget{handler: h.organizationsProxy, service: "organizations-service", path: targetPath, claims: claims}, true
	case path == "/projects" || strings.HasPrefix(path, "/projects/"):
		if target, ok := h.publicProjectSubroute(r, path, claims); ok {
			return target, true
		}
		return publicRouteTarget{handler: h.projectProxy, service: "project-service", path: path, query: r.URL.RawQuery, claims: claims}, true
	case path == "/prompts" || strings.HasPrefix(path, "/prompts/"):
		return publicRouteTarget{handler: h.projectProxy, service: "project-service", path: path, query: r.URL.RawQuery, claims: claims}, true
	case path == "/competitors" || strings.HasPrefix(path, "/competitors/"):
		return publicRouteTarget{handler: h.projectProxy, service: "project-service", path: path, query: r.URL.RawQuery, claims: claims}, true
	case path == "/analysis/runs" || strings.HasPrefix(path, "/analysis/runs/"):
		return publicRouteTarget{handler: h.analysisProxy, service: "analysis-service", path: path, query: r.URL.RawQuery, claims: claims}, true
	case path == "/agent-ready/scans" || strings.HasPrefix(path, "/agent-ready/scans/"):
		return publicRouteTarget{handler: h.analysisProxy, service: "analysis-service", path: "/analysis" + path, query: r.URL.RawQuery, claims: claims}, true
	default:
		return publicRouteTarget{}, false
	}
}

func (h *Handler) publicProjectSubroute(r *http.Request, path string, claims internalTokenClaims) (publicRouteTarget, bool) {
	parts := splitPublicPath(path)
	if len(parts) < 2 || parts[0] != "projects" {
		return publicRouteTarget{}, false
	}
	projectID := parts[1]
	if len(parts) == 4 && parts[2] == "analysis" && parts[3] == "runs" {
		if r.Method == http.MethodPost {
			return publicRouteTarget{handler: h.projectProxy, service: "project-service", path: "/analysis/projects/" + url.PathEscape(projectID) + "/run", query: r.URL.RawQuery, claims: claims}, true
		}
		if r.Method == http.MethodGet {
			return publicRouteTarget{handler: h.analysisProxy, service: "analysis-service", path: "/analysis/projects/" + url.PathEscape(projectID) + "/runs", query: r.URL.RawQuery, claims: claims}, true
		}
	}
	if len(parts) == 4 && parts[2] == "analysis" && parts[3] == "quota" && r.Method == http.MethodGet {
		return publicRouteTarget{handler: h.analysisProxy, service: "analysis-service", path: "/analysis/projects/" + url.PathEscape(projectID) + "/quota", query: r.URL.RawQuery, claims: claims}, true
	}
	if len(parts) == 4 && parts[2] == "analytics" && parts[3] == "summary" && r.Method == http.MethodGet {
		return publicRouteTarget{handler: h.analysisProxy, service: "analysis-service", path: "/analysis/projects/" + url.PathEscape(projectID) + "/dashboard", query: r.URL.RawQuery, claims: claims}, true
	}
	if len(parts) == 3 && parts[2] == "perception" && r.Method == http.MethodGet {
		return publicRouteTarget{handler: h.analysisProxy, service: "analysis-service", path: "/analysis/projects/" + url.PathEscape(projectID) + "/perception", query: r.URL.RawQuery, claims: claims}, true
	}
	if len(parts) == 4 && parts[2] == "perception" && parts[3] == "runs" && r.Method == http.MethodPost {
		return publicRouteTarget{handler: h.projectProxy, service: "project-service", path: "/projects/" + url.PathEscape(projectID) + "/analysis/perception/run", query: r.URL.RawQuery, claims: claims}, true
	}
	if len(parts) >= 3 && parts[2] == "brand-canon" {
		return publicRouteTarget{handler: h.analysisProxy, service: "analysis-service", path: "/analysis/projects/" + url.PathEscape(projectID) + "/brand-canon", query: r.URL.RawQuery, claims: claims}, true
	}
	if len(parts) >= 3 && parts[2] == "optimization-errors" {
		return publicRouteTarget{handler: h.analysisProxy, service: "analysis-service", path: "/analysis/projects/" + url.PathEscape(projectID) + "/optimization-errors", query: r.URL.RawQuery, claims: claims}, true
	}
	if len(parts) >= 3 && parts[2] == "optimize-actions" {
		return publicRouteTarget{handler: h.analysisProxy, service: "analysis-service", path: "/analysis/projects/" + url.PathEscape(projectID) + "/" + strings.Join(parts[2:], "/"), query: r.URL.RawQuery, claims: claims}, true
	}
	if len(parts) >= 3 && parts[2] == "events" {
		return publicRouteTarget{handler: h.attributionProxy, service: "attribution-service", path: "/attribution/projects/" + url.PathEscape(projectID) + "/events", query: r.URL.RawQuery, claims: claims}, true
	}
	if len(parts) == 3 && (parts[2] == "funnel" || parts[2] == "traffic") {
		return publicRouteTarget{handler: h.attributionProxy, service: "attribution-service", path: "/attribution/projects/" + url.PathEscape(projectID) + "/" + parts[2], query: r.URL.RawQuery, claims: claims}, true
	}
	if len(parts) == 3 && parts[2] == "ingest" && r.Method == http.MethodPost {
		return publicRouteTarget{handler: h.attributionProxy, service: "attribution-service", path: "/attribution/ingest/" + url.PathEscape(projectID), query: r.URL.RawQuery, claims: claims}, true
	}
	if len(parts) >= 4 && parts[2] == "content" && parts[3] == "crawls" {
		suffix := "crawl"
		if len(parts) == 5 && parts[4] == "latest" {
			suffix = "crawl"
		} else if len(parts) == 5 {
			suffix = "crawl/" + parts[4]
		}
		return publicRouteTarget{handler: h.analysisProxy, service: "analysis-service", path: "/analysis/projects/" + url.PathEscape(projectID) + "/content-optimizer/" + suffix, query: r.URL.RawQuery, claims: claims}, true
	}
	if len(parts) == 4 && parts[2] == "content" && parts[3] == "analyze" {
		return publicRouteTarget{handler: h.analysisProxy, service: "analysis-service", path: "/analysis/projects/" + url.PathEscape(projectID) + "/content-optimizer/analyze", query: r.URL.RawQuery, claims: claims}, true
	}
	return publicRouteTarget{}, false
}

func splitPublicPath(path string) []string {
	trimmed := strings.Trim(path, "/")
	if trimmed == "" {
		return nil
	}
	return strings.Split(trimmed, "/")
}

func (h *Handler) writePublicMe(w http.ResponseWriter, _ *http.Request, apiKey publicAPIKey, entitlements publicEntitlements) {
	writeJSON(w, http.StatusOK, map[string]any{
		"organization_id": apiKey.OrganizationID,
		"api_key": map[string]any{
			"id":     apiKey.ID,
			"name":   apiKey.Name,
			"prefix": apiKey.Prefix,
		},
		"entitlements": entitlements,
	})
}

func (h *Handler) writePublicUsage(w http.ResponseWriter, _ *http.Request, _ publicAPIKey, entitlements publicEntitlements) {
	writeJSON(w, http.StatusOK, entitlements)
}

func (h *Handler) writePublicEntitlements(w http.ResponseWriter, _ *http.Request, _ publicAPIKey, entitlements publicEntitlements) {
	writeJSON(w, http.StatusOK, entitlements)
}
