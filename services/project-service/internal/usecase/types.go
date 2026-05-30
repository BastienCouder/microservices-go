package usecase

import (
	"context"
	"errors"
	"time"
)

var (
	ErrValidation            = errors.New("validation error")
	ErrUnauthorized          = errors.New("unauthorized")
	ErrNotFound              = errors.New("not found")
	ErrDependencyUnavailable = errors.New("dependency unavailable")
)

const (
	PromptStatusActive   = "active"
	PromptStatusDisabled = "disabled"
	PromptStatusArchived = "archived"

	PromptKindMonitoring = "monitoring"
	PromptKindPerception = "perception"

	PromptScheduleModeGlobal   = "global"
	PromptScheduleModePerModel = "per_model"
	DefaultPromptCron          = "0 */6 * * *"
	DefaultPromptTimezone      = "UTC"

	OutboxEventTypeProjectFinalized = "project.finalized"

	OutboxStatusPending    = "pending"
	OutboxStatusPublished  = "published"
	OutboxStatusProcessing = "processing"
	OutboxStatusProcessed  = "processed"
)

type Project struct {
	ID                string    `json:"id"`
	OrganizationID    int64     `json:"organizationId"`
	CreatedBy         int64     `json:"createdBy"`
	Name              string    `json:"name"`
	Domain            string    `json:"domain"`
	WebsiteURL        string    `json:"websiteUrl"`
	AttributionSource string    `json:"attributionSource,omitempty"`
	BrandName         string    `json:"brandName,omitempty"`
	BrandDescription  string    `json:"brandDescription,omitempty"`
	Industry          string    `json:"industry,omitempty"`
	PrimaryLanguage   string    `json:"primaryLanguage"`
	Country           string    `json:"country"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

type ProjectMember struct {
	ProjectID      string    `json:"projectId"`
	OrganizationID int64     `json:"organizationId"`
	UserID         int64     `json:"userId"`
	Role           string    `json:"role"`
	AddedAt        time.Time `json:"addedAt"`
}

type ProjectImpactIntegrations struct {
	ProjectID string                      `json:"projectId"`
	GA4       ProjectGA4Integration       `json:"ga4"`
	Stripe    ProjectStripeIntegration    `json:"stripe"`
	Ingestion ProjectIngestionIntegration `json:"ingestion"`
}

type ProjectGA4Integration struct {
	PropertyID         string    `json:"propertyId,omitempty"`
	ServiceAccountJSON string    `json:"serviceAccountJSON,omitempty"`
	OAuthRefreshToken  string    `json:"oauthRefreshToken,omitempty"`
	ConnectedAt        time.Time `json:"connectedAt,omitempty"`
	UpdatedAt          time.Time `json:"updatedAt,omitempty"`
}

type ProjectStripeIntegration struct {
	WebhookSecret string    `json:"webhookSecret,omitempty"`
	ConnectedAt   time.Time `json:"connectedAt,omitempty"`
	UpdatedAt     time.Time `json:"updatedAt,omitempty"`
}

type ProjectIngestionIntegration struct {
	SigningToken string    `json:"signingToken,omitempty"`
	ConnectedAt  time.Time `json:"connectedAt,omitempty"`
	UpdatedAt    time.Time `json:"updatedAt,omitempty"`
}

type ProjectImpactIntegrationsView struct {
	ProjectID string                          `json:"projectId"`
	GA4       ProjectGA4IntegrationView       `json:"ga4"`
	Stripe    ProjectStripeIntegrationView    `json:"stripe"`
	Ingestion ProjectIngestionIntegrationView `json:"ingestion"`
}

type ProjectGA4IntegrationView struct {
	PropertyID        string    `json:"propertyId,omitempty"`
	AuthMode          string    `json:"authMode,omitempty"`
	HasServiceAccount bool      `json:"hasServiceAccount"`
	HasOAuthToken     bool      `json:"hasOAuthToken"`
	IsConnected       bool      `json:"isConnected"`
	ConnectedAt       time.Time `json:"connectedAt,omitempty"`
	UpdatedAt         time.Time `json:"updatedAt,omitempty"`
}

type ProjectStripeIntegrationView struct {
	HasWebhookSecret bool      `json:"hasWebhookSecret"`
	IsConnected      bool      `json:"isConnected"`
	WebhookPath      string    `json:"webhookPath"`
	ConnectedAt      time.Time `json:"connectedAt,omitempty"`
	UpdatedAt        time.Time `json:"updatedAt,omitempty"`
}

type ProjectIngestionIntegrationView struct {
	HasSigningToken bool      `json:"hasSigningToken"`
	IsConnected     bool      `json:"isConnected"`
	IngestPath      string    `json:"ingestPath"`
	ConnectedAt     time.Time `json:"connectedAt,omitempty"`
	UpdatedAt       time.Time `json:"updatedAt,omitempty"`
	GeneratedToken  string    `json:"generatedToken,omitempty"`
}

type ProjectImpactContext struct {
	ProjectID      string                    `json:"projectId"`
	OrganizationID int64                     `json:"organizationId"`
	Domain         string                    `json:"domain"`
	WebsiteURL     string                    `json:"websiteUrl"`
	Integrations   ProjectImpactIntegrations `json:"integrations"`
}

type LLMProviderCredentialStatus struct {
	ProjectID string    `json:"projectId,omitempty"`
	Provider  string    `json:"provider"`
	HasAPIKey bool      `json:"hasApiKey"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type LLMProviderCredentialRecord struct {
	APIKey    string    `json:"apiKey,omitempty"`
	HasAPIKey bool      `json:"hasApiKey"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Prompt struct {
	ID        string         `json:"id"`
	ProjectID string         `json:"projectId"`
	Text      string         `json:"text"`
	Intent    string         `json:"intent,omitempty"`
	Kind      string         `json:"kind"`
	ModelIDs  []string       `json:"modelIds,omitempty"`
	Schedule  PromptSchedule `json:"schedule"`
	Status    string         `json:"status"`
	IsActive  bool           `json:"isActive"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
}

type PromptSchedule struct {
	Mode       string            `json:"mode"`
	Cron       string            `json:"cron"`
	Timezone   string            `json:"timezone"`
	ModelCrons map[string]string `json:"modelCrons,omitempty"`
}

type ScheduledAnalysisJob struct {
	ProjectID           string                                      `json:"projectId"`
	ProjectName         string                                      `json:"projectName"`
	OrganizationID      int64                                       `json:"organizationId"`
	CreatedBy           int64                                       `json:"createdBy"`
	BrandName           string                                      `json:"brandName"`
	Competitors         []string                                    `json:"competitors"`
	PromptID            string                                      `json:"promptId"`
	PromptText          string                                      `json:"promptText"`
	ModelIDs            []string                                    `json:"modelIds"`
	ProviderCredentials map[string]ScheduledModelProviderCredential `json:"providerCredentials,omitempty"`
	Schedule            PromptSchedule                              `json:"schedule"`
}

type ScheduledModelProviderCredential struct {
	ProviderID      string `json:"providerId"`
	ProviderModelID string `json:"providerModelId"`
	ProviderAPIKey  string `json:"providerApiKey,omitempty"`
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

type ProjectModelSelection struct {
	AIModel
	IsEnabledForProject bool `json:"isEnabledForProject"`
}

type CreateProjectInput struct {
	OrganizationID    int64
	CreatedBy         int64
	Name              string
	Domain            string
	WebsiteURL        string
	AttributionSource string
	BrandName         string
	BrandDescription  string
	Industry          string
	PrimaryLanguage   string
	Country           string
}

type UpdateProjectInput struct {
	Name              *string
	Domain            *string
	WebsiteURL        *string
	AttributionSource *string
	BrandName         *string
	BrandDescription  *string
	Industry          *string
}

type UpdateProjectImpactIntegrationsInput struct {
	GA4       *UpdateProjectGA4IntegrationInput
	Stripe    *UpdateProjectStripeIntegrationInput
	Ingestion *UpdateProjectIngestionIntegrationInput
}

type UpdateProjectGA4IntegrationInput struct {
	PropertyID         *string
	ServiceAccountJSON *string
	Disconnect         bool
}

type GA4OAuthProperty struct {
	PropertyID  string `json:"propertyId"`
	DisplayName string `json:"displayName"`
	AccountName string `json:"accountName,omitempty"`
}

type GA4OAuthToken struct {
	RefreshToken string
}

type GA4LLMSetupProvider interface {
	SetupLLMTracking(ctx context.Context, refreshToken, propertyID string) (GA4LLMSetupResult, error)
	SetupLLMTrackingWithServiceAccount(ctx context.Context, serviceAccountJSON, propertyID string) (GA4LLMSetupResult, error)
}

type GA4OAuthProvider interface {
	AuthorizationURL(state, redirectURI string) (string, error)
	ExchangeCode(ctx context.Context, code, redirectURI string) (GA4OAuthToken, error)
	ListProperties(ctx context.Context, refreshToken string) ([]GA4OAuthProperty, error)
	GA4LLMSetupProvider
}

const (
	GA4LLMSetupStatusSuccess        = "success"
	GA4LLMSetupStatusPartialSuccess = "partial_success"
	GA4LLMSetupStatusFailed         = "failed"
)

type GA4LLMSetupResult struct {
	SetupStatus      string               `json:"setupStatus"`
	CreatedResources GA4LLMSetupResources `json:"createdResources"`
	Errors           []GA4LLMSetupError   `json:"errors,omitempty"`
}

type GA4LLMSetupResources struct {
	ChannelGroupName    string `json:"channelGroupName,omitempty"`
	CustomDimensionName string `json:"customDimensionName,omitempty"`
}

type GA4LLMSetupError struct {
	Resource string `json:"resource"`
	Message  string `json:"message"`
}

type UpdateProjectImpactIntegrationsResult struct {
	Integration ProjectImpactIntegrationsView `json:"integration"`
	LLMSetup    GA4LLMSetupResult             `json:"llmSetup,omitempty"`
}

type StartProjectGA4OAuthInput struct {
	RedirectURI string
}

type StartProjectGA4OAuthResult struct {
	AuthorizationURL string `json:"authorizationUrl"`
	State            string `json:"state"`
}

type CompleteProjectGA4OAuthInput struct {
	Code        string
	State       string
	RedirectURI string
	PropertyID  string
}

type CompleteProjectGA4OAuthResult struct {
	Integration ProjectImpactIntegrationsView `json:"integration"`
	Properties  []GA4OAuthProperty            `json:"properties"`
	LLMSetup    GA4LLMSetupResult             `json:"llmSetup,omitempty"`
}

type SelectProjectGA4OAuthPropertyInput struct {
	PropertyID string
}

type SelectProjectGA4OAuthPropertyResult struct {
	Integration ProjectImpactIntegrationsView `json:"integration"`
	LLMSetup    GA4LLMSetupResult             `json:"llmSetup,omitempty"`
}

type UpdateProjectStripeIntegrationInput struct {
	WebhookSecret *string
	Disconnect    bool
}

type UpdateProjectIngestionIntegrationInput struct {
	Rotate     bool
	Disconnect bool
}

type UpdatePromptInput struct {
	Text     *string
	Intent   *string
	Kind     *string
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

type BillingEntitlements struct {
	Plan                    string `json:"plan"`
	ModelSelectionLimit     int    `json:"modelSelectionLimit"`
	MonthlyModelChangeLimit int    `json:"monthlyModelChangeLimit"`
	MaxProjects             int    `json:"maxProjects"`
}

type CreditCostRule struct {
	MinPricePerMillion float64 `json:"minPricePerMillion"`
	CreditCost         int     `json:"creditCost"`
}

type CreditCostSettings struct {
	DefaultCreditCost int              `json:"defaultCreditCost"`
	Rules             []CreditCostRule `json:"rules"`
}

type ProjectModelSelectionChangeUsage struct {
	Month string `json:"month"`
	Count int    `json:"count"`
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
	RequestID          string
	OrganizationID     int64
	CreatedBy          int64
	ProjectID          string
	PromptTexts        []AnalysisPromptText
	ModelIDs           []string
	ModelCreditCostSum int
	RequestedCredits   int
	RunType            string
}

type AnalysisStartResponse struct {
	RunID      string
	PromptRuns []AnalysisPromptRun
}

type RunManualAnalysisInput struct {
	RequestID   string
	PromptTexts []AnalysisPromptText
	ModelIDs    []string
	RunType     string
}

type RunPerceptionAnalysisInput struct {
	RequestID string
	Force     bool
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

type PromptMode string

const (
	PromptModeOrganic PromptMode = "organic"
	PromptModeGuided  PromptMode = "guided"
)

type IAExecutePromptInput struct {
	PromptID       string
	PromptText     string
	ModelID        string
	ProviderID     string
	ProviderAPIKey string
	PromptMode     PromptMode
	BrandName      string
	Competitors    []string
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

type AttributionEventInput struct {
	ProjectID      string
	OrganizationID int64
	UserID         int64
	Stage          string
	Source         string
	Count          int64
	RevenueCents   int64
	OccurredAt     time.Time
}

type AttributionClient interface {
	RecordEvent(ctx context.Context, input AttributionEventInput) error
}

type BillingClient interface {
	GetOrganizationEntitlements(ctx context.Context, organizationID int64) (BillingEntitlements, error)
	GetCreditCostSettings(ctx context.Context) (CreditCostSettings, error)
}

type StateStore interface {
	Load(ctx context.Context) ([]byte, bool, error)
	Save(ctx context.Context, payload []byte) error
}

type Dependencies struct {
	Store             StateStore
	AnalysisClient    AnalysisClient
	IAClient          IAClient
	AttributionClient AttributionClient
	BillingClient     BillingClient
}

type persistedState struct {
	Seq                   int64                                              `json:"seq"`
	Projects              map[string]*Project                                `json:"projects"`
	Prompts               map[string]*Prompt                                 `json:"prompts"`
	Competitors           map[string]*Competitor                             `json:"competitors"`
	Models                map[string]AIModel                                 `json:"models"`
	ProjectModels         map[string]map[string]bool                         `json:"projectModels"`
	ProjectMembers        map[string]map[int64]*ProjectMember                `json:"projectMembers"`
	ModelSelectionChanges map[string]ProjectModelSelectionChangeUsage        `json:"modelSelectionChanges"`
	ImpactIntegrations    map[string]*ProjectImpactIntegrations              `json:"impactIntegrations"`
	ProviderCredentials   map[string]map[string]*LLMProviderCredentialRecord `json:"providerCredentials"`
	Outbox                map[string]*OutboxEvent                            `json:"outbox"`
	OutboxOrder           []string                                           `json:"outboxOrder"`
}
