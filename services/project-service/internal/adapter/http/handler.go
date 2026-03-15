package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
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
	mux.HandleFunc("POST /projects", h.createProject)
	mux.HandleFunc("GET /projects", h.listProjects)
	mux.HandleFunc("/internal/projects/", h.internalProjectRoutes)
	mux.HandleFunc("/reports/share/", h.sharedReportRoutes)
	mux.HandleFunc("GET /projects/ai-models", h.listModels)
	mux.HandleFunc("POST /projects/ai-models/seed", h.seedModels)
	mux.HandleFunc("/projects/", h.projectRoutes)
	mux.HandleFunc("/prompts/", h.promptRoutes)
	mux.HandleFunc("/competitors/", h.competitorRoutes)
	mux.HandleFunc("GET /ai-models", h.listModels)
	mux.HandleFunc("POST /ai-models/seed", h.seedModels)
}

func (h *Handler) internalProjectRoutes(w http.ResponseWriter, r *http.Request) {
	parts := splitPathAfter(r.URL.Path, "/internal/projects/")
	if len(parts) < 2 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	projectID := parts[0]

	switch {
	case len(parts) == 2 && parts[1] == "impact-context" && r.Method == http.MethodGet:
		h.getProjectImpactContext(w, r, projectID)
	default:
		http.NotFound(w, r)
	}
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "project-service"})
}

func (h *Handler) ready(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "project-service"})
}

type createProjectRequest struct {
	Name              string                     `json:"name"`
	Domain            string                     `json:"domain"`
	WebsiteURL        string                     `json:"websiteUrl"`
	AttributionSource string                     `json:"attributionSource"`
	BrandName         string                     `json:"brandName"`
	BrandDescription  string                     `json:"brandDescription"`
	Industry          string                     `json:"industry"`
	PrimaryLanguage   string                     `json:"primaryLanguage"`
	Country           string                     `json:"country"`
	WhiteLabel        usecase.WhiteLabelSettings `json:"whiteLabel"`
}

func (h *Handler) createProject(w http.ResponseWriter, r *http.Request) {
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

	var req createProjectRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	project, err := h.svc.CreateProject(r.Context(), usecase.CreateProjectInput{
		OrganizationID:    organizationID,
		CreatedBy:         createdBy,
		Name:              req.Name,
		Domain:            req.Domain,
		WebsiteURL:        req.WebsiteURL,
		AttributionSource: req.AttributionSource,
		BrandName:         req.BrandName,
		BrandDescription:  req.BrandDescription,
		Industry:          req.Industry,
		PrimaryLanguage:   req.PrimaryLanguage,
		Country:           req.Country,
		WhiteLabel:        req.WhiteLabel,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}

	writeSuccess(w, http.StatusCreated, project)
}

func (h *Handler) listProjects(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}

	projects, err := h.svc.ListProjects(r.Context(), organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, projects)
}

func (h *Handler) projectRoutes(w http.ResponseWriter, r *http.Request) {
	parts := splitPathAfter(r.URL.Path, "/projects/")
	if len(parts) == 0 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	projectID := parts[0]

	switch {
	case len(parts) == 1 && r.Method == http.MethodGet:
		h.getProject(w, r, projectID)
	case len(parts) == 1 && r.Method == http.MethodPatch:
		h.updateProject(w, r, projectID)
	case len(parts) == 2 && parts[1] == "activate" && r.Method == http.MethodPost:
		h.activateProject(w, r, projectID)
	case len(parts) == 2 && parts[1] == "finalize" && r.Method == http.MethodPost:
		h.finalizeProject(w, r, projectID)
	case len(parts) == 2 && parts[1] == "prompts" && r.Method == http.MethodPost:
		h.addPrompts(w, r, projectID)
	case len(parts) == 2 && parts[1] == "prompts" && r.Method == http.MethodGet:
		h.listPrompts(w, r, projectID)
	case len(parts) == 3 && parts[1] == "prompts" && parts[2] == "status" && r.Method == http.MethodPatch:
		h.bulkUpdatePromptStatus(w, r, projectID)
	case len(parts) == 2 && parts[1] == "competitors" && r.Method == http.MethodPost:
		h.addCompetitors(w, r, projectID)
	case len(parts) == 2 && parts[1] == "competitors" && r.Method == http.MethodGet:
		h.listCompetitors(w, r, projectID)
	case len(parts) == 2 && parts[1] == "models" && r.Method == http.MethodGet:
		h.listProjectModels(w, r, projectID)
	case len(parts) == 2 && parts[1] == "models" && r.Method == http.MethodPatch:
		h.replaceProjectModels(w, r, projectID)
	case len(parts) == 2 && parts[1] == "reports" && r.Method == http.MethodPost:
		h.generateProjectReport(w, r, projectID)
	case len(parts) == 2 && parts[1] == "reports" && r.Method == http.MethodGet:
		h.listProjectReports(w, r, projectID)
	case len(parts) == 3 && parts[1] == "reports" && r.Method == http.MethodGet:
		h.getProjectReport(w, r, projectID, parts[2])
	case len(parts) == 4 && parts[1] == "reports" && parts[3] == "pdf" && r.Method == http.MethodGet:
		h.downloadProjectReportPDF(w, r, projectID, parts[2])
	case len(parts) == 4 && parts[1] == "reports" && parts[3] == "send" && r.Method == http.MethodPost:
		h.sendProjectReport(w, r, projectID, parts[2])
	case len(parts) == 4 && parts[1] == "reports" && parts[3] == "share" && r.Method == http.MethodPost:
		h.createProjectReportShareLink(w, r, projectID, parts[2])
	case len(parts) == 2 && parts[1] == "impact-integrations" && r.Method == http.MethodGet:
		h.getProjectImpactIntegrations(w, r, projectID)
	case len(parts) == 2 && parts[1] == "impact-integrations" && r.Method == http.MethodPatch:
		h.updateProjectImpactIntegrations(w, r, projectID)
	default:
		http.NotFound(w, r)
	}
}

