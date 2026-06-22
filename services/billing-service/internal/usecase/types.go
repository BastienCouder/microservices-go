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
	PromptVolume      int
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

type ConfirmStripeCheckoutSessionInput struct {
	OrganizationID int64
	SessionID      string
}

type ConfirmStripeCheckoutSessionOutput struct {
	OrganizationID       int64  `json:"organization_id"`
	Plan                 string `json:"plan"`
	BillingCycle         string `json:"billing_cycle"`
	SubscriptionStatus   string `json:"subscription_status"`
	MonthlyQuota         int    `json:"monthly_quota"`
	Seats                int    `json:"seats"`
	StripeCustomerID     string `json:"stripe_customer_id"`
	StripeSubscriptionID string `json:"stripe_subscription_id"`
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

type StripeCheckoutSessionDetails struct {
	ID                   string
	OrganizationID       int64
	ProjectID            string
	AttributionSource    string
	Plan                 string
	BillingCycle         string
	Seats                int
	MonthlyQuota         int
	Paid                 bool
	StripeCustomerID     string
	StripeSubscriptionID string
}

type StripeSubscriptionDetails struct {
	OrganizationID       int64
	ProjectID            string
	AttributionSource    string
	Plan                 string
	BillingCycle         string
	Seats                int
	MonthlyQuota         int
	StripeCustomerID     string
	StripeSubscriptionID string
	StripePriceID        string
	Status               string
	CancelAtPeriodEnd    bool
	CurrentPeriodEnd     *time.Time
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
	GetCheckoutSession(ctx context.Context, sessionID string) (StripeCheckoutSessionDetails, error)
	GetSubscription(ctx context.Context, subscriptionID string) (StripeSubscriptionDetails, error)
	CancelSubscription(ctx context.Context, subscriptionID, requestID string) (StripeSubscriptionDetails, error)
	FindPriceIDByLookupKey(ctx context.Context, lookupKey string) (string, error)
	SyncPricingCatalog(ctx context.Context, req StripePricingCatalogSyncRequest) (StripePricingCatalogSyncResult, error)
	CreateCustomerPortalSession(ctx context.Context, customerID, returnURL, requestID string) (string, error)
	ParseWebhookEvent(payload []byte, signature string) (StripeWebhookEvent, error)
}

type StripePricingCatalogSyncRequest struct {
	Products []StripePricingCatalogProduct
	Prices   []StripePricingCatalogPrice
}

type StripePricingCatalogProduct struct {
	ID                      string
	Plan                    string
	Name                    string
	MonthlyQuota            int
	ModelSelectionLimit     int
	MonthlyModelChangeLimit int
	MaxProjects             int
}

type StripePricingCatalogPrice struct {
	LookupKey               string
	ProductID               string
	Plan                    string
	TierLabel               string
	PromptVolume            int
	UnitAmountCents         int
	Currency                string
	Interval                string
	MonthlyQuota            int
	ModelSelectionLimit     int
	MonthlyModelChangeLimit int
	MaxProjects             int
}

type StripePricingCatalogSyncResult struct {
	ProductsCreated int `json:"products_created"`
	ProductsUpdated int `json:"products_updated"`
	PricesCreated   int `json:"prices_created"`
	PricesReused    int `json:"prices_reused"`
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
