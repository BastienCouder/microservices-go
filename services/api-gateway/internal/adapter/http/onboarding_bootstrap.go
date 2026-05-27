package http

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
)

type onboardingBootstrapRequest struct {
	OrganizationID    string                          `json:"organizationId"`
	OrganizationName  string                          `json:"organizationName"`
	BrandName         string                          `json:"brandName"`
	WebsiteURL        string                          `json:"websiteUrl"`
	AttributionSource string                          `json:"attributionSource"`
	BrandDescription  string                          `json:"brandDescription"`
	Industry          string                          `json:"industry"`
	Competitors       []onboardingBootstrapCompetitor `json:"competitors"`
	Prompts           []onboardingBootstrapPrompt     `json:"prompts"`
	ModelIDs          []string                        `json:"modelIds"`
}

type onboardingBootstrapCompetitor struct {
	Name    string `json:"name"`
	Website string `json:"website"`
}

type onboardingBootstrapPrompt struct {
	Text     string `json:"text"`
	Language string `json:"language"`
}

type onboardingBootstrapResult struct {
	OrganizationID string   `json:"organizationId"`
	ProjectID      string   `json:"projectId"`
	ProjectSlug    string   `json:"projectSlug"`
	Warnings       []string `json:"warnings"`
}

func (h *Handler) handleOnboardingBootstrap(w http.ResponseWriter, r *http.Request) {
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

	var req onboardingBootstrapRequest
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid json payload")
		return
	}

	modelIDs := cleanStringList(req.ModelIDs)
	if len(modelIDs) == 0 {
		writeJSONError(w, http.StatusBadRequest, "modelIds are required")
		return
	}

	organizationID, err := h.bootstrapOrganization(r.Context(), identityID, userID, req)
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, err.Error())
		return
	}

	projectID, err := h.bootstrapProject(r.Context(), identityID, userID, organizationID, req)
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, err.Error())
		return
	}

	if err := h.replaceBootstrapProjectModels(r.Context(), identityID, userID, organizationID, projectID, modelIDs); err != nil {
		writeJSONError(w, http.StatusBadGateway, err.Error())
		return
	}

	warnings := h.bootstrapProjectOptionalData(r.Context(), identityID, userID, organizationID, projectID, req)
	writeJSON(w, http.StatusCreated, onboardingBootstrapResult{
		OrganizationID: strconv.FormatInt(organizationID, 10),
		ProjectID:      projectID,
		ProjectSlug:    projectID,
		Warnings:       warnings,
	})
}

func (h *Handler) bootstrapOrganization(ctx context.Context, identityID string, userID int64, req onboardingBootstrapRequest) (int64, error) {
	if organizationID, err := strconv.ParseInt(strings.TrimSpace(req.OrganizationID), 10, 64); err == nil && organizationID > 0 {
		return organizationID, nil
	}

	organizationName := strings.TrimSpace(req.OrganizationName)
	if organizationName == "" {
		return 0, fmt.Errorf("organizationName is required")
	}

	payload, err := h.callOnboardingService(ctx, h.organizationsURL, "organizations-service", "/organizations", http.MethodPost, internalTokenClaims{
		IdentityID: identityID,
		UserID:     userID,
	}, map[string]string{"name": organizationName}, false)
	if err != nil {
		return 0, fmt.Errorf("create organization: %w", err)
	}

	organizationID := extractID(payload, "id", "ID", "organizationId", "organization_id")
	if organizationID <= 0 {
		return 0, fmt.Errorf("create organization: missing organization id")
	}
	return organizationID, nil
}

func (h *Handler) bootstrapProject(ctx context.Context, identityID string, userID int64, organizationID int64, req onboardingBootstrapRequest) (string, error) {
	brandName := strings.TrimSpace(req.BrandName)
	websiteURL := strings.TrimSpace(req.WebsiteURL)
	domain := deriveBootstrapDomain(websiteURL)
	if brandName == "" || websiteURL == "" || domain == "" {
		return "", fmt.Errorf("brandName, websiteUrl and domain are required")
	}

	payload, err := h.callOnboardingService(ctx, h.projectURL, "project-service", "/projects", http.MethodPost, internalTokenClaims{
		IdentityID:   identityID,
		UserID:       userID,
		Organization: organizationID,
	}, map[string]any{
		"name":              brandName,
		"websiteUrl":        websiteURL,
		"domain":            domain,
		"brandName":         brandName,
		"brandDescription":  strings.TrimSpace(req.BrandDescription),
		"industry":          strings.TrimSpace(req.Industry),
		"attributionSource": strings.TrimSpace(req.AttributionSource),
	}, false)
	if err != nil {
		return "", fmt.Errorf("create project: %w", err)
	}

	projectPayload := unwrapBootstrapData(payload)
	projectID := extractString(projectPayload, "id", "ID")
	if projectID == "" {
		return "", fmt.Errorf("create project: missing project id")
	}
	return projectID, nil
}

