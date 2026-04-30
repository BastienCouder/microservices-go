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
	GeoTrafficDataSourceGA4  = "ga4"
	GeoTrafficDataSourceFake = "fake"
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

type GeoTrafficDateRange struct {
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
}

type GeoTrafficFilters struct {
	Search string `json:"search,omitempty"`
	Engine string `json:"engine,omitempty"`
}

type GeoTrafficSummary struct {
	TotalGeoSessions     int64   `json:"totalGeoSessions"`
	TotalSessions        int64   `json:"totalSessions"`
	GeoShareOfTotal      float64 `json:"geoShareOfTotal"`
	GeoEngagedSessions   int64   `json:"geoEngagedSessions"`
	GeoEngagementRate    float64 `json:"geoEngagementRate"`
	GeoAvgSessionSeconds float64 `json:"geoAvgSessionSeconds"`
	GeoBounceRate        float64 `json:"geoBounceRate"`
	GeoConversions       float64 `json:"geoConversions"`
	GeoConversionRate    float64 `json:"geoConversionRate"`
	GeoPageViews         int64   `json:"geoPageViews"`
	TopEngine            string  `json:"topEngine"`
}

type GeoTrafficSource struct {
	Source             string  `json:"source"`
	Medium             string  `json:"medium"`
	SourceMedium       string  `json:"sourceMedium,omitempty"`
	LandingPage        string  `json:"landingPage,omitempty"`
	Engine             string  `json:"engine"`
	Sessions           int64   `json:"sessions"`
	EngagedSessions    int64   `json:"engagedSessions"`
	EngagementRate     float64 `json:"engagementRate"`
	BounceRate         float64 `json:"bounceRate"`
	AvgSessionSeconds  float64 `json:"avgSessionSeconds"`
	Conversions        float64 `json:"conversions"`
	PageViews          int64   `json:"pageViews"`
	ShareOfGeoSessions float64 `json:"shareOfGeoSessions"`
}

type GeoTrafficPage struct {
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

type GeoTrafficDailyPoint struct {
	Date            string  `json:"date"`
	Sessions        int64   `json:"sessions"`
	EngagedSessions int64   `json:"engagedSessions"`
	Conversions     float64 `json:"conversions"`
}

type GeoQuotaStatus struct {
	Consumed  int64 `json:"consumed"`
	Remaining int64 `json:"remaining"`
}

type GeoPropertyQuota struct {
	TokensPerDay                  GeoQuotaStatus `json:"tokensPerDay"`
	ServerErrorsPerProjectPerHour GeoQuotaStatus `json:"serverErrorsPerProjectPerHour"`
}

type GeoTrafficReport struct {
	ProjectID     string                 `json:"projectId"`
	PropertyID    string                 `json:"propertyId"`
	DataSource    string                 `json:"dataSource"`
	DateRange     GeoTrafficDateRange    `json:"dateRange"`
	GeneratedAt   string                 `json:"generatedAt"`
	Summary       GeoTrafficSummary      `json:"summary"`
	BySource      []GeoTrafficSource     `json:"bySource"`
	TopPages      []GeoTrafficPage       `json:"topPages"`
	Timeseries    []GeoTrafficDailyPoint `json:"timeseries"`
	PropertyQuota *GeoPropertyQuota      `json:"propertyQuota,omitempty"`
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

type GeoTrafficProvider interface {
	GetGeoTrafficReport(ctx context.Context, project ProjectMetadata, from, to time.Time, filters GeoTrafficFilters) (GeoTrafficReport, error)
}

type Service struct {
	repo               Repository
	projectVerifier    ProjectAccessVerifier
	projectResolver    ProjectMetadataResolver
	visitProvider      VisitProvider
	geoTrafficProvider GeoTrafficProvider
	now                func() time.Time
}
