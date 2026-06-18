package http

import (
	"context"
	"errors"
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/usecase"
)

type Handler struct {
	svc        *usecase.Service
	httpClient *http.Client
	readyCheck func(context.Context) error
	scanStore  *agentReadyScanStore
}

func NewHandler(svc *usecase.Service, readyCheck ...func(context.Context) error) *Handler {
	transport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           (&net.Dialer{Timeout: 2 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   30,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   2 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		ResponseHeaderTimeout: 3 * time.Second,
	}
	var readiness func(context.Context) error
	if len(readyCheck) > 0 {
		readiness = readyCheck[0]
	}
	return &Handler{
		svc: svc,
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   5 * time.Second,
		},
		readyCheck: readiness,
		scanStore:  newAgentReadyScanStore(),
	}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", h.health)
	mux.HandleFunc("GET /ready", h.ready)

	mux.HandleFunc("/analysis/agent-ready/scans", h.handleAgentReadyScan)
	mux.HandleFunc("/analysis/agent-ready/scans/", h.handleAgentReadyScan)
	mux.HandleFunc("/analysis/projects/", h.analysisProjectRoutes)
	mux.HandleFunc("/analysis/runs/", h.analysisRunRoutes)
	mux.HandleFunc("/onboarding/brand-profile", h.previewOnboardingBrandProfile)

	// Compatibility aliases for direct service calls without /analysis prefix.
	mux.HandleFunc("/projects/", h.projectRoutes)
	mux.HandleFunc("/runs/", h.runRoutes)
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "analysis-service"})
}

func (h *Handler) ready(w http.ResponseWriter, r *http.Request) {
	if h.readyCheck == nil || h.readyCheck(r.Context()) == nil {
		httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "analysis-service"})
		return
	}
	httpjson.WriteJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "service": "analysis-service"})
}

func (h *Handler) analysisProjectRoutes(w http.ResponseWriter, r *http.Request) {
	h.projectRoutesWithPrefix(w, r, "/analysis/projects/")
}

func (h *Handler) analysisRunRoutes(w http.ResponseWriter, r *http.Request) {
	h.runRoutesWithPrefix(w, r, "/analysis/runs/")
}

func (h *Handler) projectRoutes(w http.ResponseWriter, r *http.Request) {
	h.projectRoutesWithPrefix(w, r, "/projects/")
}

func (h *Handler) runRoutes(w http.ResponseWriter, r *http.Request) {
	h.runRoutesWithPrefix(w, r, "/runs/")
}

