//go:build integration

package postgres

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"
)

func TestRepositoryIntegration_UpsertAndGetSubscription(t *testing.T) {
	dsn := os.Getenv("BILLING_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("BILLING_TEST_DATABASE_URL is required for integration tests")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	db, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("create db pool: %v", err)
	}
	defer db.Close()

	if err := db.Ping(ctx); err != nil {
		t.Fatalf("ping db: %v", err)
	}

	if err := RunMigrations(dsn); err != nil {
		t.Fatalf("run migrations: %v", err)
	}

	repo := NewRepository(db)

	if _, err := db.Exec(ctx, `TRUNCATE TABLE billing_subscriptions RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate billing_subscriptions table: %v", err)
	}

	subscription := &domain.Subscription{
		OrganizationID: 99,
		Plan:           "pro",
		Seats:          25,
		MonthlyQuota:   50000,
		UpdatedAt:      time.Now().UTC(),
	}
	if err := repo.Upsert(ctx, subscription); err != nil {
		t.Fatalf("upsert subscription: %v", err)
	}

	stored, err := repo.GetByOrganizationID(ctx, subscription.OrganizationID)
	if err != nil {
		t.Fatalf("get subscription: %v", err)
	}
	if stored.Plan != "pro" || stored.Seats != 25 || stored.MonthlyQuota != 50000 {
		t.Fatalf("unexpected subscription data: %+v", stored)
	}

	_, err = repo.GetByOrganizationID(ctx, 424242)
	if !errors.Is(err, domain.ErrSubscriptionMissing) {
		t.Fatalf("expected ErrSubscriptionMissing, got %v", err)
	}
}
