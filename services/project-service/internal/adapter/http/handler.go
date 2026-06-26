package http

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
)

type Handler struct {
	svc        *usecase.Service
	readyCheck func(context.Context) error
}

func NewHandler(svc *usecase.Service, readyCheck ...func(context.Context) error) *Handler {
	var readiness func(context.Context) error
	if len(readyCheck) > 0 {
		readiness = readyCheck[0]
	}
	return &Handler{svc: svc, readyCheck: readiness}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", h.health)
	mux.HandleFunc("GET /ready", h.ready)
	mux.HandleFunc("POST /projects", h.createProject)
	mux.HandleFunc("GET /projects", h.listProjects)
	mux.HandleFunc("GET /projects/llm-provider-credentials", h.listLLMProviderCredentials)
	mux.HandleFunc("PUT /projects/llm-provider-credentials/{provider}", h.updateLLMProviderCredential)
	mux.HandleFunc("DELETE /projects/llm-provider-credentials/{provider}", h.deleteLLMProviderCredential)
	mux.HandleFunc("GET /internal/scheduled-analysis/jobs", h.listScheduledAnalysisJobs)
	mux.HandleFunc("/internal/projects/", h.internalProjectRoutes)
	mux.HandleFunc("/internal/prompts/", h.internalPromptRoutes)
	mux.HandleFunc("/internal/competitors/", h.internalCompetitorRoutes)
	mux.HandleFunc("/projects/", h.projectRoutes)
	mux.HandleFunc("/analysis/projects/", h.analysisProjectRoutes)
	mux.HandleFunc("/prompts/", h.promptRoutes)
	mux.HandleFunc("/competitors/", h.competitorRoutes)
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
	case len(parts) == 2 && parts[1] == "scope" && r.Method == http.MethodGet:
		h.getProjectScope(w, r, projectID)
	default:
		http.NotFound(w, r)
	}
}

func (h *Handler) internalPromptRoutes(w http.ResponseWriter, r *http.Request) {
	parts := splitPathAfter(r.URL.Path, "/internal/prompts/")
	if len(parts) != 2 || parts[0] == "" || parts[1] != "scope" || r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	h.getPromptScope(w, r, parts[0])
}

func (h *Handler) internalCompetitorRoutes(w http.ResponseWriter, r *http.Request) {
	parts := splitPathAfter(r.URL.Path, "/internal/competitors/")
	if len(parts) != 2 || parts[0] == "" || parts[1] != "scope" || r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	h.getCompetitorScope(w, r, parts[0])
}

func (h *Handler) analysisProjectRoutes(w http.ResponseWriter, r *http.Request) {
	parts := splitPathAfter(r.URL.Path, "/analysis/projects/")
	if len(parts) != 2 || parts[0] == "" || parts[1] != "run" || r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}

	h.runManualAnalysis(w, r, parts[0])
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "project-service"})
}

func (h *Handler) ready(w http.ResponseWriter, r *http.Request) {
	if h.readyCheck == nil || h.readyCheck(r.Context()) == nil {
		httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "project-service"})
		return
	}
	httpjson.WriteJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "service": "project-service"})
}

type createProjectRequest struct {
	Name              string `json:"name"`
	Domain            string `json:"domain"`
	WebsiteURL        string `json:"websiteUrl"`
	AttributionSource string `json:"attributionSource"`
	PrimaryLanguage   string `json:"primaryLanguage"`
	Country           string `json:"country"`
}