func (h *Handler) projectRoutesWithPrefix(w http.ResponseWriter, r *http.Request, prefix string) {
	parts := splitPathAfter(r.URL.Path, prefix)
	if len(parts) < 2 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	projectID := parts[0]

	switch {
	case len(parts) == 2 && parts[1] == "analyze" && r.Method == http.MethodPost:
		h.startAnalysis(w, r, projectID)
	case len(parts) == 2 && parts[1] == "runs" && r.Method == http.MethodGet:
		h.listRuns(w, r, projectID)
	case len(parts) == 2 && parts[1] == "quota" && r.Method == http.MethodGet:
		h.getPromptQuotaUsage(w, r, projectID)
	case len(parts) == 2 && parts[1] == "dashboard" && r.Method == http.MethodGet:
		h.getDashboard(w, r, projectID)
	case len(parts) == 2 && parts[1] == "perception" && r.Method == http.MethodGet:
		h.getPerception(w, r, projectID)
	case len(parts) == 2 && parts[1] == "optimization-errors" && r.Method == http.MethodGet:
		h.getOptimizationErrors(w, r, projectID)
	case len(parts) == 2 && parts[1] == "ai-brief-settings" && r.Method == http.MethodGet:
		h.getAIBriefSettings(w, r, projectID)
	case len(parts) == 2 && parts[1] == "ai-brief-settings" && r.Method == http.MethodPatch:
		h.updateAIBriefSettings(w, r, projectID)
	case len(parts) == 2 && parts[1] == "optimize-actions" && r.Method == http.MethodGet:
		h.listOptimizeActions(w, r, projectID)
	case len(parts) == 2 && parts[1] == "optimize-actions" && r.Method == http.MethodPost:
		h.createOptimizeAction(w, r, projectID)
	case len(parts) == 3 && parts[1] == "optimize-actions" && r.Method == http.MethodPatch:
		h.updateOptimizeActionStatus(w, r, projectID, parts[2])
	case len(parts) == 3 && parts[1] == "optimize-actions" && r.Method == http.MethodDelete:
		h.deleteOptimizeAction(w, r, projectID, parts[2])
	case len(parts) == 3 && parts[1] == "content-optimizer" && parts[2] == "crawl" && r.Method == http.MethodPost:
		h.startContentOptimizerCrawl(w, r, projectID)
	case len(parts) == 3 && parts[1] == "content-optimizer" && parts[2] == "crawl" && r.Method == http.MethodGet:
		h.getLatestContentOptimizerCrawl(w, r, projectID)
	case len(parts) == 4 && parts[1] == "content-optimizer" && parts[2] == "crawl" && r.Method == http.MethodGet:
		h.getContentOptimizerCrawl(w, r, projectID, parts[3])
	case len(parts) == 3 && parts[1] == "content-optimizer" && parts[2] == "analyze" && r.Method == http.MethodPost:
		h.analyzeSelectedContentOptimizerRecords(w, r, projectID)
	case len(parts) == 2 && parts[1] == "brand-canon" && r.Method == http.MethodGet:
		h.getBrandCanon(w, r, projectID)
	case len(parts) == 2 && parts[1] == "brand-canon" && r.Method == http.MethodPatch:
		h.updateBrandCanon(w, r, projectID)
	default:
		http.NotFound(w, r)
	}
}

func (h *Handler) runRoutesWithPrefix(w http.ResponseWriter, r *http.Request, prefix string) {
	parts := splitPathAfter(r.URL.Path, prefix)
	if len(parts) == 1 && parts[0] != "" && r.Method == http.MethodGet {
		h.getRun(w, r, parts[0])
		return
	}
	if len(parts) == 2 && parts[0] != "" && parts[1] == "cancel" && r.Method == http.MethodPost {
		h.cancelRun(w, r, parts[0])
		return
	}
	if len(parts) == 2 && parts[0] != "" && parts[1] == "responses" && r.Method == http.MethodPost {
		h.recordResponse(w, r, parts[0])
		return
	}
	http.NotFound(w, r)
}

type startAnalysisRequest struct {
	RequestID          string               `json:"requestId"`
	PromptIDs          []string             `json:"promptIds"`
	PromptTexts        []usecase.PromptText `json:"promptTexts"`
	ModelIDs           []string             `json:"modelIds"`
	ModelCreditCostSum int                  `json:"modelCreditCostSum"`
	RequestedCredits   int                  `json:"requestedCredits"`
	RunType            string               `json:"runType"`
	Force              bool                 `json:"force"`
}

type previewOnboardingBrandProfileRequest struct {
	WebsiteURL string `json:"websiteUrl"`
	BrandName  string `json:"brandName"`
}

func (h *Handler) previewOnboardingBrandProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httpjson.WriteMethodNotAllowed(w)
		return
	}
	if _, ok := authenticatedUserID(r); !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}

	var req previewOnboardingBrandProfileRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}

	result, err := h.svc.PreviewOnboardingBrandProfile(r.Context(), usecase.OnboardingBrandProfileInput{
		WebsiteURL: req.WebsiteURL,
		BrandName:  req.BrandName,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, result)
}

