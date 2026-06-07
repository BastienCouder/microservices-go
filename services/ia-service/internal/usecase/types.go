package usecase

import (
	"context"
	"errors"
	"sync"
)

var (
	ErrValidation   = errors.New("validation error")
	ErrUnknownModel = errors.New("unknown model")
)

type ExecutionMode string

const (
	ExecutionModeMock     ExecutionMode = "mock"
	ExecutionModeProvider ExecutionMode = "provider"
)

type PromptMode string

const (
	PromptModeOrganic PromptMode = "organic"
	PromptModeGuided  PromptMode = "guided"
)

type ExecutePromptInput struct {
	PromptID       string
	PromptText     string
	ModelID        string
	ProviderID     string
	ProviderAPIKey string
	PromptMode     PromptMode
	BrandName      string
	Competitors    []string
	MockResponse   string
}

type PromptExecutionMetadata struct {
	TokensUsed int `json:"tokensUsed"`
	LatencyMs  int `json:"latencyMs"`
}

type CompetitorDetected struct {
	Name string `json:"name"`
}

type PromptExecutionAnalysis struct {
	BrandMentioned      bool                 `json:"brandMentioned"`
	BrandPosition       string               `json:"brandPosition,omitempty"`
	CitationFound       bool                 `json:"citationFound"`
	CitedURLs           []string             `json:"citedUrls"`
	CompetitorsDetected []CompetitorDetected `json:"competitorsDetected"`
	Sentiment           string               `json:"sentiment"`
}

type ExecutePromptResult struct {
	PromptID    string                  `json:"promptId"`
	ModelID     string                  `json:"modelId"`
	RawResponse string                  `json:"rawResponse"`
	RawMetadata PromptExecutionMetadata `json:"rawMetadata"`
	Analysis    PromptExecutionAnalysis `json:"analysis"`
}

type ExtractBrandInput struct {
	ProjectID  string
	WebsiteURL string
}

type ExtractBrandResult struct {
	ProjectID        string   `json:"projectId"`
	BrandName        string   `json:"brandName"`
	BrandDescription string   `json:"brandDescription"`
	Industry         string   `json:"industry"`
	Keywords         []string `json:"keywords"`
	Language         string   `json:"language"`
	Country          string   `json:"country"`
}

type ProviderResult struct {
	RawResponse string
	TokensUsed  int
}

const (
	AIModelSourceManual     = "manual"
	AIModelSourceOpenRouter = "openrouter"
)

type AIModel struct {
	ID                    string         `json:"id"`
	Label                 string         `json:"displayName"`
	Provider              string         `json:"provider"`
	Group                 string         `json:"groupName"`
	IconKey               string         `json:"-"`
	IconPath              string         `json:"iconPath"`
	ModelID               string         `json:"providerModelId"`
	Source                string         `json:"source,omitempty"`
	IsActive              bool           `json:"isActive"`
	SupportsLiveSearch    bool           `json:"supportsLiveSearch"`
	CreditCost            int            `json:"creditCost"`
	InputPricePerMillion  *float64       `json:"inputPricePerMillion,omitempty"`
	OutputPricePerMillion *float64       `json:"outputPricePerMillion,omitempty"`
	OpenRouterPricing     map[string]any `json:"openRouterPricing,omitempty"`
}

type CreateAIModelInput struct {
	ID                 string
	Label              string
	Provider           string
	Group              string
	IconKey            string
	ModelID            string
	IsActive           bool
	SupportsLiveSearch bool
}

type UpdateAIModelInput struct {
	Label              *string
	Provider           *string
	Group              *string
	IconKey            *string
	ModelID            *string
	IsActive           *bool
	SupportsLiveSearch *bool
}

type SyncOpenRouterModelsInput struct {
	OnlyFree                  bool
	MinContext                int
	SupportsTools             bool
	Variant                   string
	Providers                 []string
	SearchQuery               string
	ActivateImported          bool
	PurgeUnsupportedProviders bool
	PurgeMissingModels        bool
}

type SyncOpenRouterModelsResult struct {
	Imported int       `json:"imported"`
	Created  int       `json:"created"`
	Updated  int       `json:"updated"`
	Purged   int       `json:"purged"`
	Models   []AIModel `json:"models"`
}

type ModelCatalogStore interface {
	LoadModels(ctx context.Context) (map[string]AIModel, error)
	SaveModels(ctx context.Context, models map[string]AIModel) error
}

type ProviderGenerateInput struct {
	ProviderID string
	ModelID    string
	APIKey     string
	Prompt     string
}

type PromptProvider interface {
	Generate(ctx context.Context, input ProviderGenerateInput) (ProviderResult, error)
}

type Dependencies struct {
	Mode         ExecutionMode
	Provider     PromptProvider
	CatalogStore ModelCatalogStore
}

type Service struct {
	mu              sync.RWMutex
	supportedModels map[string]struct{}
	models          map[string]AIModel
	mode            ExecutionMode
	provider        PromptProvider
	catalogStore    ModelCatalogStore
}
