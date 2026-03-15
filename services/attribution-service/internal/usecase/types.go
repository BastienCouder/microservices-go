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
	StageVisit  = "visit"
	StageSignup = "signup"
	StageTrial  = "trial"
	StagePaid   = "paid"
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

type Service struct {
	repo            Repository
	projectVerifier ProjectAccessVerifier
	projectResolver ProjectMetadataResolver
	visitProvider   VisitProvider
	now             func() time.Time
}
