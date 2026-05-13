package usecase

import (
	"context"
	"errors"
	"sync"
	"time"
)

var (
	ErrValidation            = errors.New("validation error")
	ErrUnauthorized          = errors.New("unauthorized")
	ErrNotFound              = errors.New("not found")
	ErrQuotaExceeded         = errors.New("quota exceeded")
	ErrDependencyUnavailable = errors.New("dependency unavailable")
)

type PromptText struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

type AnalysisRun struct {
	ID                 string    `json:"id"`
	ProjectID          string    `json:"projectId"`
	OrganizationID     int64     `json:"organizationId"`
	CreatedBy          int64     `json:"createdBy"`
	RunType            string    `json:"runType"`
	Status             string    `json:"status"`
	PromptsCount       int       `json:"promptsCount"`
	ModelsCount        int       `json:"modelsCount"`
	ExpectedResponses  int       `json:"expectedResponses"`
	CompletedResponses int       `json:"completedResponses"`
	VisibilityScore    int       `json:"visibilityScore"`
	CreatedAt          time.Time `json:"createdAt"`
	UpdatedAt          time.Time `json:"updatedAt"`
}

type PromptRun struct {
	ID         string    `json:"id"`
	RunID      string    `json:"runId"`
	PromptID   string    `json:"promptId"`
	PromptText string    `json:"promptText"`
	CreatedAt  time.Time `json:"createdAt"`
}

type AIResponse struct {
	ID             string    `json:"id"`
	RunID          string    `json:"runId"`
	PromptRunID    string    `json:"promptRunId"`
	ModelID        string    `json:"modelId"`
	RawResponse    string    `json:"rawResponse"`
	BrandMentioned bool      `json:"brandMentioned"`
	BrandPosition  string    `json:"brandPosition"`
	CitationFound  bool      `json:"citationFound"`
	CitedURLs      []string  `json:"citedUrls"`
	Sentiment      string    `json:"sentiment"`
	CreatedAt      time.Time `json:"createdAt"`
}

type StartAnalysisInput struct {
	RequestID      string
	OrganizationID int64
	CreatedBy      int64
	ProjectID      string
	PromptTexts    []PromptText
	ModelIDs       []string
	RunType        string
}

type StartAnalysisResult struct {
	AnalysisRun AnalysisRun `json:"analysisRun"`
	PromptRuns  []PromptRun `json:"promptRuns"`
}

type ResponseInput struct {
	RunID          string
	PromptRunID    string
	ModelID        string
	RawResponse    string
	BrandMentioned bool
	BrandPosition  string
	CitationFound  bool
	CitedURLs      []string
	Sentiment      string
}

type DashboardData struct {
	HasData         bool         `json:"hasData"`
	LatestRun       *AnalysisRun `json:"latestRun"`
	VisibilityScore int          `json:"visibilityScore"`
	PromptRuns      []PromptRun  `json:"promptRuns"`
	Responses       []AIResponse `json:"aiResponses"`
}

type PromptQuotaUsage struct {
	HasQuota         bool   `json:"hasQuota"`
	UsedPrompts      int    `json:"usedPrompts"`
	MonthlyQuota     int    `json:"monthlyQuota"`
	RemainingPrompts int    `json:"remainingPrompts"`
	CurrentMonth     string `json:"currentMonth"`
	IsLimitReached   bool   `json:"isLimitReached"`
}

type PerceptionScores struct {
	PositioningAccuracy int `json:"positioningAccuracy"`
	FactualAccuracy     int `json:"factualAccuracy"`
	SentimentScore      int `json:"sentimentScore"`
}

type PerceptionRadarPoint struct {
	Axis   string `json:"axis"`
	Label  string `json:"label"`
	Score  int    `json:"score"`
	Target int    `json:"target"`
}

type PerceptionError struct {
	ID               string   `json:"id"`
	Severity         string   `json:"severity"`
	Title            string   `json:"title"`
	Issue            string   `json:"issue"`
	Impact           string   `json:"impact"`
	DetectedInModels []string `json:"detectedInModels"`
	FixType          string   `json:"fixType"`
	GeneratedContent string   `json:"generatedContent"`
	OptimizePriority string   `json:"optimizePriority"`
	Type             string   `json:"type"`
}

type PerceptionData struct {
	Scores     PerceptionScores       `json:"scores"`
	Radar      []PerceptionRadarPoint `json:"radar"`
	TopErrors  []PerceptionError      `json:"topErrors"`
	BrandCanon BrandCanon             `json:"brandCanon"`
	Metadata   map[string]any         `json:"metadata"`
}

type OptimizationError struct {
	ID               string   `json:"id"`
	Source           string   `json:"source"`
	Severity         string   `json:"severity"`
	Title            string   `json:"title"`
	Issue            string   `json:"issue"`
	Impact           string   `json:"impact"`
	Type             string   `json:"type"`
	FixType          string   `json:"fixType"`
	OptimizePriority string   `json:"optimizePriority"`
	DetectedInModels []string `json:"detectedInModels"`
	GeneratedContent string   `json:"generatedContent"`
	CreatedAt        string   `json:"createdAt,omitempty"`
}

type OptimizationErrorColumn struct {
	Severity string              `json:"severity"`
	Title    string              `json:"title"`
	Count    int                 `json:"count"`
	Errors   []OptimizationError `json:"errors"`
}