func (h *Handler) startAnalysis(w http.ResponseWriter, r *http.Request, projectID string) {
	createdBy, ok := authenticatedUserID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing authenticated user")
		return
	}
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	var req startAnalysisRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}

	promptTexts := req.PromptTexts
	if len(promptTexts) == 0 {
		promptTexts = make([]usecase.PromptText, 0, len(req.PromptIDs))
		for _, promptID := range req.PromptIDs {
			promptID = strings.TrimSpace(promptID)
			if promptID == "" {
				continue
			}
			promptTexts = append(promptTexts, usecase.PromptText{ID: promptID, Text: promptID})
		}
	}

	result, err := h.svc.StartAnalysis(r.Context(), usecase.StartAnalysisInput{
		RequestID:          req.RequestID,
		OrganizationID:     organizationID,
		CreatedBy:          createdBy,
		ProjectID:          projectID,
		PromptTexts:        promptTexts,
		ModelIDs:           req.ModelIDs,
		ModelCreditCostSum: req.ModelCreditCostSum,
		RequestedCredits:   req.RequestedCredits,
		RunType:            req.RunType,
		Force:              req.Force,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusCreated, result)
}

func (h *Handler) listRuns(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	limit := 10
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err == nil && parsed > 0 {
			limit = parsed
		}
	}
	runs, err := h.svc.ListAnalysisRuns(r.Context(), projectID, organizationID, limit)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, runs)
}

func (h *Handler) getRun(w http.ResponseWriter, r *http.Request, runID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	details, err := h.svc.GetAnalysisRun(r.Context(), runID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, details)
}

func (h *Handler) cancelRun(w http.ResponseWriter, r *http.Request, runID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	run, err := h.svc.CancelAnalysisRun(r.Context(), runID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, run)
}

type recordResponseRequest struct {
	PromptRunID    string   `json:"promptRunId"`
	ModelID        string   `json:"modelId"`
	RawResponse    string   `json:"rawResponse"`
	BrandMentioned bool     `json:"brandMentioned"`
	BrandPosition  string   `json:"brandPosition"`
	CitationFound  bool     `json:"citationFound"`
	CitedURLs      []string `json:"citedUrls"`
	Sentiment      string   `json:"sentiment"`
}

func (h *Handler) recordResponse(w http.ResponseWriter, r *http.Request, runID string) {
	var req recordResponseRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}

	err := h.svc.RecordResponse(r.Context(), usecase.ResponseInput{
		RunID:          runID,
		PromptRunID:    req.PromptRunID,
		ModelID:        req.ModelID,
		RawResponse:    req.RawResponse,
		BrandMentioned: req.BrandMentioned,
		BrandPosition:  req.BrandPosition,
		CitationFound:  req.CitationFound,
		CitedURLs:      req.CitedURLs,
		Sentiment:      req.Sentiment,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, map[string]bool{"recorded": true})
}

func (h *Handler) getDashboard(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	dashboard, err := h.svc.GetDashboard(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, dashboard)
}

func (h *Handler) getPromptQuotaUsage(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	usage, err := h.svc.GetPromptQuotaUsage(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, usage)
}

func (h *Handler) getPerception(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	if r.URL.Query().Get("includeDashboard") == "1" || r.URL.Query().Get("includeDashboard") == "true" {
		perception, err := h.svc.GetPerceptionWithDashboard(r.Context(), projectID, organizationID)
		if err != nil {
			h.writeUsecaseError(w, err)
			return
		}
		writeSuccess(w, http.StatusOK, perception)
		return
	}

	perception, err := h.svc.GetPerception(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, perception)
}

func (h *Handler) getOptimizationErrors(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	board, err := h.svc.GetOptimizationErrors(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, board)
}

type createOptimizeActionRequest struct {
	Priority         string         `json:"priority"`
	Type             string         `json:"type"`
	Title            string         `json:"title"`
	Issue            string         `json:"issue"`
	Impact           string         `json:"impact"`
	GeneratedContent string         `json:"generatedContent"`
	Status           string         `json:"status"`
	SourceErrorID    string         `json:"sourceErrorId"`
	Metadata         map[string]any `json:"metadata"`
}

