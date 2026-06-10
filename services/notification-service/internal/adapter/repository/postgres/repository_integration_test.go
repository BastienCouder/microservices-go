//go:build integration

package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bastiencouder/microservices-go/services/notification-service/internal/domain"
)

func TestRepositoryIntegration_CreateAndListNotifications(t *testing.T) {
	dsn := os.Getenv("NOTIFICATION_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("NOTIFICATION_TEST_DATABASE_URL is required for integration tests")
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

	if _, err := db.Exec(ctx, `TRUNCATE TABLE notifications RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate notifications table: %v", err)
	}

	first := &domain.Notification{
		Channel:   "email",
		Recipient: "a@example.com",
		Subject:   "First",
		Message:   "message-1",
		CreatedAt: time.Now().UTC(),
	}
	if err := repo.Create(ctx, first); err != nil {
		t.Fatalf("create first notification: %v", err)
	}

	second := &domain.Notification{
		Channel:   "email",
		Recipient: "b@example.com",
		Subject:   "Second",
		Message:   "message-2",
		CreatedAt: time.Now().UTC().Add(1 * time.Second),
	}
	if err := repo.Create(ctx, second); err != nil {
		t.Fatalf("create second notification: %v", err)
	}

	list, err := repo.List(ctx, 2)
	if err != nil {
		t.Fatalf("list notifications: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 notifications, got %d", len(list))
	}
	if list[0].ID != second.ID || list[1].ID != first.ID {
		t.Fatalf("expected descending order by id, got ids: %d then %d", list[0].ID, list[1].ID)
	}
}
