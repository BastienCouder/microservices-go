package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/adapter/repository/postgres/sqlc"
	"github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"
)

type Repository struct {
	db      *pgxpool.Pool
	queries *sqlc.Queries
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db, queries: sqlc.New(db)}
}

func (r *Repository) Upsert(ctx context.Context, subscription *domain.Subscription) error {
	err := r.queries.UpsertSubscription(ctx, sqlc.UpsertSubscriptionParams{
		OrganizationID:       subscription.OrganizationID,
		Plan:                 subscription.Plan,
		Seats:                int32(subscription.Seats),
		MonthlyQuota:         int32(subscription.MonthlyQuota),
		StripeCustomerID:     subscription.StripeCustomerID,
		StripeSubscriptionID: subscription.StripeSubscriptionID,
		StripePriceID:        subscription.StripePriceID,
		BillingCycle:         subscription.BillingCycle,
		Status:               subscription.Status,
		CancelAtPeriodEnd:    subscription.CancelAtPeriodEnd,
		CurrentPeriodEnd:     toPgNullableTimestamptz(subscription.CurrentPeriodEnd),
		CorrectionCredits:    int32(subscription.CorrectionCredits),
		UpdatedAt:            toPgTimestamptz(subscription.UpdatedAt),
	})
	if err != nil {
		return fmt.Errorf("upsert subscription: %w", err)
	}
	return nil
}

func (r *Repository) UpdateEntitlements(ctx context.Context, organizationID int64, plan string, seats, monthlyQuota int, updatedAt time.Time) error {
	err := r.queries.UpdateSubscriptionEntitlements(ctx, sqlc.UpdateSubscriptionEntitlementsParams{
		OrganizationID: organizationID,
		Plan:           plan,
		Seats:          int32(seats),
		MonthlyQuota:   int32(monthlyQuota),
		UpdatedAt:      toPgTimestamptz(updatedAt),
	})
	if err != nil {
		return fmt.Errorf("update subscription entitlements: %w", err)
	}
	return nil
}

func (r *Repository) UpdateDefaultQuotaForPlan(ctx context.Context, plan string, previousMonthlyQuota, nextMonthlyQuota int, updatedAt time.Time) error {
	err := r.queries.UpdateDefaultQuotaForPlan(ctx, sqlc.UpdateDefaultQuotaForPlanParams{
		Plan:                 plan,
		PreviousMonthlyQuota: int32(previousMonthlyQuota),
		NextMonthlyQuota:     int32(nextMonthlyQuota),
		UpdatedAt:            toPgTimestamptz(updatedAt),
	})
	if err != nil {
		return fmt.Errorf("update default quota for plan: %w", err)
	}
	return nil
}

func (r *Repository) GetByOrganizationID(ctx context.Context, organizationID int64) (*domain.Subscription, error) {
	sub, err := r.queries.GetSubscriptionByOrganizationID(ctx, organizationID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrSubscriptionMissing
		}
		return nil, fmt.Errorf("get subscription by organization id: %w", err)
	}

	return &domain.Subscription{
		OrganizationID:       sub.OrganizationID,
		Plan:                 sub.Plan,
		Seats:                int(sub.Seats),
		MonthlyQuota:         int(sub.MonthlyQuota),
		StripeCustomerID:     sub.StripeCustomerID,
		StripeSubscriptionID: sub.StripeSubscriptionID,
		StripePriceID:        sub.StripePriceID,
		BillingCycle:         sub.BillingCycle,
		Status:               sub.Status,
		CancelAtPeriodEnd:    sub.CancelAtPeriodEnd,
		CurrentPeriodEnd:     fromPgNullableTimestamptz(sub.CurrentPeriodEnd),
		CorrectionCredits:    int(sub.CorrectionCredits),
		UpdatedAt:            fromPgTimestamptz(sub.UpdatedAt),
	}, nil
}

func (r *Repository) ListPlanSettings(ctx context.Context) ([]domain.PlanSettings, error) {
	items, err := r.queries.ListBillingPlanSettings(ctx)
	if err != nil {
		return nil, fmt.Errorf("list billing plan settings: %w", err)
	}
	settings := make([]domain.PlanSettings, 0, len(items))
	for _, item := range items {
		settings = append(settings, domain.PlanSettings{
			Plan:                    item.Plan,
			MonthlyPriceCents:       int(item.MonthlyPriceCents),
			YearlyPriceCents:        int(item.YearlyPriceCents),
			MonthlyQuota:            int(item.MonthlyQuota),
			ModelSelectionLimit:     int(item.ModelSelectionLimit),
			MonthlyModelChangeLimit: int(item.MonthlyModelChangeLimit),
			UpdatedAt:               fromPgTimestamptz(item.UpdatedAt),
		})
	}
	return settings, nil
}