type updateOptimizeActionStatusRequest struct {
	Status string `json:"status"`
}

type updateAIBriefSettingsRequest struct {
	BriefModelID         *string `json:"briefModelId"`
	BriefProvider        *string `json:"briefProvider"`
	BriefProviderModelID *string `json:"briefProviderModelId"`
}

func (h *Handler) getAIBriefSettings(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	settings, err := h.svc.GetProjectAIBriefSettings(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, settings)
}

func (h *Handler) updateAIBriefSettings(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	var req updateAIBriefSettingsRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}
	settings, err := h.svc.UpdateProjectAIBriefSettings(r.Context(), projectID, organizationID, usecase.UpdateProjectAIBriefSettingsInput{
		BriefModelID:         req.BriefModelID,
		BriefProvider:        req.BriefProvider,
		BriefProviderModelID: req.BriefProviderModelID,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, settings)
}

func (h *Handler) listOptimizeActions(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	actions, err := h.svc.ListOptimizeActions(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, actions)
}

func (h *Handler) createOptimizeAction(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}
	createdBy, _ := authenticatedUserID(r)

	var req createOptimizeActionRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}
	action, err := h.svc.CreateOptimizeAction(r.Context(), projectID, organizationID, usecase.CreateOptimizeActionInput{
		CreatedBy:        createdBy,
		Priority:         req.Priority,
		Type:             req.Type,
		Title:            req.Title,
		Issue:            req.Issue,
		Impact:           req.Impact,
		GeneratedContent: req.GeneratedContent,
		Status:           req.Status,
		SourceErrorID:    req.SourceErrorID,
		Metadata:         req.Metadata,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusCreated, action)
}

func (h *Handler) updateOptimizeActionStatus(w http.ResponseWriter, r *http.Request, projectID string, actionID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	var req updateOptimizeActionStatusRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}
	action, err := h.svc.UpdateOptimizeActionStatus(r.Context(), projectID, organizationID, actionID, req.Status)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, action)
}

func (h *Handler) deleteOptimizeAction(w http.ResponseWriter, r *http.Request, projectID string, actionID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	if err := h.svc.DeleteOptimizeAction(r.Context(), projectID, organizationID, actionID); err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, map[string]bool{"deleted": true})
}

type startContentOptimizerCrawlRequest struct {
	URL           string                               `json:"url"`
	Limit         int                                  `json:"limit"`
	Depth         int                                  `json:"depth"`
	Source        string                               `json:"source"`
	Formats       []string                             `json:"formats"`
	Render        bool                                 `json:"render"`
	Options       usecase.ContentOptimizerCrawlOptions `json:"options"`
	CrawlPurposes []string                             `json:"crawlPurposes"`
}

type analyzeSelectedContentOptimizerRecordsRequest struct {
	Records []usecase.ContentOptimizerCrawlRecord `json:"records"`
}

func (h *Handler) startContentOptimizerCrawl(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	var req startContentOptimizerCrawlRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}

	job, err := h.svc.StartContentOptimizerCrawl(r.Context(), projectID, organizationID, usecase.ContentOptimizerCrawlStartInput{
		URL:           req.URL,
		Limit:         req.Limit,
		Depth:         req.Depth,
		Source:        req.Source,
		Formats:       req.Formats,
		Render:        req.Render,
		Options:       req.Options,
		CrawlPurposes: req.CrawlPurposes,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusCreated, job)
}

func (h *Handler) getContentOptimizerCrawl(w http.ResponseWriter, r *http.Request, projectID string, jobID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	limit := 0
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil {
			httpjson.WriteError(w, http.StatusBadRequest, "invalid limit")
			return
		}
		limit = parsed
	}

	result, err := h.svc.GetContentOptimizerCrawl(r.Context(), projectID, organizationID, jobID, usecase.ContentOptimizerCrawlResultInput{
		Cursor:       r.URL.Query().Get("cursor"),
		Limit:        limit,
		Status:       r.URL.Query().Get("status"),
		SkipAnalysis: strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("analyze")), "false"),
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, result)
}