func (h *Handler) promptRoutes(w http.ResponseWriter, r *http.Request) {
	parts := splitPathAfter(r.URL.Path, "/prompts/")
	if len(parts) != 1 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	promptID := parts[0]

	switch r.Method {
	case http.MethodPatch:
		h.updatePrompt(w, r, promptID)
	case http.MethodDelete:
		h.deletePrompt(w, r, promptID)
	default:
		http.NotFound(w, r)
	}
}

func (h *Handler) competitorRoutes(w http.ResponseWriter, r *http.Request) {
	parts := splitPathAfter(r.URL.Path, "/competitors/")
	if len(parts) != 1 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	competitorID := parts[0]

	switch r.Method {
	case http.MethodPatch:
		h.updateCompetitor(w, r, competitorID)
	case http.MethodDelete:
		h.deleteCompetitor(w, r, competitorID)
	default:
		http.NotFound(w, r)
	}
}

func (h *Handler) getProject(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}
	project, err := h.svc.GetProject(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, project)
}

type updateProjectRequest struct {
	Name              *string                     `json:"name"`
	Domain            *string                     `json:"domain"`
	WebsiteURL        *string                     `json:"websiteUrl"`
	AttributionSource *string                     `json:"attributionSource"`
	BrandName         *string                     `json:"brandName"`
	BrandDescription  *string                     `json:"brandDescription"`
	Industry          *string                     `json:"industry"`
	WhiteLabel        *usecase.WhiteLabelSettings `json:"whiteLabel"`
}

func (h *Handler) updateProject(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}

	var req updateProjectRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	project, err := h.svc.UpdateProject(r.Context(), projectID, organizationID, usecase.UpdateProjectInput{
		Name:              req.Name,
		Domain:            req.Domain,
		WebsiteURL:        req.WebsiteURL,
		AttributionSource: req.AttributionSource,
		BrandName:         req.BrandName,
		BrandDescription:  req.BrandDescription,
		Industry:          req.Industry,
		WhiteLabel:        req.WhiteLabel,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, project)
}

func (h *Handler) activateProject(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}
	project, err := h.svc.ActivateProject(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, project)
}

func (h *Handler) getProjectImpactContext(w http.ResponseWriter, r *http.Request, projectID string) {
	contextValue, err := h.svc.GetProjectImpactContext(r.Context(), projectID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, contextValue)
}

func (h *Handler) getProjectImpactIntegrations(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}
	value, err := h.svc.GetProjectImpactIntegrations(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, value)
}

type updateProjectImpactIntegrationsRequest struct {
	GA4       *updateProjectGA4IntegrationRequest       `json:"ga4"`
	Stripe    *updateProjectStripeIntegrationRequest    `json:"stripe"`
	Ingestion *updateProjectIngestionIntegrationRequest `json:"ingestion"`
}

type updateProjectGA4IntegrationRequest struct {
	PropertyID         *string `json:"propertyId"`
	ServiceAccountJSON *string `json:"serviceAccountJSON"`
	Disconnect         bool    `json:"disconnect"`
}

type updateProjectStripeIntegrationRequest struct {
	WebhookSecret *string `json:"webhookSecret"`
	Disconnect    bool    `json:"disconnect"`
}

type updateProjectIngestionIntegrationRequest struct {
	Rotate     bool `json:"rotate"`
	Disconnect bool `json:"disconnect"`
}

func (h *Handler) updateProjectImpactIntegrations(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}

	var req updateProjectImpactIntegrationsRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	var input usecase.UpdateProjectImpactIntegrationsInput
	if req.GA4 != nil {
		input.GA4 = &usecase.UpdateProjectGA4IntegrationInput{
			PropertyID:         req.GA4.PropertyID,
			ServiceAccountJSON: req.GA4.ServiceAccountJSON,
			Disconnect:         req.GA4.Disconnect,
		}
	}
	if req.Stripe != nil {
		input.Stripe = &usecase.UpdateProjectStripeIntegrationInput{
			WebhookSecret: req.Stripe.WebhookSecret,
			Disconnect:    req.Stripe.Disconnect,
		}
	}
	if req.Ingestion != nil {
		input.Ingestion = &usecase.UpdateProjectIngestionIntegrationInput{
			Rotate:     req.Ingestion.Rotate,
			Disconnect: req.Ingestion.Disconnect,
		}
	}

	value, err := h.svc.UpdateProjectImpactIntegrations(r.Context(), projectID, organizationID, input)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, value)
}

