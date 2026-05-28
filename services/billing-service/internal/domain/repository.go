package domain

import (
	"context"
	"time"
)

type Repository interface {
	Upsert(ctx context.Context, subscription *Subscription) error
	UpdateEntitlements(ctx context.Context, organizationID int64, plan string, seats, monthlyQuota int, updatedAt time.Time) error
	UpdateDefaultQuotaForPlan(ctx context.Context, plan string, previousMonthlyQuota, nextMonthlyQuota int, updatedAt time.Time) error
	GetByOrganizationID(ctx context.Context, organizationID int64) (*Subscription, error)
	ListPlanSettings(ctx context.Context) ([]PlanSettings, error)
	UpsertPlanSettings(ctx context.Context, settings PlanSettings) error
	ListPricingTiers(ctx context.Context) ([]PricingTier, error)
	UpsertPricingTier(ctx context.Context, tier PricingTier) error
	DeletePricingTier(ctx context.Context, promptVolume int) error
	RecordStripeWebhookEvent(ctx context.Context, eventID, eventType string, processedAt time.Time) (bool, error)
}