type OptimizationErrorBoard struct {
	Errors   []OptimizationError       `json:"errors"`
	Columns  []OptimizationErrorColumn `json:"columns"`
	Metadata map[string]any            `json:"metadata"`
}

type BrandCanon struct {
	ProjectID   string         `json:"projectId,omitempty"`
	BrandName   string         `json:"brandName,omitempty"`
	Category    string         `json:"category,omitempty"`
	Positioning string         `json:"positioning,omitempty"`
	Audience    []string       `json:"audience,omitempty"`
	UseCases    []string       `json:"useCases,omitempty"`
	Pricing     map[string]any `json:"pricing,omitempty"`
	Features    []string       `json:"features,omitempty"`
	CreatedAt   time.Time      `json:"createdAt,omitempty"`
	UpdatedAt   time.Time      `json:"updatedAt,omitempty"`
}

type UpdateBrandCanonInput struct {
	BrandName   *string
	Category    *string
	Positioning *string
	Audience    *[]string
	UseCases    *[]string
	Pricing     *map[string]any
	Features    *[]string
}

type AnalysisRunDetails struct {
	AnalysisRun AnalysisRun  `json:"analysisRun"`
	PromptRuns  []PromptRun  `json:"promptRuns"`
	Responses   []AIResponse `json:"aiResponses"`
}

type Alert struct {
	ID          string    `json:"id"`
	ProjectID   string    `json:"projectId"`
	AlertType   string    `json:"alertType"`
	Severity    string    `json:"severity"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	IsRead      bool      `json:"isRead"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type CreateAlertInput struct {
	AlertType   string
	Severity    string
	Title       string
	Description string
}

type StateStore interface {
	Load(ctx context.Context) ([]byte, bool, error)
	Save(ctx context.Context, payload []byte) error
}

type DashboardCache interface {
	GetDashboard(ctx context.Context, projectID string, organizationID int64) (DashboardData, bool, error)
	SetDashboard(ctx context.Context, projectID string, organizationID int64, data DashboardData, ttl time.Duration) error
	DeleteDashboard(ctx context.Context, projectID string, organizationID int64) error
}

type ProjectAccessVerifier interface {
	EnsureProjectAccessible(ctx context.Context, projectID string, organizationID int64) error
}

type ProjectCompetitorsProvider interface {
	ListProjectCompetitors(ctx context.Context, projectID string, organizationID int64) ([]string, error)
}

type ProjectModelsProvider interface {
	ListProjectEnabledModels(ctx context.Context, projectID string, organizationID int64) ([]string, error)
}

type BillingQuotaProvider interface {
	GetMonthlyQuota(ctx context.Context, organizationID int64) (monthlyQuota int, found bool, err error)
}

type ContentCrawler interface {
	StartCrawl(ctx context.Context, input ContentOptimizerCrawlStartInput) (ContentOptimizerCrawlJob, error)
	GetCrawl(ctx context.Context, jobID string, input ContentOptimizerCrawlResultInput) (ContentOptimizerCrawlResult, error)
}

type Dependencies struct {
	Store              StateStore
	DashboardCache     DashboardCache
	DashboardCacheTTL  time.Duration
	ProjectVerifier    ProjectAccessVerifier
	ProjectCompetitors ProjectCompetitorsProvider
	ProjectModels      ProjectModelsProvider
	BillingQuota       BillingQuotaProvider
	ContentCrawler     ContentCrawler
}

type persistedState struct {
	Seq                 int64                                     `json:"seq"`
	Runs                map[string]*AnalysisRun                   `json:"runs"`
	RunsByProject       map[string][]string                       `json:"runsByProject"`
	PromptRuns          map[string]*PromptRun                     `json:"promptRuns"`
	PromptRunsByRun     map[string][]string                       `json:"promptRunsByRun"`
	Responses           map[string]*AIResponse                    `json:"responses"`
	ResponsesByRun      map[string][]string                       `json:"responsesByRun"`
	ResponseIndexByRun  map[string]map[string]string              `json:"responseIndexByRun"`
	RunByRequest        map[string]string                         `json:"runByRequest"`
	Alerts              map[string]*Alert                         `json:"alerts"`
	AlertsByProject     map[string][]string                       `json:"alertsByProject"`
	BrandCanonByProject map[string]*BrandCanon                    `json:"brandCanonByProject"`
	ContentCrawls       map[string]*ContentOptimizerCrawlSnapshot `json:"contentCrawls"`
}

type Service struct {
	mu                  sync.RWMutex
	now                 func() time.Time
	seq                 int64
	runs                map[string]*AnalysisRun
	runsByProject       map[string][]string
	promptRuns          map[string]*PromptRun
	promptRunsByRun     map[string][]string
	responses           map[string]*AIResponse
	responsesByRun      map[string][]string
	responseIndexByRun  map[string]map[string]string
	runByRequest        map[string]string
	alerts              map[string]*Alert
	alertsByProject     map[string][]string
	brandCanonByProject map[string]*BrandCanon
	contentCrawls       map[string]*ContentOptimizerCrawlSnapshot

	store              StateStore
	dashboardCache     DashboardCache
	dashboardCacheTTL  time.Duration
	projectVerifier    ProjectAccessVerifier
	projectCompetitors ProjectCompetitorsProvider
	projectModels      ProjectModelsProvider
	billingQuota       BillingQuotaProvider
	contentCrawler     ContentCrawler
}