func (h *Handler) createProject(w http.ResponseWriter, r *http.Request) {
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

	var req createProjectRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	project, err := h.svc.CreateProject(r.Context(), usecase.CreateProjectInput{
		OrganizationID:    organizationID,
		CreatedBy:         createdBy,
		Name:              req.Name,
		Domain:            req.Domain,
		WebsiteURL:        req.WebsiteURL,
		AttributionSource: req.AttributionSource,
		PrimaryLanguage:   req.PrimaryLanguage,
		Country:           req.Country,
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
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	var projects []usecase.Project
	var err error
	if hasOrganizationFullAccess(r) {
		projects, err = h.svc.ListProjects(r.Context(), organizationID)
	} else if userID, ok := authenticatedUserID(r); ok {
		projects, err = h.svc.ListProjectsForUser(r.Context(), organizationID, userID)
	} else {
		projects, err = h.svc.ListProjects(r.Context(), organizationID)
	}
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
	case len(parts) == 1 && r.Method == http.MethodDelete:
		h.deleteProject(w, r, projectID)
	case len(parts) == 2 && parts[1] == "finalize" && r.Method == http.MethodPost:
		h.finalizeProject(w, r, projectID)
	case len(parts) == 4 && parts[1] == "analysis" && parts[2] == "perception" && parts[3] == "run" && r.Method == http.MethodPost:
		h.runPerceptionAnalysis(w, r, projectID)
	case len(parts) == 2 && parts[1] == "prompts" && r.Method == http.MethodPost:
		h.addPrompts(w, r, projectID)
	case len(parts) == 3 && parts[1] == "prompts" && parts[2] == "generate" && r.Method == http.MethodPost:
		h.generatePrompts(w, r, projectID)
	case len(parts) == 2 && parts[1] == "prompts" && r.Method == http.MethodGet:
		h.listPrompts(w, r, projectID)
	case len(parts) == 3 && parts[1] == "prompts" && parts[2] == "status" && r.Method == http.MethodPatch:
		h.bulkUpdatePromptStatus(w, r, projectID)
	case len(parts) == 2 && parts[1] == "competitors" && r.Method == http.MethodPost:
		h.addCompetitors(w, r, projectID)
	case len(parts) == 2 && parts[1] == "competitors" && r.Method == http.MethodGet:
		h.listCompetitors(w, r, projectID)
	case len(parts) == 2 && parts[1] == "llm-provider-credentials" && r.Method == http.MethodGet:
		h.listLLMProviderCredentialsForProject(w, r, projectID)
	case len(parts) == 3 && parts[1] == "llm-provider-credentials" && r.Method == http.MethodPut:
		h.updateLLMProviderCredentialForProject(w, r, projectID, parts[2])
	case len(parts) == 3 && parts[1] == "llm-provider-credentials" && r.Method == http.MethodDelete:
		h.deleteLLMProviderCredentialForProject(w, r, projectID, parts[2])
	case len(parts) == 2 && parts[1] == "models" && r.Method == http.MethodGet:
		h.listProjectModels(w, r, projectID)
	case len(parts) == 2 && parts[1] == "models" && r.Method == http.MethodPatch:
		h.replaceProjectModels(w, r, projectID)
	case len(parts) == 2 && parts[1] == "brand-canon" && r.Method == http.MethodGet:
		h.getBrandCanon(w, r, projectID)
	case len(parts) == 2 && parts[1] == "brand-canon" && r.Method == http.MethodPatch:
		h.updateBrandCanon(w, r, projectID)
	case len(parts) == 2 && parts[1] == "impact-integrations" && r.Method == http.MethodGet:
		h.getProjectImpactIntegrations(w, r, projectID)
	case len(parts) == 2 && parts[1] == "impact-integrations" && r.Method == http.MethodPatch:
		h.updateProjectImpactIntegrations(w, r, projectID)
	case len(parts) == 5 && parts[1] == "impact-integrations" && parts[2] == "ga4" && parts[3] == "oauth" && parts[4] == "start" && r.Method == http.MethodPost:
		h.startProjectGA4OAuth(w, r, projectID)
	case len(parts) == 5 && parts[1] == "impact-integrations" && parts[2] == "ga4" && parts[3] == "oauth" && parts[4] == "callback" && r.Method == http.MethodPost:
		h.completeProjectGA4OAuth(w, r, projectID)
	case len(parts) == 5 && parts[1] == "impact-integrations" && parts[2] == "ga4" && parts[3] == "oauth" && parts[4] == "properties" && r.Method == http.MethodGet:
		h.listProjectGA4OAuthProperties(w, r, projectID)
	case len(parts) == 5 && parts[1] == "impact-integrations" && parts[2] == "ga4" && parts[3] == "oauth" && parts[4] == "property" && r.Method == http.MethodPatch:
		h.selectProjectGA4OAuthProperty(w, r, projectID)
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
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
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
	Name              *string `json:"name"`
	Domain            *string `json:"domain"`
	WebsiteURL        *string `json:"websiteUrl"`
	AttributionSource *string `json:"attributionSource"`
}

func (h *Handler) updateProject(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	var req updateProjectRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	project, err := h.svc.UpdateProject(r.Context(), projectID, organizationID, usecase.UpdateProjectInput{
		Name:              req.Name,
		Domain:            req.Domain,
		WebsiteURL:        req.WebsiteURL,
		AttributionSource: req.AttributionSource,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, project)
}

func (h *Handler) deleteProject(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}
	if err := h.svc.DeleteProject(r.Context(), projectID, organizationID); err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) getProjectImpactContext(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}
	contextValue, err := h.svc.GetProjectImpactContext(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, contextValue)
}

func (h *Handler) getProjectScope(w http.ResponseWriter, r *http.Request, projectID string) {
	scope, err := h.svc.GetProjectScope(r.Context(), projectID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, map[string]any{
		"organizationId": scope.OrganizationID,
		"projectId":      scope.ProjectID,
	})
}

func (h *Handler) getPromptScope(w http.ResponseWriter, r *http.Request, promptID string) {
	scope, err := h.svc.GetPromptScope(r.Context(), promptID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, map[string]any{
		"organizationId": scope.OrganizationID,
		"projectId":      scope.ProjectID,
	})
}

func (h *Handler) getCompetitorScope(w http.ResponseWriter, r *http.Request, competitorID string) {
	scope, err := h.svc.GetCompetitorScope(r.Context(), competitorID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, map[string]any{
		"organizationId": scope.OrganizationID,
		"projectId":      scope.ProjectID,
	})
}

func (h *Handler) listScheduledAnalysisJobs(w http.ResponseWriter, r *http.Request) {
	jobs, err := h.svc.ListScheduledAnalysisJobs(r.Context())
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, jobs)
}

