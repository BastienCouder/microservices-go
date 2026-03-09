package usecase

import (
	"context"
	"errors"
	"time"
)

var (
	ErrValidation   = errors.New("validation error")
	ErrUnauthorized = errors.New("unauthorized")
	ErrNotFound     = errors.New("not found")
)

const (
	PromptStatusActive   = "active"
	PromptStatusDisabled = "disabled"
	PromptStatusArchived = "archived"

	PromptScheduleModeGlobal   = "global"
	PromptScheduleModePerModel = "per_model"
	DefaultPromptCron         = "0 */6 * * *"
	DefaultPromptTimezone     = "UTC"

	OutboxEventTypeProjectFinalized = "project.finalized"

	OutboxStatusPending    = "pending"
	OutboxStatusPublished  = "published"
	OutboxStatusProcessing = "processing"
	OutboxStatusProcessed  = "processed"
)

type Project struct {
	ID               string    `json:"id"`
	OrganizationID   int64     `json:"organizationId"`
	CreatedBy        int64     `json:"createdBy"`
	Name             string    `json:"name"`
	Domain           string    `json:"domain"`
	WebsiteURL       string    `json:"websiteUrl"`
	BrandName        string    `json:"brandName,omitempty"`
	BrandDescription string    `json:"brandDescription,omitempty"`
	Industry         string    `json:"industry,omitempty"`
	PrimaryLanguage  string    `json:"primaryLanguage"`
	Country          string    `json:"country"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

type Prompt struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"projectId"`
	Text      string    `json:"text"`
	Intent    string    `json:"intent,omitempty"`
	ModelIDs  []string  `json:"modelIds,omitempty"`
	Schedule  PromptSchedule `json:"schedule"`
	Status    string    `json:"status"`
	IsActive  bool      `json:"isActive"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type PromptSchedule struct {
	Mode       string            `json:"mode"`
	Cron       string            `json:"cron"`
	Timezone   string            `json:"timezone"`
	ModelCrons map[string]string `json:"modelCrons,omitempty"`
}

type Competitor struct {
	ID         string    `json:"id"`
	ProjectID  string    `json:"projectId"`
	Name       string    `json:"name"`
	Domain     string    `json:"domain,omitempty"`
	WebsiteURL string    `json:"websiteUrl,omitempty"`
	IsActive   bool      `json:"isActive"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type AIModel struct {
	ID                 string `json:"id"`
	Label              string `json:"displayName"`
	Provider           string `json:"provider"`
	Group              string `json:"groupName"`
	IconKey            string `json:"-"`
	IconPath           string `json:"iconPath"`
	ModelID            string `json:"providerModelId"`
	IsActive           bool   `json:"isActive"`
	SupportsLiveSearch bool   `json:"supportsLiveSearch"`
}

type ProjectModelSelection struct {
	AIModel
	IsEnabledForProject bool `json:"isEnabledForProject"`
}

type CreateProjectInput struct {
	OrganizationID   int64
	CreatedBy        int64
	Name             string
	Domain           string
	WebsiteURL       string
	BrandName        string
	BrandDescription string
	Industry         string
	PrimaryLanguage  string
	Country          string
}

type UpdateProjectInput struct {
	Name             *string
	Domain           *string
	WebsiteURL       *string
	BrandName        *string
	BrandDescription *string
	Industry         *string
}

type UpdatePromptInput struct {
	Text     *string
	Intent   *string
	ModelIDs *[]string
	Schedule *PromptSchedule
	Status   *string
	IsActive *bool
}

type UpdatePromptsStatusInput struct {
	PromptIDs []string
	Status    string
}

type ListPromptsInput struct {
	Search   string
	Page     int
	PageSize int
}

type PromptPage struct {
	Items       []Prompt `json:"items"`
	Total       int      `json:"total"`
	Page        int      `json:"page"`
	PageSize    int      `json:"pageSize"`
	TotalPages  int      `json:"totalPages"`
	HasNext     bool     `json:"hasNext"`
	HasPrevious bool     `json:"hasPrevious"`
}

type AddCompetitorInput struct {
	Name       string `json:"name"`
	Domain     string `json:"domain,omitempty"`
	WebsiteURL string `json:"websiteUrl,omitempty"`
}

type UpdateCompetitorInput struct {
	Name       *string
	Domain     *string
	WebsiteURL *string
	IsActive   *bool
}

type FinalizeResult struct {
	Project     Project `json:"project"`
	PromptCount int     `json:"promptCount"`
	ModelCount  int     `json:"modelCount"`
}

type ReplaceProjectModelsResult struct {
	ProjectID string   `json:"projectId"`
	ModelIDs  []string `json:"modelIds"`
	Count     int      `json:"count"`
}

type AnalysisPromptText struct {
	ID       string   `json:"id"`
	Text     string   `json:"text"`
	ModelIDs []string `json:"modelIds,omitempty"`
}

type AnalysisPromptRun struct {
	ID         string `json:"id"`
	PromptID   string `json:"promptId"`
	PromptText string `json:"promptText"`
}

type AnalysisStartRequest struct {
	RequestID   string
	OrganizationID int64
	CreatedBy   int64
	ProjectID   string
	PromptTexts []AnalysisPromptText
	ModelIDs    []string
	RunType     string
}

type AnalysisStartResponse struct {
	RunID      string
	PromptRuns []AnalysisPromptRun
}

type AnalysisRecordResponseInput struct {
	PromptRunID    string
	ModelID        string
	RawResponse    string
	BrandMentioned bool
	BrandPosition  string
	CitationFound  bool
	CitedURLs      []string
	Sentiment      string
}

type IAExecutePromptInput struct {
	PromptID    string
	PromptText  string
	ModelID     string
	BrandName   string
	Competitors []string
}

type IAExecutePromptResult struct {
	RawResponse string
	Analysis    struct {
		BrandMentioned bool
		BrandPosition  string
		CitationFound  bool
		CitedURLs      []string
		Sentiment      string
	}
}

type FinalizePipelinePayload struct {
	Project     Project              `json:"project"`
	Prompts     []AnalysisPromptText `json:"prompts"`
	ModelIDs    []string             `json:"modelIds"`
	Competitors []string             `json:"competitors"`
}

type OutboxEvent struct {
	ID        string                  `json:"id"`
	EventType string                  `json:"eventType"`
	Status    string                  `json:"status"`
	Payload   FinalizePipelinePayload `json:"payload"`
	CreatedAt time.Time               `json:"createdAt"`
	UpdatedAt time.Time               `json:"updatedAt"`
}

type AnalysisClient interface {
	StartAnalysis(ctx context.Context, req AnalysisStartRequest) (AnalysisStartResponse, error)
	RecordResponse(ctx context.Context, runID string, input AnalysisRecordResponseInput) error
}

type IAClient interface {
	ExecutePrompt(ctx context.Context, input IAExecutePromptInput) (IAExecutePromptResult, error)
}

type StateStore interface {
	Load(ctx context.Context) ([]byte, bool, error)
	Save(ctx context.Context, payload []byte) error
}

type Dependencies struct {
	Store          StateStore
	AnalysisClient AnalysisClient
	IAClient       IAClient
}

type persistedState struct {
	Seq           int64                      `json:"seq"`
	Projects      map[string]*Project        `json:"projects"`
	Prompts       map[string]*Prompt         `json:"prompts"`
	Competitors   map[string]*Competitor     `json:"competitors"`
	Models        map[string]AIModel         `json:"models"`
	ProjectModels map[string]map[string]bool `json:"projectModels"`
	Outbox        map[string]*OutboxEvent    `json:"outbox"`
	OutboxOrder   []string                   `json:"outboxOrder"`
}
