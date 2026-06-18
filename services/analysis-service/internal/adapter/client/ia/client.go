package ia

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/bastiencouder/microservices-go/contracts/pkg/internalauth"
	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/usecase"
)

type Config struct {
	BaseURL                       string
	JWTSecret                     string
	JWTIssuer                     string
	ModelID                       string
	ProviderID                    string
	OptimizeActionBriefModelID    string
	OptimizeActionBriefProviderID string
	HTTPClient                    *http.Client
}

type Client struct {
	baseURL                       string
	jwtSecret                     string
	jwtIssuer                     string
	modelID                       string
	providerID                    string
	optimizeActionBriefModelID    string
	optimizeActionBriefProviderID string
	http                          *http.Client
}

func NewClient(cfg Config) (*Client, error) {
	baseURL := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	if baseURL == "" {
		return nil, fmt.Errorf("ia service base url is required")
	}
	if strings.TrimSpace(cfg.JWTSecret) == "" {
		return nil, fmt.Errorf("internal jwt secret is required")
	}
	if strings.TrimSpace(cfg.JWTIssuer) == "" {
		return nil, fmt.Errorf("internal jwt issuer is required")
	}
	if strings.TrimSpace(cfg.ModelID) == "" {
		return nil, fmt.Errorf("content issue analyzer model id is required")
	}

	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{}
	}

	providerID := strings.TrimSpace(cfg.ProviderID)
	if providerID == "" {
		providerID = "openrouter"
	}
	optimizeActionBriefProviderID := strings.TrimSpace(cfg.OptimizeActionBriefProviderID)
	if optimizeActionBriefProviderID == "" {
		optimizeActionBriefProviderID = "openrouter"
	}
	optimizeActionBriefModelID := strings.TrimSpace(cfg.OptimizeActionBriefModelID)
	if optimizeActionBriefModelID == "" {
		optimizeActionBriefModelID = "z-ai/glm-4.5-air:free"
	}

	return &Client{
		baseURL:                       baseURL,
		jwtSecret:                     strings.TrimSpace(cfg.JWTSecret),
		jwtIssuer:                     strings.TrimSpace(cfg.JWTIssuer),
		modelID:                       strings.TrimSpace(cfg.ModelID),
		providerID:                    providerID,
		optimizeActionBriefModelID:    optimizeActionBriefModelID,
		optimizeActionBriefProviderID: optimizeActionBriefProviderID,
		http:                          httpClient,
	}, nil
}

func (c *Client) GenerateOptimizeActionBrief(
	ctx context.Context,
	input usecase.OptimizeActionBriefInput,
) (string, error) {
	modelID := strings.TrimSpace(input.ModelID)
	if modelID == "" {
		modelID = c.optimizeActionBriefModelID
	}
	providerID := strings.TrimSpace(input.ProviderID)
	if providerID == "" {
		providerID = c.optimizeActionBriefProviderID
	}
	body := executePromptRequest{
		PromptID:   "content-optimizer-action-brief",
		PromptText: buildOptimizeActionBriefPrompt(input),
		ModelID:    modelID,
		ProviderID: providerID,
	}

	rawResponse, err := c.executeStructuredPrompt(ctx, body, input.OrganizationID)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(rawResponse), nil
}