func (r *Repository) UpsertPlanSettings(ctx context.Context, settings domain.PlanSettings) error {
	err := r.queries.UpsertBillingPlanSettings(ctx, sqlc.UpsertBillingPlanSettingsParams{
		Plan:                    settings.Plan,
		MonthlyPriceCents:       int32(settings.MonthlyPriceCents),
		YearlyPriceCents:        int32(settings.YearlyPriceCents),
		MonthlyQuota:            int32(settings.MonthlyQuota),
		ModelSelectionLimit:     int32(settings.ModelSelectionLimit),
		MonthlyModelChangeLimit: int32(settings.MonthlyModelChangeLimit),
		UpdatedAt:               toPgTimestamptz(settings.UpdatedAt),
	})
	if err != nil {
		return fmt.Errorf("upsert billing plan settings: %w", err)
	}
	return nil
}

func (r *Repository) ListPricingTiers(ctx context.Context) ([]domain.PricingTier, error) {
	items, err := r.queries.ListBillingPricingTiers(ctx)
	if err != nil {
		return nil, fmt.Errorf("list billing pricing tiers: %w", err)
	}
	tiers := make([]domain.PricingTier, 0, len(items))
	for _, item := range items {
		tiers = append(tiers, domain.PricingTier{
			PromptVolume:        int(item.PromptVolume),
			Label:               item.Label,
			DeveloperPriceCents: fromPgNullableInt4(item.DeveloperPriceCents),
			StarterPriceCents:   fromPgNullableInt4(item.StarterPriceCents),
			GrowthPriceCents:    fromPgNullableInt4(item.GrowthPriceCents),
			ProPriceCents:       fromPgNullableInt4(item.ProPriceCents),
			UpdatedAt:           fromPgTimestamptz(item.UpdatedAt),
		})
	}
	return tiers, nil
}

func (r *Repository) UpsertPricingTier(ctx context.Context, tier domain.PricingTier) error {
	err := r.queries.UpsertBillingPricingTier(ctx, sqlc.UpsertBillingPricingTierParams{
		PromptVolume:        int32(tier.PromptVolume),
		Label:               tier.Label,
		DeveloperPriceCents: toPgNullableInt4(tier.DeveloperPriceCents),
		StarterPriceCents:   toPgNullableInt4(tier.StarterPriceCents),
		GrowthPriceCents:    toPgNullableInt4(tier.GrowthPriceCents),
		ProPriceCents:       toPgNullableInt4(tier.ProPriceCents),
		UpdatedAt:           toPgTimestamptz(tier.UpdatedAt),
	})
	if err != nil {
		return fmt.Errorf("upsert billing pricing tier: %w", err)
	}
	return nil
}

func (r *Repository) RecordStripeWebhookEvent(ctx context.Context, eventID, eventType string, processedAt time.Time) (bool, error) {
	rowsAffected, err := r.queries.RecordStripeWebhookEvent(ctx, sqlc.RecordStripeWebhookEventParams{
		EventID:     eventID,
		EventType:   eventType,
		ProcessedAt: toPgTimestamptz(processedAt),
	})
	if err != nil {
		return false, fmt.Errorf("record stripe webhook event: %w", err)
	}
	return rowsAffected > 0, nil
}

func toPgTimestamptz(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: value, Valid: true}
}

func fromPgTimestamptz(value pgtype.Timestamptz) time.Time {
	if !value.Valid {
		return time.Time{}
	}
	return value.Time
}

func toPgNullableTimestamptz(value *time.Time) pgtype.Timestamptz {
	if value == nil || value.IsZero() {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: value.UTC(), Valid: true}
}

func fromPgNullableTimestamptz(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	v := value.Time
	return &v
}

func toPgNullableInt4(value *int) pgtype.Int4 {
	if value == nil {
		return pgtype.Int4{}
	}
	return pgtype.Int4{Int32: int32(*value), Valid: true}
}

func fromPgNullableInt4(value pgtype.Int4) *int {
	if !value.Valid {
		return nil
	}
	v := int(value.Int32)
	return &v
}