func (h *Handler) getProjectImpactIntegrations(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
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
	GA4 *updateProjectGA4IntegrationRequest `json:"ga4"`
}

type updateProjectGA4IntegrationRequest struct {
	PropertyID         *string `json:"propertyId"`
	ServiceAccountJSON *string `json:"serviceAccountJSON"`
	Disconnect         bool    `json:"disconnect"`
}

type startProjectGA4OAuthRequest struct {
	RedirectURI string `json:"redirectUri"`
}

type completeProjectGA4OAuthRequest struct {
	Code        string `json:"code"`
	State       string `json:"state"`
	RedirectURI string `json:"redirectUri"`
	PropertyID  string `json:"propertyId"`
}

type selectProjectGA4OAuthPropertyRequest struct {
	PropertyID string `json:"propertyId"`
}

func (h *Handler) updateProjectImpactIntegrations(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	var req updateProjectImpactIntegrationsRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
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
	value, err := h.svc.UpdateProjectImpactIntegrations(r.Context(), projectID, organizationID, input)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, value)
}

func (h *Handler) startProjectGA4OAuth(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	var req startProjectGA4OAuthRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}
	value, err := h.svc.StartProjectGA4OAuth(r.Context(), projectID, organizationID, usecase.StartProjectGA4OAuthInput{
		RedirectURI: req.RedirectURI,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, value)
}

func (h *Handler) completeProjectGA4OAuth(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	var req completeProjectGA4OAuthRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}
	value, err := h.svc.CompleteProjectGA4OAuth(r.Context(), projectID, organizationID, usecase.CompleteProjectGA4OAuthInput{
		Code:        req.Code,
		State:       req.State,
		RedirectURI: req.RedirectURI,
		PropertyID:  req.PropertyID,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, value)
}

func (h *Handler) listProjectGA4OAuthProperties(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}
	properties, err := h.svc.ListProjectGA4OAuthProperties(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, properties)
}

func (h *Handler) selectProjectGA4OAuthProperty(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	var req selectProjectGA4OAuthPropertyRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}
	value, err := h.svc.SelectProjectGA4OAuthProperty(r.Context(), projectID, organizationID, usecase.SelectProjectGA4OAuthPropertyInput{
		PropertyID: req.PropertyID,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, value)
}

func (h *Handler) finalizeProject(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}
	result, err := h.svc.FinalizeProject(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, result)
}

type runManualAnalysisRequest struct {
	RequestID   string                       `json:"requestId"`
	PromptTexts []usecase.AnalysisPromptText `json:"promptTexts"`
	ModelIDs    []string                     `json:"modelIds"`
	RunType     string                       `json:"runType"`
}

