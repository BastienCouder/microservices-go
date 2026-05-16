package ia

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/security"
	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/usecase"
)

type Config struct {
	BaseURL    string
	JWTSecret  string
	JWTIssuer  string
	ModelID    string
	ProviderID string
	HTTPClient *http.Client
}

type Client struct {
	baseURL    string
	jwtSecret  string
	jwtIssuer  string
	modelID    string
	providerID string
	http       *http.Client
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
		httpClient = &http.Client{Timeout: 8 * time.Second}
	}

	providerID := strings.TrimSpace(cfg.ProviderID)
	if providerID == "" {
		providerID = "openrouter"
	}

	return &Client{
		baseURL:    baseURL,
		jwtSecret:  strings.TrimSpace(cfg.JWTSecret),
		jwtIssuer:  strings.TrimSpace(cfg.JWTIssuer),
		modelID:    strings.TrimSpace(cfg.ModelID),
		providerID: providerID,
		http:       httpClient,
	}, nil
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

	token, err := security.SignInternalJWT(c.jwtSecret, c.jwtIssuer, "ia-service", "analysis-service", security.OutboundTokenClaims{
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
