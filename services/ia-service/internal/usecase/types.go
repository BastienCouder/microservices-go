package usecase

import (
	"context"
	"errors"
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

type ExecutePromptInput struct {
	PromptID       string
	PromptText     string
	ModelID        string
	ProviderID     string
	ProviderAPIKey string
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
	Mode     ExecutionMode
	Provider PromptProvider
}

type Service struct {
	supportedModels map[string]struct{}
	mode            ExecutionMode
	provider        PromptProvider
}