func (c *Client) AnalyzeContentIssues(ctx context.Context, input usecase.ContentIssueAnalysisInput) ([]usecase.ContentOptimizerIssue, error) {
	prompt := buildContentIssuePrompt(input)
	body := executePromptRequest{
		PromptID:   "content-optimizer-page-audit",
		PromptText: prompt,
		ModelID:    c.modelID,
		ProviderID: c.providerID,
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("encode ia request: %w", err)
	}

	token, err := internalauth.SignInternalJWT(c.jwtSecret, c.jwtIssuer, "ia-service", "analysis-service", internalauth.Claims{
		Organization: input.OrganizationID,
	})
	if err != nil {
		return nil, fmt.Errorf("sign internal jwt: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/ai/execute", bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("create ia request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call ia service: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, fmt.Errorf("read ia response: %w", err)
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("ia service returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	var envelope executePromptEnvelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, fmt.Errorf("decode ia response: %w", err)
	}
	if !envelope.Success {
		return nil, fmt.Errorf("ia service returned unsuccessful response")
	}

	issues, err := parseContentIssueResponse(envelope.Data.RawResponse, input.Record.URL)
	if err != nil {
		return nil, err
	}
	return issues, nil
}

func (c *Client) AnalyzeOnboardingBrandProfile(
	ctx context.Context,
	input usecase.OnboardingBrandProfileAnalysisInput,
) (usecase.OnboardingBrandProfilePreview, error) {
	body := executePromptRequest{
		PromptID:   "onboarding-brand-profile",
		PromptText: buildOnboardingBrandProfilePrompt(input),
		ModelID:    c.modelID,
		ProviderID: c.providerID,
	}

	rawResponse, err := c.executeStructuredPrompt(ctx, body, 0)
	if err != nil {
		return usecase.OnboardingBrandProfilePreview{}, err
	}

	preview, err := parseOnboardingBrandProfileResponse(rawResponse)
	if err != nil {
		return usecase.OnboardingBrandProfilePreview{}, err
	}
	preview.Status = input.Fallback.Status
	preview.CrawlJobID = input.Fallback.CrawlJobID
	return preview, nil
}

type executePromptRequest struct {
	PromptID   string `json:"promptId"`
	PromptText string `json:"promptText"`
	ModelID    string `json:"modelId"`
	ProviderID string `json:"providerId"`
}

type executePromptEnvelope struct {
	Success bool `json:"success"`
	Data    struct {
		RawResponse string `json:"rawResponse"`
	} `json:"data"`
}

func (c *Client) executeStructuredPrompt(ctx context.Context, body executePromptRequest, organizationID int64) (string, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("encode ia request: %w", err)
	}

	token, err := internalauth.SignInternalJWT(c.jwtSecret, c.jwtIssuer, "ia-service", "analysis-service", internalauth.Claims{
		Organization: organizationID,
	})
	if err != nil {
		return "", fmt.Errorf("sign internal jwt: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/ai/execute", bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("create ia request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("call ia service: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return "", fmt.Errorf("read ia response: %w", err)
	}
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("ia service returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	var envelope executePromptEnvelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return "", fmt.Errorf("decode ia response: %w", err)
	}
	if !envelope.Success {
		return "", fmt.Errorf("ia service returned unsuccessful response")
	}
	return envelope.Data.RawResponse, nil
}

type contentIssueResponse struct {
	Issues []usecase.ContentOptimizerIssue `json:"issues"`
}

func buildContentIssuePrompt(input usecase.ContentIssueAnalysisInput) string {
	record := input.Record
	markdown := trimForPrompt(record.Markdown, 6000)
	if markdown == "" {
		markdown = trimForPrompt(record.HTML, 6000)
	}

	deterministicIssues := make([]map[string]string, 0, len(input.DeterministicIssues))
	for _, issue := range input.DeterministicIssues {
		deterministicIssues = append(deterministicIssues, map[string]string{
			"category": issue.Category,
			"severity": issue.Severity,
			"title":    issue.Title,
			"fixType":  issue.FixType,
		})
	}
	deterministicJSON, _ := json.Marshal(deterministicIssues)

	return strings.TrimSpace(fmt.Sprintf(`Tu es un auditeur SEO et GEO senior.
Analyse la page crawlee et retourne uniquement du JSON valide, sans markdown.

Objectif:
- creer 0 a 5 erreurs editoriales SEO/GEO vraiment actionnables;
- ne repete pas les erreurs techniques deja detectees;
- privilegie les problemes d'intention, de citabilite IA, de preuves, d'entites, de comparaison, de structure editoriale et de clarte;
- chaque recommendation doit etre concrete et applicable sur cette page.

Schema exact:
{"issues":[{"category":"seo|geo","severity":"high|medium|low","title":"...","description":"...","recommendation":"...","fixType":"ai_snake_case"}]}

Contexte:
projectId: %s
url: %s
httpStatus: %d
title: %s
deterministicIssues: %s

Contenu extrait:
%s`, input.ProjectID, record.URL, record.HTTPStatus, record.Title, string(deterministicJSON), markdown))
}

func buildOptimizeActionBriefPrompt(input usecase.OptimizeActionBriefInput) string {
	metadataJSON, _ := json.Marshal(input.Metadata)
	modelsJSON, _ := json.Marshal(input.DetectedInModels)

	return strings.TrimSpace(fmt.Sprintf(`Tu es un strategist GEO senior.
Genere un brief d'optimisation de contenu actionnable pour corriger une erreur detectee dans un produit de monitoring IA.

Contraintes:
- reponds en francais;
- ne retourne pas de JSON;
- structure le brief avec des titres courts;
- donne des recommandations concretes et directement applicables;
- inclue des blocs prets a copier quand c'est utile;
- evite les generalites.

Format attendu:
Objectif
...

Diagnostic
...

Plan de contenu
- ...
- ...

Blocs prets a appliquer
- Titre: ...
- FAQ: ...
- Paragraphe: ...

Preuves a ajouter
- ...

Contexte:
projectId: %s
source: %s
sourceErrorId: %s
priorite: %s
type: %s
titre: %s
probleme: %s
impact: %s
modelesImpactes: %s
metadata: %s

Suggestion initiale ou contexte existant:
%s`,
		input.ProjectID,
		input.Source,
		input.SourceErrorID,
		input.Priority,
		input.Type,
		input.Title,
		input.Issue,
		input.Impact,
		string(modelsJSON),
		string(metadataJSON),
		trimForPrompt(input.GeneratedContent, 4000),
	))
}

func parseContentIssueResponse(rawResponse string, pageURL string) ([]usecase.ContentOptimizerIssue, error) {
	rawResponse = strings.TrimSpace(rawResponse)
	rawResponse = strings.TrimPrefix(rawResponse, "```json")
	rawResponse = strings.TrimPrefix(rawResponse, "```")
	rawResponse = strings.TrimSuffix(rawResponse, "```")
	rawResponse = strings.TrimSpace(rawResponse)
	if rawResponse == "" {
		return nil, nil
	}

	var parsed contentIssueResponse
	if err := json.Unmarshal([]byte(rawResponse), &parsed); err != nil {
		return nil, fmt.Errorf("decode ia content issues: %w", err)
	}

	issues := make([]usecase.ContentOptimizerIssue, 0, len(parsed.Issues))
	for _, issue := range parsed.Issues {
		issue.Category = normalizeIssueCategory(issue.Category)
		issue.Severity = normalizeIssueSeverity(issue.Severity)
		issue.FixType = normalizeAIFixType(issue.FixType)
		issue.Source = "ai"
		if issue.Category == "" || issue.Severity == "" || strings.TrimSpace(issue.Title) == "" || issue.FixType == "" {
			continue
		}
		if strings.TrimSpace(issue.ID) == "" {
			issue.ID = contentIssueID(pageURL, issue.FixType)
		}
		issues = append(issues, issue)
		if len(issues) >= 5 {
			break
		}
	}
	return issues, nil
}

type onboardingBrandProfileResponse struct {
	BrandName             string                                     `json:"brandName"`
	BrandShortDescription string                                     `json:"brandShortDescription"`
	BrandDescription      string                                     `json:"brandDescription"`
	Industry              string                                     `json:"industry"`
	KeyFeatures           []string                                   `json:"keyFeatures"`
	Competitors           []usecase.OnboardingBrandProfileCompetitor `json:"competitors"`
	Prompts               []usecase.OnboardingBrandProfilePrompt     `json:"prompts"`
}

func buildOnboardingBrandProfilePrompt(input usecase.OnboardingBrandProfileAnalysisInput) string {
	fallbackJSON, _ := json.Marshal(input.Fallback)
	content := trimForPrompt(input.CrawlText, 9000)
	return strings.TrimSpace(fmt.Sprintf(`Tu es un analyste de marque senior pour un onboarding SaaS.
Analyse le contenu crawle de la page d'accueil et de la page a propos, puis retourne uniquement du JSON valide, sans markdown.

Schema exact:
{"brandName":"...","brandShortDescription":"...","brandDescription":"...","industry":"...","keyFeatures":["..."],"competitors":[{"name":"...","website":"..."}],"prompts":[{"text":"...","language":"fr"}]}

Regles:
- brandShortDescription: 1 phrase claire.
- brandDescription: 1 a 2 paragraphes exploitables dans un formulaire.
- keyFeatures: 3 a 5 propositions de valeur concretes.
- competitors: 3 a 5 concurrents plausibles; website peut etre vide si incertain.
- prompts: 4 a 6 prompts que des prospects pourraient poser a une IA pour comparer ou choisir une solution.
- Si une information manque, deduis prudemment depuis le contenu et le domaine.

Contexte:
websiteUrl: %s
brandNameHint: %s
fallback: %s

Contenu crawle:
%s`, input.WebsiteURL, input.BrandName, string(fallbackJSON), content))
}

func parseOnboardingBrandProfileResponse(rawResponse string) (usecase.OnboardingBrandProfilePreview, error) {
	rawResponse = strings.TrimSpace(rawResponse)
	rawResponse = strings.TrimPrefix(rawResponse, "```json")
	rawResponse = strings.TrimPrefix(rawResponse, "```")
	rawResponse = strings.TrimSuffix(rawResponse, "```")
	rawResponse = strings.TrimSpace(rawResponse)
	if rawResponse == "" {
		return usecase.OnboardingBrandProfilePreview{}, nil
	}

	var parsed onboardingBrandProfileResponse
	if err := json.Unmarshal([]byte(rawResponse), &parsed); err != nil {
		return usecase.OnboardingBrandProfilePreview{}, fmt.Errorf("decode ia onboarding brand profile: %w", err)
	}

	return usecase.OnboardingBrandProfilePreview{
		BrandName:             strings.TrimSpace(parsed.BrandName),
		BrandShortDescription: strings.TrimSpace(parsed.BrandShortDescription),
		BrandDescription:      strings.TrimSpace(parsed.BrandDescription),
		Industry:              strings.TrimSpace(parsed.Industry),
		KeyFeatures:           cleanOnboardingFeatureList(parsed.KeyFeatures, 5),
		Competitors:           cleanOnboardingCompetitors(parsed.Competitors, 5),
		Prompts:               cleanOnboardingPrompts(parsed.Prompts, 6),
	}, nil
}

func cleanOnboardingFeatureList(values []string, limit int) []string {
	out := make([]string, 0, limit)
	seen := map[string]struct{}{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		lower := strings.ToLower(value)
		if value == "" {
			continue
		}
		if _, ok := seen[lower]; ok {
			continue
		}
		seen[lower] = struct{}{}
		out = append(out, value)
		if len(out) == limit {
			break
		}
	}
	return out
}

func cleanOnboardingCompetitors(
	values []usecase.OnboardingBrandProfileCompetitor,
	limit int,
) []usecase.OnboardingBrandProfileCompetitor {
	out := make([]usecase.OnboardingBrandProfileCompetitor, 0, limit)
	seen := map[string]struct{}{}
	for _, value := range values {
		name := strings.TrimSpace(value.Name)
		if name == "" {
			continue
		}
		key := strings.ToLower(name)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, usecase.OnboardingBrandProfileCompetitor{
			Name:    name,
			Website: strings.TrimSpace(value.Website),
		})
		if len(out) == limit {
			break
		}
	}
	return out
}

func cleanOnboardingPrompts(
	values []usecase.OnboardingBrandProfilePrompt,
	limit int,
) []usecase.OnboardingBrandProfilePrompt {
	out := make([]usecase.OnboardingBrandProfilePrompt, 0, limit)
	seen := map[string]struct{}{}
	for _, value := range values {
		text := strings.TrimSpace(value.Text)
		if text == "" {
			continue
		}
		key := strings.ToLower(text)
		if _, ok := seen[key]; ok {
			continue
		}
		language := strings.TrimSpace(value.Language)
		if language == "" {
			language = "fr"
		}
		seen[key] = struct{}{}
		out = append(out, usecase.OnboardingBrandProfilePrompt{
			Text:     text,
			Language: language,
		})
		if len(out) == limit {
			break
		}
	}
	return out
}

func normalizeIssueCategory(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "seo", "geo":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return ""
	}
}

func normalizeIssueSeverity(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "high", "medium", "low":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "medium"
	}
}

func normalizeAIFixType(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	normalized = strings.NewReplacer(" ", "_", "-", "_", ".", "_", "/", "_").Replace(normalized)
	normalized = strings.Trim(normalized, "_")
	if normalized == "" {
		return ""
	}
	if !strings.HasPrefix(normalized, "ai_") {
		normalized = "ai_" + normalized
	}
	return normalized
}

func contentIssueID(pageURL string, fixType string) string {
	base := strings.ToLower(strings.TrimSpace(pageURL))
	base = strings.NewReplacer("https://", "", "http://", "", "/", "-", ".", "-", "?", "-", "&", "-").Replace(base)
	base = strings.Trim(base, "-")
	if base == "" {
		base = "page"
	}
	return base + "-" + fixType
}

func trimForPrompt(value string, maxRunes int) string {
	value = strings.TrimSpace(value)
	if maxRunes <= 0 {
		return ""
	}
	runes := []rune(value)
	if len(runes) <= maxRunes {
		return value
	}
	return string(runes[:maxRunes]) + "\n[contenu tronque]"
}
