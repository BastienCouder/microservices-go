package http

import (
	"errors"
	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	"net/http"

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

	// Compatibility aliases.
	mux.HandleFunc("POST /execute", h.executePrompt)
	mux.HandleFunc("POST /extract-brand", h.extractBrand)
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
