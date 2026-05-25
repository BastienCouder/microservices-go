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
	StageVisit  = "visit"
	StageSignup = "signup"
	StageTrial  = "trial"
	StagePaid   = "paid"
)

const (
	TrafficDataSourceGA4  = "ga4"
	TrafficDataSourceFake = "fake"
)

type Event struct {
	ID           int64     `json:"id"`
	ProjectID    string    `json:"projectId"`
	Stage        string    `json:"stage"`
	Source       string    `json:"source"`
	Count        int64     `json:"count"`
	RevenueCents int64     `json:"revenueCents"`
	OccurredAt   time.Time `json:"occurredAt"`
	CreatedAt    time.Time `json:"createdAt"`
}

type RecordEventInput struct {
	ProjectID    string
	UserID       string
	Stage        string
	Source       string
	Count        int64
	RevenueCents int64
	OccurredAt   time.Time
}

type RecordInternalEventInput struct {
	ProjectID      string
	OrganizationID int64
	Stage          string
	Source         string
	Count          int64
	RevenueCents   int64
	OccurredAt     time.Time
}

type FunnelData struct {
	ProjectID         string         `json:"projectId"`
	Visits            int64          `json:"visits"`
	Signups           int64          `json:"signups"`
	Trials            int64          `json:"trials"`
	Paid              int64          `json:"paid"`
	RevenueCents      int64          `json:"revenueCents"`
	VisitToSignupRate int            `json:"visitToSignupRate"`
	SignupToTrialRate int            `json:"signupToTrialRate"`
	TrialToPaidRate   int            `json:"trialToPaidRate"`
	WindowStart       string         `json:"windowStart"`
	WindowEnd         string         `json:"windowEnd"`
	Sources           []FunnelSource `json:"sources,omitempty"`
	VisitsSource      string         `json:"visitsSource,omitempty"`
}

type TrafficDateRange struct {
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
}

type TrafficFilters struct {
	Search string `json:"search,omitempty"`
	Engine string `json:"engine,omitempty"`
}

type TrafficSummary struct {
	TotalTrafficSessions     int64   `json:"totalTrafficSessions"`
	TotalSessions            int64   `json:"totalSessions"`
	TrafficShareOfTotal      float64 `json:"trafficShareOfTotal"`
	TrafficEngagedSessions   int64   `json:"trafficEngagedSessions"`
	TrafficEngagementRate    float64 `json:"trafficEngagementRate"`
	TrafficAvgSessionSeconds float64 `json:"trafficAvgSessionSeconds"`
	TrafficBounceRate        float64 `json:"trafficBounceRate"`
	TrafficConversions       float64 `json:"trafficConversions"`
	TrafficConversionRate    float64 `json:"trafficConversionRate"`
	TrafficPageViews         int64   `json:"trafficPageViews"`
	TopEngine                string  `json:"topEngine"`
}

type TrafficSource struct {
	Source                 string  `json:"source"`
	Medium                 string  `json:"medium"`
	SourceMedium           string  `json:"sourceMedium,omitempty"`
	LandingPage            string  `json:"landingPage,omitempty"`
	Engine                 string  `json:"engine"`
	Sessions               int64   `json:"sessions"`
	EngagedSessions        int64   `json:"engagedSessions"`
	EngagementRate         float64 `json:"engagementRate"`
	BounceRate             float64 `json:"bounceRate"`
	AvgSessionSeconds      float64 `json:"avgSessionSeconds"`
	Conversions            float64 `json:"conversions"`
	PageViews              int64   `json:"pageViews"`
	ShareOfTrafficSessions float64 `json:"shareOfTrafficSessions"`
}

type TrafficPage struct {
	Path            string  `json:"path"`
	Title           string  `json:"title"`
	Source          string  `json:"source"`
	Engine          string  `json:"engine"`
	Sessions        int64   `json:"sessions"`
	EngagedSessions int64   `json:"engagedSessions"`
	EngagementRate  float64 `json:"engagementRate"`
	Conversions     float64 `json:"conversions"`
	PageViews       int64   `json:"pageViews"`
}

