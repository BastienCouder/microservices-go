package http

import (
	"context"
	"errors"
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	"net/http"
	"net/url"
	"strconv"
	"strings"

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
	mux.HandleFunc("/projects/", h.projectRoutes)
	mux.HandleFunc("/analysis/projects/", h.analysisProjectRoutes)
	mux.HandleFunc("/prompts/", h.promptRoutes)
	mux.HandleFunc("/competitors/", h.competitorRoutes)
	mux.HandleFunc("POST /ai-models", h.createModel)
	mux.HandleFunc("GET /ai-models", h.listModels)
	mux.HandleFunc("POST /ai-models/seed", h.seedModels)
	mux.HandleFunc("POST /ai-models/sync/openrouter", h.syncOpenRouterModels)
	mux.HandleFunc("/ai-models/", h.aiModelRoutes)
}

func (h *Handler) aiModelRoutes(w http.ResponseWriter, r *http.Request) {
	h.aiModelRoutesWithPrefix(w, r, "/ai-models/")
}

func (h *Handler) aiModelRoutesWithPrefix(w http.ResponseWriter, r *http.Request, prefix string) {
	parts := splitPathAfter(r.URL.EscapedPath(), prefix)
	if len(parts) != 1 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	modelID, err := url.PathUnescape(parts[0])
	if err != nil || strings.TrimSpace(modelID) == "" {
		httpjson.WriteError(w, http.StatusBadRequest, "invalid model id")
		return
	}

	switch r.Method {
	case http.MethodPatch:
		h.updateModel(w, r, modelID)
	default:
		http.NotFound(w, r)
	}
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
	BrandName         string `json:"brandName"`
	BrandDescription  string `json:"brandDescription"`
	Industry          string `json:"industry"`
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
		BrandName:         req.BrandName,
		BrandDescription:  req.BrandDescription,
		Industry:          req.Industry,
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
	if userID, ok := authenticatedUserID(r); ok {
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
	if organizationID, ok := authenticatedOrganizationID(r); ok {
		if !isProjectMembersRoute(parts) && !h.allowProjectRequest(w, r, projectID, organizationID) {
			return
		}
	}

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
	case len(parts) == 2 && parts[1] == "members" && r.Method == http.MethodPost:
		h.assignProjectMember(w, r, projectID)
	case len(parts) == 2 && parts[1] == "members" && r.Method == http.MethodGet:
		h.listProjectMembers(w, r, projectID)
	case len(parts) == 3 && parts[1] == "members" && r.Method == http.MethodDelete:
		h.removeProjectMember(w, r, projectID, parts[2])
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

func isProjectMembersRoute(parts []string) bool {
	return len(parts) >= 2 && parts[1] == "members"
}

func (h *Handler) allowProjectRequest(w http.ResponseWriter, r *http.Request, projectID string, organizationID int64) bool {
	if hasOrganizationFullAccess(r) {
		return true
	}
	userID, ok := authenticatedUserID(r)
	if !ok {
		return true
	}
	if err := h.svc.EnforceUserProjectAccess(r.Context(), projectID, organizationID, userID); err != nil {
		h.writeUsecaseError(w, err)
		return false
	}
	return true
}

func (h *Handler) allowPromptRequest(w http.ResponseWriter, r *http.Request, promptID string, organizationID int64) bool {
	userID, ok := authenticatedUserID(r)
	if !ok {
		return true
	}
	if err := h.svc.EnforceUserPromptAccess(r.Context(), promptID, organizationID, userID); err != nil {
		h.writeUsecaseError(w, err)
		return false
	}
	return true
}

func (h *Handler) allowCompetitorRequest(w http.ResponseWriter, r *http.Request, competitorID string, organizationID int64) bool {
	userID, ok := authenticatedUserID(r)
	if !ok {
		return true
	}
	if err := h.svc.EnforceUserCompetitorAccess(r.Context(), competitorID, organizationID, userID); err != nil {
		h.writeUsecaseError(w, err)
		return false
	}
	return true
}

type assignProjectMemberRequest struct {
	UserID int64  `json:"userId"`
	Role   string `json:"role"`
}

func (h *Handler) assignProjectMember(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	var req assignProjectMemberRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	member, err := h.svc.AssignProjectMember(r.Context(), projectID, organizationID, req.UserID, req.Role)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusCreated, member)
}

func (h *Handler) listProjectMembers(w http.ResponseWriter, r *http.Request, projectID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}

	members, err := h.svc.ListProjectMembers(r.Context(), projectID, organizationID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, members)
}

func (h *Handler) removeProjectMember(w http.ResponseWriter, r *http.Request, projectID string, rawUserID string) {
	organizationID, ok := authenticatedOrganizationID(r)
	if !ok {
		httpjson.WriteError(w, http.StatusUnauthorized, "missing organization identity")
		return
	}
	userID, err := strconv.ParseInt(strings.TrimSpace(rawUserID), 10, 64)
	if err != nil || userID <= 0 {
		httpjson.WriteError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	if err := h.svc.RemoveProjectMember(r.Context(), projectID, organizationID, userID); err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
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
	BrandName         *string `json:"brandName"`
	BrandDescription  *string `json:"brandDescription"`
	Industry          *string `json:"industry"`
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
		BrandName:         req.BrandName,
		BrandDescription:  req.BrandDescription,
		Industry:          req.Industry,
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
	contextValue, err := h.svc.GetProjectImpactContext(r.Context(), projectID)
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, contextValue)
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
	GA4       *updateProjectGA4IntegrationRequest       `json:"ga4"`
	Stripe    *updateProjectStripeIntegrationRequest    `json:"stripe"`
	Ingestion *updateProjectIngestionIntegrationRequest `json:"ingestion"`
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
	RequestID string `json:"requestId"`
	Force     bool   `json:"force"`
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
		Force:     req.Force,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusCreated, result)
}