func (h *Handler) replaceBootstrapProjectModels(ctx context.Context, identityID string, userID int64, organizationID int64, projectID string, modelIDs []string) error {
	_, err := h.callOnboardingService(ctx, h.projectURL, "project-service", "/projects/"+url.PathEscape(projectID)+"/models", http.MethodPatch, internalTokenClaims{
		IdentityID:   identityID,
		UserID:       userID,
		Organization: organizationID,
	}, map[string][]string{"modelIds": modelIDs}, true)
	if err != nil {
		return fmt.Errorf("apply selected models: %w", err)
	}
	return nil
}

func (h *Handler) bootstrapProjectOptionalData(ctx context.Context, identityID string, userID int64, organizationID int64, projectID string, req onboardingBootstrapRequest) []string {
	type optionalStep struct {
		name    string
		path    string
		payload any
	}
	steps := make([]optionalStep, 0, 2)

	competitors := cleanBootstrapCompetitors(req.Competitors)
	if len(competitors) > 0 {
		steps = append(steps, optionalStep{
			name:    "competitors",
			path:    "/projects/" + url.PathEscape(projectID) + "/competitors",
			payload: map[string]any{"competitors": competitors},
		})
	}

	prompts := cleanBootstrapPrompts(req.Prompts)
	if len(prompts) > 0 {
		steps = append(steps, optionalStep{
			name:    "prompts",
			path:    "/projects/" + url.PathEscape(projectID) + "/prompts",
			payload: map[string]any{"prompts": prompts},
		})
	}

	if len(steps) == 0 {
		return nil
	}

	var wg sync.WaitGroup
	warnings := make(chan string, len(steps))
	for _, step := range steps {
		step := step
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := h.callOnboardingService(ctx, h.projectURL, "project-service", step.path, http.MethodPost, internalTokenClaims{
				IdentityID:   identityID,
				UserID:       userID,
				Organization: organizationID,
			}, step.payload, true)
			if err != nil {
				warnings <- "Impossible d'ajouter " + step.name + "."
			}
		}()
	}
	wg.Wait()
	close(warnings)

	out := make([]string, 0, len(warnings))
	for warning := range warnings {
		out = append(out, warning)
	}
	return out
}

func (h *Handler) callOnboardingService(ctx context.Context, baseURL, audience, path, method string, claims internalTokenClaims, body any, fullAccess bool) (map[string]any, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("encode request: %w", err)
	}
	token, err := signInternalJWT(h.internalJWTSecret, h.internalJWTIssuer, audience, claims)
	if err != nil {
		return nil, fmt.Errorf("sign internal jwt: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(baseURL, "/")+path, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	if fullAccess {
		req.Header.Set("X-Organization-Full-Access", "true")
	}

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("status %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}
	if len(raw) == 0 {
		return map[string]any{}, nil
	}

	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return decoded, nil
}

func unwrapBootstrapData(value map[string]any) map[string]any {
	if value == nil {
		return map[string]any{}
	}
	if success, _ := value["success"].(bool); success {
		if data, ok := value["data"].(map[string]any); ok {
			return data
		}
	}
	return value
}

func extractID(value map[string]any, keys ...string) int64 {
	for _, key := range keys {
		switch typed := value[key].(type) {
		case float64:
			if typed > 0 {
				return int64(typed)
			}
		case string:
			id, err := strconv.ParseInt(strings.TrimSpace(typed), 10, 64)
			if err == nil && id > 0 {
				return id
			}
		}
	}
	return 0
}

func extractString(value map[string]any, keys ...string) string {
	for _, key := range keys {
		switch typed := value[key].(type) {
		case string:
			if strings.TrimSpace(typed) != "" {
				return strings.TrimSpace(typed)
			}
		case float64:
			if typed > 0 {
				return strconv.FormatInt(int64(typed), 10)
			}
		}
	}
	return ""
}

func cleanStringList(values []string) []string {
	out := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

func cleanBootstrapCompetitors(values []onboardingBootstrapCompetitor) []map[string]string {
	out := make([]map[string]string, 0, len(values))
	for _, value := range values {
		name := strings.TrimSpace(value.Name)
		website := strings.TrimSpace(value.Website)
		if name == "" {
			continue
		}
		out = append(out, map[string]string{
			"name":       name,
			"websiteUrl": website,
			"domain":     deriveBootstrapDomain(website),
		})
	}
	return out
}

func cleanBootstrapPrompts(values []onboardingBootstrapPrompt) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		text := strings.TrimSpace(value.Text)
		if text != "" {
			out = append(out, text)
		}
	}
	return out
}

func deriveBootstrapDomain(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	normalized := trimmed
	if !strings.HasPrefix(strings.ToLower(normalized), "http://") && !strings.HasPrefix(strings.ToLower(normalized), "https://") {
		normalized = "https://" + normalized
	}
	parsed, err := url.Parse(normalized)
	if err != nil || parsed.Hostname() == "" {
		return ""
	}
	return strings.TrimPrefix(strings.ToLower(parsed.Hostname()), "www.")
}