type TrafficDailyPoint struct {
	Date            string  `json:"date"`
	Sessions        int64   `json:"sessions"`
	EngagedSessions int64   `json:"engagedSessions"`
	Conversions     float64 `json:"conversions"`
}

type TrafficQuotaStatus struct {
	Consumed  int64 `json:"consumed"`
	Remaining int64 `json:"remaining"`
}

type TrafficPropertyQuota struct {
	TokensPerDay                  TrafficQuotaStatus `json:"tokensPerDay"`
	ServerErrorsPerProjectPerHour TrafficQuotaStatus `json:"serverErrorsPerProjectPerHour"`
}

type TrafficReport struct {
	ProjectID     string                `json:"projectId"`
	PropertyID    string                `json:"propertyId"`
	DataSource    string                `json:"dataSource"`
	DateRange     TrafficDateRange      `json:"dateRange"`
	GeneratedAt   string                `json:"generatedAt"`
	Summary       TrafficSummary        `json:"summary"`
	BySource      []TrafficSource       `json:"bySource"`
	TopPages      []TrafficPage         `json:"topPages"`
	Timeseries    []TrafficDailyPoint   `json:"timeseries"`
	PropertyQuota *TrafficPropertyQuota `json:"propertyQuota,omitempty"`
}

type FunnelSource struct {
	Source       string `json:"source"`
	Visits       int64  `json:"visits"`
	Signups      int64  `json:"signups"`
	Trials       int64  `json:"trials"`
	Paid         int64  `json:"paid"`
	RevenueCents int64  `json:"revenueCents"`
}

type Repository interface {
	InsertEvent(ctx context.Context, event Event) (Event, error)
	ListEvents(ctx context.Context, projectID string, from, to time.Time, limit int) ([]Event, error)
	GetFunnelTotals(ctx context.Context, projectID string, from, to time.Time) (FunnelTotals, error)
	GetSourceTotals(ctx context.Context, projectID string, from, to time.Time) ([]FunnelSource, error)
}

type FunnelTotals struct {
	Visits       int64
	Signups      int64
	Trials       int64
	Paid         int64
	RevenueCents int64
}

type ProjectAccessVerifier interface {
	EnsureProjectOwnedByUser(ctx context.Context, projectID, userID string) error
	EnsureProjectInOrganization(ctx context.Context, projectID string, organizationID int64) error
}

type ProjectMetadata struct {
	ID             string
	OrganizationID int64
	Domain         string
	WebsiteURL     string
	GA4            ProjectGA4Integration
	Stripe         ProjectStripeIntegration
	Ingestion      ProjectIngestionIntegration
}

type ProjectGA4Integration struct {
	PropertyID         string
	ServiceAccountJSON string
	OAuthRefreshToken  string
}

type ProjectStripeIntegration struct {
	WebhookSecret string
}

type ProjectIngestionIntegration struct {
	SigningToken string
}

type ProjectMetadataResolver interface {
	GetProject(ctx context.Context, projectID string, organizationID int64) (ProjectMetadata, error)
}

type RecordIngestionEventInput struct {
	ProjectID    string
	SigningToken string
	Stage        string
	Source       string
	Count        int64
	RevenueCents int64
	OccurredAt   time.Time
}

type VisitProvider interface {
	ListVisitsBySource(ctx context.Context, project ProjectMetadata, from, to time.Time) ([]FunnelSource, error)
}

type TrafficProvider interface {
	GetTrafficReport(ctx context.Context, project ProjectMetadata, from, to time.Time, filters TrafficFilters) (TrafficReport, error)
}

type Service struct {
	repo            Repository
	projectVerifier ProjectAccessVerifier
	projectResolver ProjectMetadataResolver
	visitProvider   VisitProvider
	trafficProvider TrafficProvider
	now             func() time.Time
}
