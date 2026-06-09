package http

import (
	"errors"
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/bastiencouder/microservices-go/services/ia-service/internal/usecase"
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
	mux.HandleFunc("POST /ai/execute", h.executePrompt)
	mux.HandleFunc("POST /ai/extract-brand", h.extractBrand)
	mux.HandleFunc("GET /ai-models", h.listModels)
	mux.HandleFunc("POST /ai-models", h.createModel)
	mux.HandleFunc("POST /ai-models/seed", h.seedModels)
	mux.HandleFunc("POST /ai-models/sync/openrouter", h.syncOpenRouterModels)
	mux.HandleFunc("/ai-models/", h.aiModelRoutes)

	// Compatibility aliases.
	mux.HandleFunc("POST /execute", h.executePrompt)
	mux.HandleFunc("POST /extract-brand", h.extractBrand)
}

func (h *Handler) aiModelRoutes(w http.ResponseWriter, r *http.Request) {
	parts := splitPathAfter(r.URL.EscapedPath(), "/ai-models/")
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

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "ia-service"})
}

func (h *Handler) ready(w http.ResponseWriter, _ *http.Request) {
	httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "ia-service"})
}

type executePromptRequest struct {
	PromptID       string   `json:"promptId"`
	PromptText     string   `json:"promptText"`
	ModelID        string   `json:"modelId"`
	ProviderID     string   `json:"providerId"`
	ProviderAPIKey string   `json:"providerApiKey"`
	PromptMode     string   `json:"promptMode"`
	BrandName      string   `json:"brandName"`
	Competitors    []string `json:"competitors"`
	MockResponse   string   `json:"mockResponse"`
}

func (h *Handler) executePrompt(w http.ResponseWriter, r *http.Request) {
	var req executePromptRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	result, err := h.svc.ExecutePrompt(r.Context(), usecase.ExecutePromptInput{
		PromptID:       req.PromptID,
		PromptText:     req.PromptText,
		ModelID:        req.ModelID,
		ProviderID:     req.ProviderID,
		ProviderAPIKey: req.ProviderAPIKey,
		PromptMode:     usecase.PromptMode(req.PromptMode),
		BrandName:      req.BrandName,
		Competitors:    req.Competitors,
		MockResponse:   req.MockResponse,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, result)
}

type extractBrandRequest struct {
	ProjectID  string `json:"projectId"`
	WebsiteURL string `json:"websiteUrl"`
}

func (h *Handler) extractBrand(w http.ResponseWriter, r *http.Request) {
	var req extractBrandRequest
	if err := decodeJSON(w, r, &req); err != nil {
		httpjson.WriteValidationError(w)
		return
	}

	result, err := h.svc.ExtractBrand(r.Context(), usecase.ExtractBrandInput{
		ProjectID:  req.ProjectID,
		WebsiteURL: req.WebsiteURL,
	})
	if err != nil {
		h.writeUsecaseError(w, err)
		return
	}
	writeSuccess(w, http.StatusOK, result)
}

func (h *Handler) listModels(w http.ResponseWriter, r *http.Request) {
	onlyActive := true
	if value := strings.TrimSpace(r.URL.Query().Get("active_only")); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
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

func (h *Handler) writeUsecaseError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, usecase.ErrUnknownModel):
		httpjson.WriteValidationError(w)
	case errors.Is(err, usecase.ErrValidation):
		httpjson.WriteValidationError(w)
	default:
		httpjson.WriteInternalError(w)
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

func splitPathAfter(path, prefix string) []string {
	if !strings.HasPrefix(path, prefix) {
		return nil
	}
	rest := strings.TrimPrefix(path, prefix)
	if rest == "" {
		return nil
	}
	return strings.Split(strings.Trim(rest, "/"), "/")
}
