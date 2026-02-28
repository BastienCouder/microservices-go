//go:build integration

package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bastiencouder/microservices-go/services/permission-service/internal/domain"
)

func TestRepositoryIntegration_CheckPolicies(t *testing.T) {
	dsn := os.Getenv("PERMISSION_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("PERMISSION_TEST_DATABASE_URL is required for integration tests")
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

	if _, err := db.Exec(ctx, `TRUNCATE TABLE permission_role_policies RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate permission_role_policies table: %v", err)
	}
	if _, err := db.Exec(ctx, `
		INSERT INTO permission_role_policies (organization_id, role, action, resource)
		VALUES
			(0, 'member', 'read', '*'),
			(10, 'editor', 'write', 'organizations')
	`); err != nil {
		t.Fatalf("seed permission policies: %v", err)
	}

	allowedByGlobal, err := repo.Check(ctx, domain.CheckInput{
		OrganizationID: 10,
		UserID:         7,
		Action:         "read",
		Resource:       "organizations",
		Roles:          []string{"member"},
	})
	if err != nil {
		t.Fatalf("check global policy: %v", err)
	}
	if !allowedByGlobal.Allowed {
		t.Fatalf("expected read to be allowed by global member policy")
	}

	allowedByOrgPolicy, err := repo.Check(ctx, domain.CheckInput{
		OrganizationID: 10,
		UserID:         7,
		Action:         "write",
		Resource:       "organizations",
		Roles:          []string{"editor"},
	})
	if err != nil {
		t.Fatalf("check organization policy: %v", err)
	}
	if !allowedByOrgPolicy.Allowed {
		t.Fatalf("expected write to be allowed by organization policy")
	}

	denied, err := repo.Check(ctx, domain.CheckInput{
		OrganizationID: 10,
		UserID:         7,
		Action:         "delete",
		Resource:       "organizations",
		Roles:          []string{"member"},
	})
	if err != nil {
		t.Fatalf("check denied policy: %v", err)
	}
	if denied.Allowed {
		t.Fatalf("expected delete to be denied")
	}
}