type runPerceptionAnalysisRequest struct {
	RequestID string   `json:"requestId"`
	PromptIDs []string `json:"promptIds"`
	ModelIDs  []string `json:"modelIds"`
	Force     bool     `json:"force"`
	Restart   bool     `json:"restart"`
}

func (h *Handler) runManualAnalysis(w http.ResponseWriter, r *http.Request, projectID string) {
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

	var req runManualAnalysisRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	result, err := h.svc.RunManualAnalysis(r.Context(), projectID, organizationID, createdBy, usecase.RunManualAnalysisInput{
		RequestID:   req.RequestID,
		PromptTexts: req.PromptTexts,
		ModelIDs:    req.ModelIDs,
		RunType:     req.RunType,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusCreated, result)
}

func (h *Handler) runPerceptionAnalysis(w http.ResponseWriter, r *http.Request, projectID string) {
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

	var req runPerceptionAnalysisRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	result, err := h.svc.RunPerceptionAnalysis(r.Context(), projectID, organizationID, createdBy, usecase.RunPerceptionAnalysisInput{
		RequestID: req.RequestID,
		PromptIDs: req.PromptIDs,
		ModelIDs:  req.ModelIDs,
		Force:     req.Force,
		Restart:   req.Restart,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusCreated, result)
}

type addPromptsRequest struct {
	Prompts []json.RawMessage `json:"prompts"`
	Kind    string            `json:"kind"`
}

type addPromptItemPayload struct {
	Text     string `json:"text"`
	Language string `json:"language"`
}

func decodePromptInputs(values []json.RawMessage) ([]usecase.CreatePromptInput, error) {
	items := make([]usecase.CreatePromptInput, 0, len(values))
	for _, raw := range values {
		var text string
		if err := json.Unmarshal(raw, &text); err == nil {
			items = append(items, usecase.CreatePromptInput{Text: text})
			continue
		}

		var item addPromptItemPayload
		if err := json.Unmarshal(raw, &item); err != nil {
			return nil, err
		}
		items = append(items, usecase.CreatePromptInput{
			Text:     item.Text,
			Language: item.Language,
		})
	}
	return items, nil
}

func (h *Handler) addPrompts(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}
	var req addPromptsRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}
	promptInputs, err := decodePromptInputs(req.Prompts)
	if err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	prompts, err := h.svc.AddPromptInputsWithKind(r.Context(), projectID, organizationID, promptInputs, req.Kind)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusCreated, prompts)
}

func (h *Handler) listPrompts(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}
	page, _ := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("page")))
	pageSize, _ := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("page_size")))
	prompts, err := h.svc.ListPrompts(r.Context(), projectID, organizationID, usecase.ListPromptsInput{
		Search:   r.URL.Query().Get("search"),
		Kind:     r.URL.Query().Get("kind"),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, prompts)
}

func (h *Handler) generatePrompts(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	prompts, err := h.svc.GenerateMonitoringPrompts(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}

	writeSuccess(w, http.StatusCreated, prompts)
}

type updatePromptRequest struct {
	Text     *string                 `json:"text"`
	Language *string                 `json:"language"`
	Intent   *string                 `json:"intent"`
	Kind     *string                 `json:"kind"`
	ModelIDs *[]string               `json:"modelIds"`
	Schedule *usecase.PromptSchedule `json:"schedule"`
	Status   *string                 `json:"status"`
	IsActive *bool                   `json:"isActive"`
}

func (h *Handler) updatePrompt(w http.ResponseWriter, r *http.Request, promptID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}
	var req updatePromptRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}
	prompt, err := h.svc.UpdatePrompt(r.Context(), promptID, organizationID, usecase.UpdatePromptInput{
		Text:     req.Text,
		Language: req.Language,
		Intent:   req.Intent,
		Kind:     req.Kind,
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
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}
	var req bulkUpdatePromptStatusRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
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
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
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
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}
	var req addCompetitorsRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
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
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
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
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}
	var req updateCompetitorRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
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
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}
	if err := h.svc.DeleteCompetitor(r.Context(), competitorID, organizationID); err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, map[string]bool{"deleted": true})
}

func (h *Handler) listLLMProviderCredentials(w http.ResponseWriter, r *http.Request) {
	projectID := strings.TrimSpace(r.URL.Query().Get("projectId"))
	if projectID == "" {
		httpjson.WriteError(w, http.StatusBadRequest, "projectId is required")
		return
	}
	h.listLLMProviderCredentialsForProject(w, r, projectID)
}

