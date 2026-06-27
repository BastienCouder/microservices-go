//go:build integration

package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bastiencouder/microservices-go/services/user-service/internal/domain"
)

func TestRepositoryIntegration_CreateAndGetUser(t *testing.T) {
	dsn := os.Getenv("USER_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("USER_TEST_DATABASE_URL is required for integration tests")
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

	if _, err := db.Exec(ctx, `TRUNCATE TABLE users RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate users table: %v", err)
	}

	user := &domain.User{
		AuthIdentityID: "kratos-identity-1",
		Email:          "test.user@example.com",
		FirstName:      "Test",
		LastName:       "User",
		CreatedAt:      time.Now().UTC(),
	}
	if err := repo.Create(ctx, user, domain.UserConsent{Type: domain.ConsentTypePrivacyPolicy, Version: domain.ConsentVersionV1, AcceptedAt: time.Now().UTC()}); err != nil {
		t.Fatalf("create user: %v", err)
	}
	if user.ID <= 0 {
		t.Fatalf("expected user id > 0, got %d", user.ID)
	}

	byID, err := repo.GetByID(ctx, user.ID)
	if err != nil {
		t.Fatalf("get user by id: %v", err)
	}
	if byID.Email != user.Email {
		t.Fatalf("unexpected email, got %s", byID.Email)
	}

	byAuth, err := repo.GetByAuthIdentityID(ctx, user.AuthIdentityID)
	if err != nil {
		t.Fatalf("get user by auth identity id: %v", err)
	}
	if byAuth.ID != user.ID {
		t.Fatalf("unexpected user id, got %d want %d", byAuth.ID, user.ID)
	}
}
