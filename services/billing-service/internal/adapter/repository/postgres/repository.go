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
		OrganizationID: subscription.OrganizationID,
		Plan:           subscription.Plan,
		Seats:          int32(subscription.Seats),
		MonthlyQuota:   int32(subscription.MonthlyQuota),
		UpdatedAt:      toPgTimestamptz(subscription.UpdatedAt),
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
		OrganizationID: sub.OrganizationID,
		Plan:           sub.Plan,
		Seats:          int(sub.Seats),
		MonthlyQuota:   int(sub.MonthlyQuota),
		UpdatedAt:      fromPgTimestamptz(sub.UpdatedAt),
	}, nil
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