type addPromptsRequest struct {
	Prompts []string `json:"prompts"`
	Kind    string   `json:"kind"`
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

	prompts, err := h.svc.AddPromptsWithKind(r.Context(), projectID, organizationID, req.Prompts, req.Kind)
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
	if !h.allowPromptRequest(w, r, promptID, organizationID) {
		return
	}
	var req updatePromptRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}
	prompt, err := h.svc.UpdatePrompt(r.Context(), promptID, organizationID, usecase.UpdatePromptInput{
		Text:     req.Text,
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
	if !h.allowPromptRequest(w, r, promptID, organizationID) {
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
	if !h.allowCompetitorRequest(w, r, competitorID, organizationID) {
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
	if !h.allowCompetitorRequest(w, r, competitorID, organizationID) {
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
	if !h.allowProjectRequest(w, r, projectID, organizationID) {
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
	if !h.allowProjectRequest(w, r, projectID, organizationID) {
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
	if !h.allowProjectRequest(w, r, projectID, organizationID) {
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

func (h *Handler) seedModels(w http.ResponseWriter, r *http.Request) {
	models, err := h.svc.SeedDefaultModels(r.Context())
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, models)
}

type syncOpenRouterModelsRequest struct {
	OnlyFree                  bool     `json:"onlyFree"`
	MinContext                int      `json:"minContext"`
	SupportsTools             bool     `json:"supportsTools"`
	Variant                   string   `json:"variant"`
	Providers                 []string `json:"providers"`
	SearchQuery               string   `json:"searchQuery"`
	ActivateImported          bool     `json:"activateImported"`
	PurgeUnsupportedProviders bool     `json:"purgeUnsupportedProviders"`
	PurgeMissingModels        bool     `json:"purgeMissingModels"`
}

func (h *Handler) syncOpenRouterModels(w http.ResponseWriter, r *http.Request) {
	var req syncOpenRouterModelsRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	result, err := h.svc.SyncOpenRouterModels(r.Context(), usecase.SyncOpenRouterModelsInput{
		OnlyFree:                  req.OnlyFree,
		MinContext:                req.MinContext,
		SupportsTools:             req.SupportsTools,
		Variant:                   req.Variant,
		Providers:                 req.Providers,
		SearchQuery:               req.SearchQuery,
		ActivateImported:          req.ActivateImported,
		PurgeUnsupportedProviders: req.PurgeUnsupportedProviders,
		PurgeMissingModels:        req.PurgeMissingModels,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, result)
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

type createAIModelRequest struct {
	ID                 string `json:"id"`
	Label              string `json:"displayName"`
	Provider           string `json:"provider"`
	Group              string `json:"groupName"`
	IconKey            string `json:"iconKey"`
	ModelID            string `json:"providerModelId"`
	IsActive           *bool  `json:"isActive"`
	SupportsLiveSearch bool   `json:"supportsLiveSearch"`
}

func (h *Handler) createModel(w http.ResponseWriter, r *http.Request) {
	var req createAIModelRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	model, err := h.svc.CreateModel(r.Context(), usecase.CreateAIModelInput{
		ID:                 req.ID,
		Label:              req.Label,
		Provider:           req.Provider,
		Group:              req.Group,
		IconKey:            req.IconKey,
		ModelID:            req.ModelID,
		IsActive:           isActive,
		SupportsLiveSearch: req.SupportsLiveSearch,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusCreated, model)
}

type updateAIModelRequest struct {
	Label              *string `json:"displayName"`
	Provider           *string `json:"provider"`
	Group              *string `json:"groupName"`
	IconKey            *string `json:"iconKey"`
	ModelID            *string `json:"providerModelId"`
	IsActive           *bool   `json:"isActive"`
	SupportsLiveSearch *bool   `json:"supportsLiveSearch"`
}

func (h *Handler) updateModel(w http.ResponseWriter, r *http.Request, modelID string) {
	var req updateAIModelRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	model, err := h.svc.UpdateModel(r.Context(), modelID, usecase.UpdateAIModelInput{
		Label:              req.Label,
		Provider:           req.Provider,
		Group:              req.Group,
		IconKey:            req.IconKey,
		ModelID:            req.ModelID,
		IsActive:           req.IsActive,
		SupportsLiveSearch: req.SupportsLiveSearch,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, model)
}

func (h *Handler) writeUsecaseError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, usecase.ErrValidation):
		httpjson.WriteValidationError(w)
	case errors.Is(err, usecase.ErrUnauthorized):
		httpjson.WriteForbiddenError(w)
	case errors.Is(err, usecase.ErrNotFound):
		httpjson.WriteNotFoundError(w)
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

func writeJSON(w http.ResponseWriter, status int, payload any) {
	httpjson.WriteSuccess(w, status, payload)
}