func (h *Handler) listLLMProviderCredentialsForProject(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}
	credentials, err := h.svc.ListLLMProviderCredentials(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, credentials)
}

type updateLLMProviderCredentialRequest struct {
	APIKey string `json:"apiKey"`
}

func (h *Handler) updateLLMProviderCredential(w http.ResponseWriter, r *http.Request) {
	projectID := strings.TrimSpace(r.URL.Query().Get("projectId"))
	if projectID == "" {
		httpjson.WriteError(w, http.StatusBadRequest, "projectId is required")
		return
	}
	h.updateLLMProviderCredentialForProject(w, r, projectID, r.PathValue("provider"))
}

func (h *Handler) updateLLMProviderCredentialForProject(w http.ResponseWriter, r *http.Request, projectID string, provider string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}
	provider = strings.TrimSpace(provider)
	if provider == "" {
		httpjson.WriteError(w, http.StatusBadRequest, "invalid provider")
		return
	}

	var req updateLLMProviderCredentialRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	credential, err := h.svc.SaveLLMProviderCredential(r.Context(), projectID, organizationID, provider, req.APIKey)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, credential)
}

func (h *Handler) deleteLLMProviderCredential(w http.ResponseWriter, r *http.Request) {
	projectID := strings.TrimSpace(r.URL.Query().Get("projectId"))
	if projectID == "" {
		httpjson.WriteError(w, http.StatusBadRequest, "projectId is required")
		return
	}
	h.deleteLLMProviderCredentialForProject(w, r, projectID, r.PathValue("provider"))
}

func (h *Handler) deleteLLMProviderCredentialForProject(w http.ResponseWriter, r *http.Request, projectID string, provider string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}
	provider = strings.TrimSpace(provider)
	if provider == "" {
		httpjson.WriteError(w, http.StatusBadRequest, "invalid provider")
		return
	}

	credential, err := h.svc.DeleteLLMProviderCredential(r.Context(), projectID, organizationID, provider)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, credential)
}

func (h *Handler) listProjectModels(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
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
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}
	var req replaceProjectModelsRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}
	result, err := h.svc.ReplaceProjectModels(r.Context(), projectID, organizationID, req.ModelIDs)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, result)
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
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
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
	case errors.Is(err, usecase.ErrUnauthorized):
		httpjson.WriteForbiddenError(w)
	case errors.Is(err, usecase.ErrNotFound):
		httpjson.WriteNotFoundError(w)
	case errors.Is(err, usecase.ErrQuotaExceeded):
		httpjson.WriteQuotaExceeded(w)
	case errors.Is(err, usecase.ErrDependencyUnavailable):
		httpjson.WriteError(w, http.StatusServiceUnavailable, userFacingDependencyError(err))
	default:
		httpjson.WriteInternalError(w)
	}
}

func userFacingDependencyError(err error) string {
	message := err.Error()
	normalized := strings.ToLower(message)
	if strings.Contains(normalized, "invalid_grant") || strings.Contains(normalized, "invalid grant") {
		return "La tentative de connexion Google Analytics a expiré ou a déjà été utilisée. Relance la connexion Google."
	}
	if strings.Contains(normalized, "did not return a refresh token") ||
		strings.Contains(normalized, "missing refresh_token") ||
		strings.Contains(normalized, "missing refresh token") {
		return "Google n'a pas fourni de jeton de connexion durable. Relance la connexion Google Analytics et accepte de nouveau l'accès."
	}
	if strings.Contains(normalized, "ga4 oauth") || strings.Contains(normalized, "google oauth") {
		return "Connexion Google Analytics momentanément indisponible. Réessaie dans quelques instants."
	}
	return message
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

func hasOrganizationFullAccess(r *http.Request) bool {
	value := strings.TrimSpace(r.Header.Get("X-Organization-Full-Access"))
	if value == "" {
		value = strings.TrimSpace(r.Header.Get("x-organization-full-access"))
	}
	switch strings.ToLower(value) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func decodeJSON(w http.ResponseWriter, r *http.Request, out any) error {
	return httpjson.DecodeJSON(w, r, out)
}

func writeSuccess(w http.ResponseWriter, status int, data any) {
	httpjson.WriteSuccess(w, status, data)
}