func (h *Handler) finalizeProject(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}
	result, err := h.svc.FinalizeProject(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, result)
}

type addPromptsRequest struct {
	Prompts []string `json:"prompts"`
}

func (h *Handler) addPrompts(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}
	var req addPromptsRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	prompts, err := h.svc.AddPrompts(r.Context(), projectID, organizationID, req.Prompts)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusCreated, prompts)
}

func (h *Handler) listPrompts(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}
	page, _ := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("page")))
	pageSize, _ := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("page_size")))
	prompts, err := h.svc.ListPrompts(r.Context(), projectID, organizationID, usecase.ListPromptsInput{
		Search:   r.URL.Query().Get("search"),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, prompts)
}

type updatePromptRequest struct {
	Text     *string                 `json:"text"`
	Intent   *string                 `json:"intent"`
	ModelIDs *[]string               `json:"modelIds"`
	Schedule *usecase.PromptSchedule `json:"schedule"`
	Status   *string                 `json:"status"`
	IsActive *bool                   `json:"isActive"`
}

func (h *Handler) updatePrompt(w http.ResponseWriter, r *http.Request, promptID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}
	var req updatePromptRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	prompt, err := h.svc.UpdatePrompt(r.Context(), promptID, organizationID, usecase.UpdatePromptInput{
		Text:     req.Text,
		Intent:   req.Intent,
		ModelIDs: req.ModelIDs,
		Schedule: req.Schedule,
		Status:   req.Status,
		IsActive: req.IsActive,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, prompt)
}

type bulkUpdatePromptStatusRequest struct {
	PromptIDs []string `json:"promptIds"`
	Status    string   `json:"status"`
}

func (h *Handler) bulkUpdatePromptStatus(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}
	var req bulkUpdatePromptStatusRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	prompts, err := h.svc.UpdatePromptsStatus(r.Context(), projectID, organizationID, usecase.UpdatePromptsStatusInput{
		PromptIDs: req.PromptIDs,
		Status:    req.Status,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, prompts)
}

func (h *Handler) deletePrompt(w http.ResponseWriter, r *http.Request, promptID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}
	if err := h.svc.DeletePrompt(r.Context(), promptID, organizationID); err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, map[string]bool{"deleted": true})
}

type addCompetitorsRequest struct {
	Competitors []usecase.AddCompetitorInput `json:"competitors"`
}

func (h *Handler) addCompetitors(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}
	var req addCompetitorsRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	competitors, err := h.svc.AddCompetitors(r.Context(), projectID, organizationID, req.Competitors)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusCreated, competitors)
}

func (h *Handler) listCompetitors(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}
	competitors, err := h.svc.ListCompetitors(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, competitors)
}

type updateCompetitorRequest struct {
	Name       *string `json:"name"`
	Domain     *string `json:"domain"`
	WebsiteURL *string `json:"websiteUrl"`
	IsActive   *bool   `json:"isActive"`
}

func (h *Handler) updateCompetitor(w http.ResponseWriter, r *http.Request, competitorID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}
	var req updateCompetitorRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	competitor, err := h.svc.UpdateCompetitor(r.Context(), competitorID, organizationID, usecase.UpdateCompetitorInput{
		Name:       req.Name,
		Domain:     req.Domain,
		WebsiteURL: req.WebsiteURL,
		IsActive:   req.IsActive,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, competitor)
}

func (h *Handler) deleteCompetitor(w http.ResponseWriter, r *http.Request, competitorID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}
	if err := h.svc.DeleteCompetitor(r.Context(), competitorID, organizationID); err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, map[string]bool{"deleted": true})
}

func (h *Handler) listModels(w http.ResponseWriter, r *http.Request) {
	onlyActive := true
	if value := strings.TrimSpace(r.URL.Query().Get("active_only")); value != "" {
		parsed, err := strconv.ParseBool(value)
		if err == nil {
			onlyActive = parsed
		}
	}
	models, err := h.svc.ListModels(r.Context(), onlyActive)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, models)
}

func (h *Handler) seedModels(w http.ResponseWriter, r *http.Request) {
	models, err := h.svc.SeedDefaultModels(r.Context())
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, models)
}

func (h *Handler) listProjectModels(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}
	selection, err := h.svc.ListProjectModels(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, selection)
}

type replaceProjectModelsRequest struct {
	ModelIDs []string `json:"modelIds"`
}

func (h *Handler) replaceProjectModels(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing organization identity"})
		return
	}
	var req replaceProjectModelsRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	result, err := h.svc.ReplaceProjectModels(r.Context(), projectID, organizationID, req.ModelIDs)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, result)
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
