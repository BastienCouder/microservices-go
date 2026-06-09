package onboarding

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	internaljwt "github.com/bastiencouder/microservices-go/contracts/pkg/internaljwt"
)

var ErrValidation = errors.New("validation error")

type Request struct {
	OrganizationID    string       `json:"organizationId"`
	OrganizationName  string       `json:"organizationName"`
	BrandName         string       `json:"brandName"`
	WebsiteURL        string       `json:"websiteUrl"`
	AttributionSource string       `json:"attributionSource"`
	BrandDescription  string       `json:"brandDescription"`
	Industry          string       `json:"industry"`
	Competitors       []Competitor `json:"competitors"`
	Prompts           []Prompt     `json:"prompts"`
	ModelIDs          []string     `json:"modelIds"`
}

type Competitor struct {
	Name    string `json:"name"`
	Website string `json:"website"`
}

type Prompt struct {
	Text     string `json:"text"`
	Language string `json:"language"`
}

type Identity struct {
	IdentityID string
	UserID     int64
}

type Result struct {
	OrganizationID string   `json:"organizationId"`
	ProjectID      string   `json:"projectId"`
	ProjectSlug    string   `json:"projectSlug"`
	Warnings       []string `json:"warnings"`
}

type Service struct {
	httpClient        *http.Client
	organizationsURL  string
	projectURL        string
	internalJWTSecret string
	internalJWTIssuer string
}

type tokenClaims struct {
	IdentityID   string
	UserID       int64
	Organization int64
}

func NewService(httpClient *http.Client, organizationsURL, projectURL, internalJWTSecret, internalJWTIssuer string) *Service {
	return &Service{
		httpClient:        httpClient,
		organizationsURL:  strings.TrimRight(organizationsURL, "/"),
		projectURL:        strings.TrimRight(projectURL, "/"),
		internalJWTSecret: internalJWTSecret,
		internalJWTIssuer: internalJWTIssuer,
	}
}

func (s *Service) Bootstrap(ctx context.Context, actor Identity, req Request) (Result, error) {
	modelIDs := cleanStringList(req.ModelIDs)
	if len(modelIDs) == 0 {
		return Result{}, validationError("modelIds are required")
	}

	organizationID, err := s.bootstrapOrganization(ctx, actor, req)
	if err != nil {
		return Result{}, err
	}

	projectID, err := s.bootstrapProject(ctx, actor, organizationID, req)
	if err != nil {
		return Result{}, err
	}

	if err := s.replaceBootstrapProjectModels(ctx, actor, organizationID, projectID, modelIDs); err != nil {
		return Result{}, err
	}

	warnings := s.bootstrapProjectOptionalData(ctx, actor, organizationID, projectID, req)
	return Result{
		OrganizationID: strconv.FormatInt(organizationID, 10),
		ProjectID:      projectID,
		ProjectSlug:    projectID,
		Warnings:       warnings,
	}, nil
}

func (s *Service) bootstrapOrganization(ctx context.Context, actor Identity, req Request) (int64, error) {
	if organizationID, err := strconv.ParseInt(strings.TrimSpace(req.OrganizationID), 10, 64); err == nil && organizationID > 0 {
		return organizationID, nil
	}

	organizationName := strings.TrimSpace(req.OrganizationName)
	if organizationName == "" {
		return 0, validationError("organizationName is required")
	}

	payload, err := s.call(ctx, s.organizationsURL, "organizations-service", "/organizations", http.MethodPost, tokenClaims{
		IdentityID: actor.IdentityID,
		UserID:     actor.UserID,
	}, map[string]string{"name": organizationName}, false)
	if err != nil {
		return 0, fmt.Errorf("create organization: %w", err)
	}

	organizationPayload := unwrapData(payload)
	organizationID := extractID(organizationPayload, "id", "ID", "organizationId", "organization_id")
	if organizationID <= 0 {
		return 0, fmt.Errorf("create organization: missing organization id")
	}
	return organizationID, nil
}

func (s *Service) bootstrapProject(ctx context.Context, actor Identity, organizationID int64, req Request) (string, error) {
	brandName := strings.TrimSpace(req.BrandName)
	websiteURL := strings.TrimSpace(req.WebsiteURL)
	domain := deriveDomain(websiteURL)
	if brandName == "" || websiteURL == "" || domain == "" {
		return "", validationError("brandName, websiteUrl and domain are required")
	}

	payload, err := s.call(ctx, s.projectURL, "project-service", "/projects", http.MethodPost, tokenClaims{
		IdentityID:   actor.IdentityID,
		UserID:       actor.UserID,
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

	projectPayload := unwrapData(payload)
	projectID := extractString(projectPayload, "id", "ID")
	if projectID == "" {
		return "", fmt.Errorf("create project: missing project id")
	}
	return projectID, nil
}

func (s *Service) replaceBootstrapProjectModels(ctx context.Context, actor Identity, organizationID int64, projectID string, modelIDs []string) error {
	_, err := s.call(ctx, s.projectURL, "project-service", "/projects/"+url.PathEscape(projectID)+"/models", http.MethodPatch, tokenClaims{
		IdentityID:   actor.IdentityID,
		UserID:       actor.UserID,
		Organization: organizationID,
	}, map[string][]string{"modelIds": modelIDs}, true)
	if err != nil {
		return fmt.Errorf("apply selected models: %w", err)
	}
	return nil
}

func (s *Service) bootstrapProjectOptionalData(ctx context.Context, actor Identity, organizationID int64, projectID string, req Request) []string {
	type optionalStep struct {
		name    string
		path    string
		payload any
	}
	steps := make([]optionalStep, 0, 2)

	competitors := cleanCompetitors(req.Competitors)
	if len(competitors) > 0 {
		steps = append(steps, optionalStep{
			name:    "competitors",
			path:    "/projects/" + url.PathEscape(projectID) + "/competitors",
			payload: map[string]any{"competitors": competitors},
		})
	}

	prompts := cleanPrompts(req.Prompts)
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
			_, err := s.call(ctx, s.projectURL, "project-service", step.path, http.MethodPost, tokenClaims{
				IdentityID:   actor.IdentityID,
				UserID:       actor.UserID,
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

func (s *Service) call(ctx context.Context, baseURL, audience, path, method string, claims tokenClaims, body any, fullAccess bool) (map[string]any, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("encode request: %w", err)
	}
	token, err := internaljwt.SignHS256(
		s.internalJWTSecret,
		s.internalJWTIssuer,
		audience,
		"api-gateway",
		internaljwt.TokenClaims{
			IdentityID:     claims.IdentityID,
			UserID:         claims.UserID,
			OrganizationID: claims.Organization,
		},
		60*time.Second,
	)
	if err != nil {
		return nil, fmt.Errorf("sign internal jwt: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(baseURL, "/")+path, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Content-Type", "application/json")
	if fullAccess {
		request.Header.Set("X-Organization-Full-Access", "true")
	}

	resp, err := s.httpClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}
	if resp.StatusCode >= http.StatusBadRequest {
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

func unwrapData(value map[string]any) map[string]any {
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

func cleanCompetitors(values []Competitor) []map[string]string {
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
			"domain":     deriveDomain(website),
		})
	}
	return out
}

func cleanPrompts(values []Prompt) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		text := strings.TrimSpace(value.Text)
		if text != "" {
			out = append(out, text)
		}
	}
	return out
}

func deriveDomain(value string) string {
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

func validationError(message string) error {
	return fmt.Errorf("%w: %s", ErrValidation, message)
}
