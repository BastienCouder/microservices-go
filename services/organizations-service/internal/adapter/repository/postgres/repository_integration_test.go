//go:build integration

package postgres

import (
	"context"
	"errors"
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

	if _, err := db.Exec(ctx, `TRUNCATE TABLE member_roles, organization_members, teams, organization_invitations, organizations RESTART IDENTITY CASCADE`); err != nil {
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

func TestRepositoryIntegration_InvitationsFlow(t *testing.T) {
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

	if _, err := db.Exec(ctx, `TRUNCATE TABLE member_roles, organization_members, teams, organization_invitations, organizations RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate tables: %v", err)
	}

	org := &domain.Organization{Name: "Acme", OwnerIdentityID: 1, CreatedAt: time.Now().UTC()}
	if err := repo.Create(ctx, org); err != nil {
		t.Fatalf("create organization: %v", err)
	}

	expiresAt := time.Now().UTC().Add(24 * time.Hour).Truncate(time.Second)
	invitation := &domain.Invitation{
		OrganizationID:  org.ID,
		Email:           "invitee@acme.io",
		Role:            "member",
		Token:           "token-accept",
		Message:         "Welcome",
		Status:          domain.InvitationStatusPending,
		InvitedByUserID: org.OwnerIdentityID,
		CreatedAt:       time.Now().UTC().Truncate(time.Second),
		ExpiresAt:       &expiresAt,
	}
	if err := repo.CreateInvitation(ctx, invitation); err != nil {
		t.Fatalf("create invitation: %v", err)
	}
	if invitation.ID <= 0 {
		t.Fatalf("expected invitation id > 0, got %d", invitation.ID)
	}

	list, err := repo.ListInvitations(ctx, org.ID)
	if err != nil {
		t.Fatalf("list invitations: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 invitation, got %d", len(list))
	}

	loaded, err := repo.GetInvitationByID(ctx, org.ID, invitation.ID)
	if err != nil {
		t.Fatalf("get invitation: %v", err)
	}
	if loaded.Email != invitation.Email {
		t.Fatalf("unexpected invitation email: %s", loaded.Email)
	}

	updated, err := repo.UpdateInvitation(ctx, &domain.Invitation{
		ID:             invitation.ID,
		OrganizationID: org.ID,
		Email:          "invitee+updated@acme.io",
		Role:           "admin",
		Message:        "Updated",
		ExpiresAt:      nil,
	})
	if err != nil {
		t.Fatalf("update invitation: %v", err)
	}
	if updated.Role != "admin" {
		t.Fatalf("expected role admin after update, got %s", updated.Role)
	}

	acceptedInvitation, acceptedMember, err := repo.AcceptInvitationByToken(ctx, invitation.Token, 42, time.Now().UTC())
	if err != nil {
		t.Fatalf("accept invitation: %v", err)
	}
	if acceptedInvitation.Status != domain.InvitationStatusAccepted {
		t.Fatalf("expected accepted invitation status, got %s", acceptedInvitation.Status)
	}
	if acceptedMember.UserID != 42 {
		t.Fatalf("expected accepted member user_id=42, got %d", acceptedMember.UserID)
	}
	if len(acceptedMember.Roles) == 0 || acceptedMember.Roles[0] != "admin" {
		t.Fatalf("expected accepted member role admin, got %v", acceptedMember.Roles)
	}

	refused := &domain.Invitation{
		OrganizationID:  org.ID,
		Email:           "refuse@acme.io",
		Role:            "member",
		Token:           "token-refuse",
		Message:         "Refuse",
		Status:          domain.InvitationStatusPending,
		InvitedByUserID: org.OwnerIdentityID,
		CreatedAt:       time.Now().UTC().Truncate(time.Second),
	}
	if err := repo.CreateInvitation(ctx, refused); err != nil {
		t.Fatalf("create refused invitation: %v", err)
	}
	refusedInvitation, err := repo.RefuseInvitationByToken(ctx, refused.Token, 7, time.Now().UTC())
	if err != nil {
		t.Fatalf("refuse invitation: %v", err)
	}
	if refusedInvitation.Status != domain.InvitationStatusRefused {
		t.Fatalf("expected refused status, got %s", refusedInvitation.Status)
	}

	deleted := &domain.Invitation{
		OrganizationID:  org.ID,
		Email:           "delete@acme.io",
		Role:            "member",
		Token:           "token-delete",
		Message:         "Delete",
		Status:          domain.InvitationStatusPending,
		InvitedByUserID: org.OwnerIdentityID,
		CreatedAt:       time.Now().UTC().Truncate(time.Second),
	}
	if err := repo.CreateInvitation(ctx, deleted); err != nil {
		t.Fatalf("create deleted invitation: %v", err)
	}
	if err := repo.DeleteInvitation(ctx, org.ID, deleted.ID); err != nil {
		t.Fatalf("delete invitation: %v", err)
	}
	if _, err := repo.GetInvitationByID(ctx, org.ID, deleted.ID); !errors.Is(err, domain.ErrInvitationNotFound) {
		t.Fatalf("expected ErrInvitationNotFound after delete, got %v", err)
	}
}
