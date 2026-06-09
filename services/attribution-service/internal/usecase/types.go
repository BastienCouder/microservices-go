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
	TrafficDataSourceGA4  = "ga4"
	TrafficDataSourceFake = "fake"
)

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

type ProjectMetadata struct {
	ID             string
	OrganizationID int64
	Domain         string
	WebsiteURL     string
	GA4            ProjectGA4Integration
}

type ProjectGA4Integration struct {
	PropertyID         string
	ServiceAccountJSON string
	OAuthRefreshToken  string
}

type ProjectMetadataResolver interface {
	GetProject(ctx context.Context, projectID string, organizationID int64) (ProjectMetadata, error)
}

type TrafficProvider interface {
	GetTrafficReport(ctx context.Context, project ProjectMetadata, from, to time.Time, filters TrafficFilters) (TrafficReport, error)
}

type Service struct {
	projectResolver ProjectMetadataResolver
	trafficProvider TrafficProvider
	now             func() time.Time
}
