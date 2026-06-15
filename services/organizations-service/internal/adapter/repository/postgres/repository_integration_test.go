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

func TestRepositoryIntegration_OrganizationsAndAPIKeys(t *testing.T) {
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

	if _, err := db.Exec(ctx, `TRUNCATE TABLE organization_api_keys, organization_invitations, organizations RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate tables: %v", err)
	}

	org := &domain.Organization{Name: "Acme", OwnerIdentityID: 1, CreatedAt: time.Now().UTC()}
	if err := repo.Create(ctx, org); err != nil {
		t.Fatalf("create organization: %v", err)
	}
	if org.ID <= 0 {
		t.Fatalf("expected organization id > 0, got %d", org.ID)
	}

	storedOrg, err := repo.GetByID(ctx, org.ID)
	if err != nil {
		t.Fatalf("get organization: %v", err)
	}
	if storedOrg.Name != "Acme" {
		t.Fatalf("unexpected organization name: %s", storedOrg.Name)
	}
	if storedOrg.OwnerIdentityID != 1 {
		t.Fatalf("unexpected owner identity id: %d", storedOrg.OwnerIdentityID)
	}

	key := &domain.OrganizationAPIKey{
		OrganizationID: org.ID,
		Name:           "Production",
		Prefix:         "org_testpref",
		KeyHash:        "hash-value",
		Key:            "org_secret",
		CreatedAt:      time.Now().UTC().Truncate(time.Second),
	}
	if err := repo.CreateAPIKey(ctx, key); err != nil {
		t.Fatalf("create organization api key: %v", err)
	}
	if key.ID <= 0 {
		t.Fatalf("expected api key id > 0, got %d", key.ID)
	}

	keys, err := repo.ListAPIKeys(ctx, org.ID)
	if err != nil {
		t.Fatalf("list api keys: %v", err)
	}
	if len(keys) != 1 {
		t.Fatalf("expected 1 api key, got %d", len(keys))
	}
	if keys[0].Name != "Production" {
		t.Fatalf("unexpected api key name: %s", keys[0].Name)
	}

	storedKey, err := repo.GetAPIKeyByHash(ctx, "hash-value")
	if err != nil {
		t.Fatalf("get api key by hash: %v", err)
	}
	if storedKey.OrganizationID != org.ID {
		t.Fatalf("unexpected api key organization id: %d", storedKey.OrganizationID)
	}

	lastUsedAt := time.Now().UTC().Truncate(time.Second)
	if err := repo.MarkAPIKeyLastUsed(ctx, key.ID, lastUsedAt); err != nil {
		t.Fatalf("mark api key last used: %v", err)
	}
	if err := repo.RevokeAPIKey(ctx, org.ID, key.ID, lastUsedAt); err != nil {
		t.Fatalf("revoke api key: %v", err)
	}

	keys, err = repo.ListAPIKeys(ctx, org.ID)
	if err != nil {
		t.Fatalf("list api keys after revoke: %v", err)
	}
	if len(keys) != 0 {
		t.Fatalf("expected revoked api keys to be hidden from active listing, got %d", len(keys))
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

	if _, err := db.Exec(ctx, `TRUNCATE TABLE organization_api_keys, organization_invitations, organizations RESTART IDENTITY CASCADE`); err != nil {
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
		Role:            "viewer",
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
		Role:           "editor",
		Message:        "Updated",
		ExpiresAt:      nil,
	})
	if err != nil {
		t.Fatalf("update invitation: %v", err)
	}
	if updated.Role != "editor" {
		t.Fatalf("expected role editor after update, got %s", updated.Role)
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
	if len(acceptedMember.Roles) == 0 || acceptedMember.Roles[0] != "editor" {
		t.Fatalf("expected accepted member role editor, got %v", acceptedMember.Roles)
	}

	refused := &domain.Invitation{
		OrganizationID:  org.ID,
		Email:           "refuse@acme.io",
		Role:            "viewer",
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
		Role:            "viewer",
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
