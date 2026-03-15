package usecase

import (
	"context"
	"errors"
	"time"
)

var (
	ErrStripeDisabled          = errors.New("stripe integration disabled")
	ErrStripeInvalidRequest    = errors.New("invalid stripe request")
	ErrStripeInvalidSignature  = errors.New("invalid stripe signature")
	ErrStripeCustomerMissing   = errors.New("stripe customer is missing")
	ErrStripeUnsupportedPlan   = errors.New("unsupported plan")
	ErrStripeUnsupportedCycle  = errors.New("unsupported billing cycle")
	ErrStripeWebhookProcessing = errors.New("stripe webhook processing failed")
)

type CreateStripeCheckoutSessionInput struct {
	OrganizationID    int64
	ProjectID         string
	AttributionSource string
	Plan              string
	BillingCycle      string
	Seats             int
	CorrectionCredits int
	SuccessURL        string
	CancelURL         string
	RequestID         string
}

type CreateStripeCheckoutSessionOutput struct {
	SessionID   string `json:"session_id"`
	CheckoutURL string `json:"checkout_url"`
}

type CreateStripeCustomerPortalSessionInput struct {
	OrganizationID int64
	ReturnURL      string
	RequestID      string
}

type CreateStripeCustomerPortalSessionOutput struct {
	PortalURL string `json:"portal_url"`
}

type StripeCheckoutSessionRequest struct {
	OrganizationID    int64
	ProjectID         string
	AttributionSource string
	Plan              string
	BillingCycle      string
	Seats             int
	MonthlyQuota      int
	PriceID           string
	CorrectionCredits int
	CorrectionPriceID string
	SuccessURL        string
	CancelURL         string
	RequestID         string
}

type StripeCheckoutSession struct {
	ID             string
	URL            string
	CustomerID     string
	SubscriptionID string
}

type StripeWebhookEvent struct {
	ID                     string
	Type                   string
	Handled                bool
	OrganizationID         int64
	ProjectID              string
	AttributionSource      string
	Plan                   string
	BillingCycle           string
	Seats                  int
	MonthlyQuota           int
	CorrectionCreditsDelta int
	RevenueCents           int64
	StripeCustomerID       string
	StripeSubscriptionID   string
	StripePriceID          string
	Status                 string
	CancelAtPeriodEnd      bool
	CurrentPeriodEnd       *time.Time
}

type StripeProvider interface {
	CreateSubscriptionCheckoutSession(ctx context.Context, req StripeCheckoutSessionRequest) (StripeCheckoutSession, error)
	CreateCustomerPortalSession(ctx context.Context, customerID, returnURL, requestID string) (string, error)
	ParseWebhookEvent(payload []byte, signature string) (StripeWebhookEvent, error)
}

type StripeCatalog struct {
	StarterMonthlyPriceID    string
	StarterYearlyPriceID     string
	GrowthMonthlyPriceID     string
	GrowthYearlyPriceID      string
	ProMonthlyPriceID        string
	ProYearlyPriceID         string
	CorrectionCreditsPriceID string
}

type AttributionEventInput struct {
	ProjectID      string
	OrganizationID int64
	Stage          string
	Source         string
	Count          int64
	RevenueCents   int64
	OccurredAt     time.Time
}

type AttributionClient interface {
	RecordEvent(ctx context.Context, input AttributionEventInput) error
}

type ProjectSummary struct {
	ID                string
	OrganizationID    int64
	Status            string
	AttributionSource string
	CreatedAt         time.Time
}

type ProjectResolver interface {
	ListProjectsByOrganization(ctx context.Context, organizationID int64) ([]ProjectSummary, error)
}