func (h *Handler) analyzeSelectedContentOptimizerRecords(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	var req analyzeSelectedContentOptimizerRecordsRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}

	result, err := h.svc.AnalyzeSelectedContentOptimizerRecords(r.Context(), projectID, organizationID, req.Records)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, result)
}

func (h *Handler) getLatestContentOptimizerCrawl(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	snapshot, err := h.svc.GetLatestContentOptimizerCrawl(r.Context(), projectID, organizationID)
	if err != nil {
		if errors.Is(err, usecase.ErrNotFound) {
			writeSuccess(w, http.StatusOK, nil)
			return
		}
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, snapshot)
}

func (h *Handler) getBrandCanon(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	brandCanon, err := h.svc.GetBrandCanon(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, brandCanon)
}

type updateBrandCanonRequest struct {
	BrandName   *string   `json:"brandName"`
	Category    *string   `json:"category"`
	Positioning *string   `json:"positioning"`
	Audience    *[]string `json:"audience"`
	UseCases    *[]string `json:"useCases"`
	Features    *[]string `json:"features"`
}

func (h *Handler) updateBrandCanon(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	var req updateBrandCanonRequest
	if err := httpjson.DecodeJSON(w, r, &req); err != nil {
		httpjson.WriteInvalidJSON(w)
		return
	}

	brandCanon, err := h.svc.UpdateBrandCanon(r.Context(), projectID, organizationID, usecase.UpdateBrandCanonInput{
		BrandName:   req.BrandName,
		Category:    req.Category,
		Positioning: req.Positioning,
		Audience:    req.Audience,
		UseCases:    req.UseCases,
		Features:    req.Features,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, brandCanon)
}

func (h *Handler) writeUsecaseError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, usecase.ErrValidation):
		httpjson.WriteValidationError(w)
	case errors.Is(err, usecase.ErrQuotaExceeded):
		httpjson.WriteQuotaExceeded(w)
	case errors.Is(err, usecase.ErrDependencyUnavailable):
		httpjson.WriteDependencyUnavailable(w)
	case errors.Is(err, usecase.ErrUnauthorized):
		httpjson.WriteForbiddenError(w)
	case errors.Is(err, usecase.ErrNotFound):
		httpjson.WriteNotFoundError(w)
	default:
		httpjson.WriteInternalError(w)
	}
}

func splitPathAfter(path, prefix string) []string {
	trimmed := strings.Trim(strings.TrimPrefix(path, prefix), "/")
	if trimmed == "" {
		return nil
	}
	return strings.Split(trimmed, "/")
}

func authenticatedUserID(r *http.Request) (int64, bool) {
	value := strings.TrimSpace(r.Header.Get("X-Authenticated-User-ID"))
	if value == "" {
		value = strings.TrimSpace(r.Header.Get("x-user-id"))
	}
	if value == "" {
		return 0, false
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed <= 0 {
		return 0, false
	}
	return parsed, true
}

func authenticatedOrganizationID(r *http.Request) (int64, bool) {
	value := strings.TrimSpace(r.Header.Get("X-Organization-ID"))
	if value == "" {
		value = strings.TrimSpace(r.Header.Get("x-organization-id"))
	}
	if value == "" {
		return 0, false
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed <= 0 {
		return 0, false
	}
	return parsed, true
}

func decodeJSON(w http.ResponseWriter, r *http.Request, out any) error {
	return httpjson.DecodeJSON(w, r, out)
}

func writeSuccess(w http.ResponseWriter, status int, data any) {
	httpjson.WriteSuccess(w, status, data)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	httpjson.WriteSuccess(w, status, payload)
}
