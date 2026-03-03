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
