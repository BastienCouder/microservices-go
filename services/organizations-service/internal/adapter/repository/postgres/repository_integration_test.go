//go:build integration

package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/domain"
)

func TestRepositoryIntegration_TeamsMembersRoles(t *testing.T) {
	dsn := os.Getenv("ORG_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("ORG_TEST_DATABASE_URL is required for integration tests")
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

	if _, err := db.Exec(ctx, `TRUNCATE TABLE member_roles, organization_members, teams, organizations RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate tables: %v", err)
	}

	org := &domain.Organization{Name: "Acme", OwnerIdentityID: 1, CreatedAt: time.Now().UTC()}
	if err := repo.Create(ctx, org); err != nil {
		t.Fatalf("create organization: %v", err)
	}
	if org.ID <= 0 {
		t.Fatalf("expected organization id > 0, got %d", org.ID)
	}

	team := &domain.Team{OrganizationID: org.ID, Name: "Platform", CreatedAt: time.Now().UTC()}
	if err := repo.CreateTeam(ctx, team); err != nil {
		t.Fatalf("create team: %v", err)
	}
	if team.ID <= 0 {
		t.Fatalf("expected team id > 0, got %d", team.ID)
	}

	member := &domain.Member{OrganizationID: org.ID, UserID: 42, TeamID: team.ID, Roles: []string{"member"}, AddedAt: time.Now().UTC()}
	if err := repo.UpsertMember(ctx, member); err != nil {
		t.Fatalf("upsert member: %v", err)
	}

	updated, err := repo.AssignRole(ctx, org.ID, 42, "admin")
	if err != nil {
		t.Fatalf("assign role: %v", err)
	}
	if len(updated.Roles) < 2 {
		t.Fatalf("expected at least 2 roles, got %v", updated.Roles)
	}

	teams, err := repo.ListTeams(ctx, org.ID)
	if err != nil {
		t.Fatalf("list teams: %v", err)
	}
	if len(teams) != 1 {
		t.Fatalf("expected 1 team, got %d", len(teams))
	}

	members, err := repo.ListMembers(ctx, org.ID)
	if err != nil {
		t.Fatalf("list members: %v", err)
	}
	if len(members) != 2 {
		t.Fatalf("expected 2 members (owner + added), got %d", len(members))
	}

	var ownerFound bool
	for _, m := range members {
		if m.UserID == org.OwnerIdentityID {
			ownerFound = true
			if len(m.Roles) != 1 || m.Roles[0] != "owner" {
				t.Fatalf("expected owner to have role owner, got %v", m.Roles)
			}
		}
	}
	if !ownerFound {
		t.Fatalf("expected owner membership for user_id=%d", org.OwnerIdentityID)
	}

	storedOrg, err := repo.GetByID(ctx, org.ID)
	if err != nil {
		t.Fatalf("get organization: %v", err)
	}
	if storedOrg.Name != "Acme" {
		t.Fatalf("unexpected organization name: %s", storedOrg.Name)
	}
}
