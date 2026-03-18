package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/usecase"
)

type Handler struct {
	svc *usecase.Service
}

func NewHandler(svc *usecase.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", h.health)
	mux.HandleFunc("GET /ready", h.ready)

	mux.HandleFunc("/analysis/projects/", h.analysisProjectRoutes)
	mux.HandleFunc("/analysis/runs/", h.analysisRunRoutes)
	mux.HandleFunc("/analysis/alerts/", h.analysisAlertRoutes)

	// Compatibility aliases for direct service calls without /analysis prefix.
	mux.HandleFunc("/projects/", h.projectRoutes)
	mux.HandleFunc("/runs/", h.runRoutes)
	mux.HandleFunc("/alerts/", h.alertRoutes)
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "analysis-service"})
}

func (h *Handler) ready(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "analysis-service"})
}

func (h *Handler) analysisProjectRoutes(w http.ResponseWriter, r *http.Request) {
	h.projectRoutesWithPrefix(w, r, "/analysis/projects/")
}

func (h *Handler) analysisRunRoutes(w http.ResponseWriter, r *http.Request) {
	h.runRoutesWithPrefix(w, r, "/analysis/runs/")
}

func (h *Handler) analysisAlertRoutes(w http.ResponseWriter, r *http.Request) {
	h.alertRoutesWithPrefix(w, r, "/analysis/alerts/")
}

func (h *Handler) projectRoutes(w http.ResponseWriter, r *http.Request) {
	h.projectRoutesWithPrefix(w, r, "/projects/")
}

func (h *Handler) runRoutes(w http.ResponseWriter, r *http.Request) {
	h.runRoutesWithPrefix(w, r, "/runs/")
}

func (h *Handler) alertRoutes(w http.ResponseWriter, r *http.Request) {
	h.alertRoutesWithPrefix(w, r, "/alerts/")
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
	case len(parts) == 2 && parts[1] == "dashboard" && r.Method == http.MethodGet:
		h.getDashboard(w, r, projectID)
	case len(parts) == 2 && parts[1] == "perception" && r.Method == http.MethodGet:
		h.getPerception(w, r, projectID)
	case len(parts) == 2 && parts[1] == "brand-canon" && r.Method == http.MethodGet:
		h.getBrandCanon(w, r, projectID)
	case len(parts) == 2 && parts[1] == "brand-canon" && r.Method == http.MethodPatch:
		h.updateBrandCanon(w, r, projectID)
	case len(parts) == 2 && parts[1] == "alerts" && r.Method == http.MethodGet:
		h.listAlerts(w, r, projectID)
	case len(parts) == 2 && parts[1] == "alerts" && r.Method == http.MethodPost:
		h.createAlert(w, r, projectID)
	case len(parts) == 3 && parts[1] == "alerts" && parts[2] == "read-all" && r.Method == http.MethodPost:
		h.markAllAlertsRead(w, r, projectID)
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
	if len(parts) == 2 && parts[0] != "" && parts[1] == "responses" && r.Method == http.MethodPost {
		h.recordResponse(w, r, parts[0])
		return
	}
	http.NotFound(w, r)
}

func (h *Handler) alertRoutesWithPrefix(w http.ResponseWriter, r *http.Request, prefix string) {
	parts := splitPathAfter(r.URL.Path, prefix)
	if len(parts) == 2 && parts[1] == "read" && r.Method == http.MethodPatch {
		h.markAlertRead(w, r, parts[0])
		return
	}
	if len(parts) == 1 && r.Method == http.MethodDelete {
		h.deleteAlert(w, r, parts[0])
		return
	}
	http.NotFound(w, r)
}

type startAnalysisRequest struct {
	RequestID   string               `json:"requestId"`
	PromptIDs   []string             `json:"promptIds"`
	PromptTexts []usecase.PromptText `json:"promptTexts"`
	ModelIDs    []string             `json:"modelIds"`
	RunType     string               `json:"runType"`
}

func (h *Handler) startAnalysis(w http.ResponseWriter, r *http.Request, projectID string) {
	createdBy, ok := authenticatedUserID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing user identity"})
		return
	}
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}

	var req startAnalysisRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
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
		RequestID:      req.RequestID,
		OrganizationID: organizationID,
		CreatedBy:      createdBy,
		ProjectID:      projectID,
		PromptTexts:    promptTexts,
		ModelIDs:       req.ModelIDs,
		RunType:        req.RunType,
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
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
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
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}

	details, err := h.svc.GetAnalysisRun(r.Context(), runID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, details)
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
	if err := decodeJSON(w, r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
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
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}

	dashboard, err := h.svc.GetDashboard(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, dashboard)
}

func (h *Handler) getPerception(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}

	perception, err := h.svc.GetPerception(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, perception)
}

func (h *Handler) getBrandCanon(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
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
	BrandName   *string         `json:"brandName"`
	Category    *string         `json:"category"`
	Positioning *string         `json:"positioning"`
	Audience    *[]string       `json:"audience"`
	UseCases    *[]string       `json:"useCases"`
	Pricing     *map[string]any `json:"pricing"`
	Features    *[]string       `json:"features"`
}

func (h *Handler) updateBrandCanon(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}

	var req updateBrandCanonRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	brandCanon, err := h.svc.UpdateBrandCanon(r.Context(), projectID, organizationID, usecase.UpdateBrandCanonInput{
		BrandName:   req.BrandName,
		Category:    req.Category,
		Positioning: req.Positioning,
		Audience:    req.Audience,
		UseCases:    req.UseCases,
		Pricing:     req.Pricing,
		Features:    req.Features,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, brandCanon)
}

type createAlertRequest struct {
	AlertType   string `json:"alertType"`
	Severity    string `json:"severity"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

func (h *Handler) createAlert(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}

	var req createAlertRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	alert, err := h.svc.CreateAlert(r.Context(), projectID, organizationID, usecase.CreateAlertInput{
		AlertType:   req.AlertType,
		Severity:    req.Severity,
		Title:       req.Title,
		Description: req.Description,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusCreated, alert)
}

func (h *Handler) listAlerts(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}

	unreadOnly := strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("unreadOnly")), "true")
	alerts, err := h.svc.ListAlerts(r.Context(), projectID, organizationID, unreadOnly)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, alerts)
}

func (h *Handler) markAlertRead(w http.ResponseWriter, r *http.Request, alertID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}

	alert, err := h.svc.MarkAlertRead(r.Context(), alertID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, alert)
}

func (h *Handler) markAllAlertsRead(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}

	if err := h.svc.MarkAllAlertsRead(r.Context(), projectID, organizationID); err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) deleteAlert(w http.ResponseWriter, r *http.Request, alertID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}

	if err := h.svc.DeleteAlert(r.Context(), alertID, organizationID); err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, map[string]bool{"deleted": true})
}

func (h *Handler) writeUsecaseError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, usecase.ErrValidation):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
	case errors.Is(err, usecase.ErrUnauthorized):
		writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
	case errors.Is(err, usecase.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
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
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(out); err != nil {
		return err
	}
	return nil
}

func writeSuccess(w http.ResponseWriter, status int, data any) {
	writeJSON(w, status, map[string]any{"success": true, "data": data})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
