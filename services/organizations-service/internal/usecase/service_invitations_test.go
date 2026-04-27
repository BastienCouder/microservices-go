package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/domain"
)

func TestInvitationCRUDFlow(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}

	expiresAt := time.Now().UTC().Add(24 * time.Hour).Truncate(time.Second)
	invitation, err := svc.CreateInvitation(
		context.Background(),
		org.ID,
		1,
		"invitee@acme.io",
		"member",
		"Welcome to the team",
		&expiresAt,
	)
	if err != nil {
		t.Fatalf("create invitation: %v", err)
	}
	if invitation.ID <= 0 {
		t.Fatalf("expected invitation id > 0, got %d", invitation.ID)
	}
	if invitation.Status != domain.InvitationStatusPending {
		t.Fatalf("expected pending status, got %s", invitation.Status)
	}
	if invitation.Token == "" {
		t.Fatal("expected non-empty invitation token")
	}

	list, err := svc.ListInvitations(context.Background(), org.ID)
	if err != nil {
		t.Fatalf("list invitations: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 invitation, got %d", len(list))
	}

	fetched, err := svc.GetInvitation(context.Background(), org.ID, invitation.ID)
	if err != nil {
		t.Fatalf("get invitation: %v", err)
	}
	if fetched.Email != invitation.Email {
		t.Fatalf("expected same email, got %s", fetched.Email)
	}

	updated, err := svc.UpdateInvitation(
		context.Background(),
		org.ID,
		invitation.ID,
		"invitee+updated@acme.io",
		"admin",
		"Updated note",
		nil,
	)
	if err != nil {
		t.Fatalf("update invitation: %v", err)
	}
	if updated.Role != "admin" {
		t.Fatalf("expected updated role admin, got %s", updated.Role)
	}

	if err := svc.DeleteInvitation(context.Background(), org.ID, invitation.ID); err != nil {
		t.Fatalf("delete invitation: %v", err)
	}

	_, err = svc.GetInvitation(context.Background(), org.ID, invitation.ID)
	if !errors.Is(err, domain.ErrInvitationNotFound) {
		t.Fatalf("expected ErrInvitationNotFound after delete, got %v", err)
	}
}

func TestInvitationCannotAssignOwnerRole(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}

	_, err = svc.CreateInvitation(
		context.Background(),
		org.ID,
		1,
		"owner@acme.io",
		"owner",
		"",
		nil,
	)
	if !errors.Is(err, domain.ErrInvalidInvitation) {
		t.Fatalf("expected ErrInvalidInvitation for owner create, got %v", err)
	}

	invitation, err := svc.CreateInvitation(
		context.Background(),
		org.ID,
		1,
		"member@acme.io",
		"member",
		"",
		nil,
	)
	if err != nil {
		t.Fatalf("create invitation: %v", err)
	}

	_, err = svc.UpdateInvitation(
		context.Background(),
		org.ID,
		invitation.ID,
		"member@acme.io",
		"owner",
		"",
		nil,
	)
	if !errors.Is(err, domain.ErrInvalidInvitation) {
		t.Fatalf("expected ErrInvalidInvitation for owner update, got %v", err)
	}
}

func TestInvitationAcceptRefuseFlow(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}

	invitation, err := svc.CreateInvitation(
		context.Background(),
		org.ID,
		1,
		"first@acme.io",
		"member",
		"",
		nil,
	)
	if err != nil {
		t.Fatalf("create invitation: %v", err)
	}

	acceptedInvitation, acceptedMember, err := svc.AcceptInvitation(context.Background(), invitation.Token, 42)
	if err != nil {
		t.Fatalf("accept invitation: %v", err)
	}
	if acceptedInvitation.Status != domain.InvitationStatusAccepted {
		t.Fatalf("expected accepted status, got %s", acceptedInvitation.Status)
	}
	if acceptedMember.UserID != 42 {
		t.Fatalf("expected accepted member user_id=42, got %d", acceptedMember.UserID)
	}

	_, _, err = svc.AcceptInvitation(context.Background(), invitation.Token, 99)
	if !errors.Is(err, domain.ErrInvitationAlreadyHandled) {
		t.Fatalf("expected ErrInvitationAlreadyHandled on second accept, got %v", err)
	}

	refused, err := svc.CreateInvitation(
		context.Background(),
		org.ID,
		1,
		"second@acme.io",
		"member",
		"",
		nil,
	)
	if err != nil {
		t.Fatalf("create second invitation: %v", err)
	}

	refusedInvitation, err := svc.RefuseInvitation(context.Background(), refused.Token, 7)
	if err != nil {
		t.Fatalf("refuse invitation: %v", err)
	}
	if refusedInvitation.Status != domain.InvitationStatusRefused {
		t.Fatalf("expected refused status, got %s", refusedInvitation.Status)
	}
}

func TestProjectInvitationAcceptAssignsOnlyProjectMembership(t *testing.T) {
	repo := newFakeRepo()
	assigner := &fakeProjectMemberAssigner{}
	svc := NewService(repo)
	svc.EnableProjectMemberAssignments(assigner)

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}

	invitation, err := svc.CreateProjectInvitation(
		context.Background(),
		org.ID,
		1,
		"project-user@acme.io",
		"viewer",
		"Projet seulement",
		"prj-42",
		nil,
	)
	if err != nil {
		t.Fatalf("create project invitation: %v", err)
	}
	if invitation.ProjectID != "prj-42" {
		t.Fatalf("expected project id prj-42, got %q", invitation.ProjectID)
	}

	acceptedInvitation, acceptedMember, err := svc.AcceptInvitation(context.Background(), invitation.Token, 42)
	if err != nil {
		t.Fatalf("accept project invitation: %v", err)
	}
	if acceptedInvitation.Status != domain.InvitationStatusAccepted {
		t.Fatalf("expected accepted status, got %s", acceptedInvitation.Status)
	}
	if len(acceptedMember.Roles) != 1 || acceptedMember.Roles[0] != "project_member" {
		t.Fatalf("expected project_member org role only, got %v", acceptedMember.Roles)
	}
	if len(assigner.calls) != 1 {
		t.Fatalf("expected 1 project assignment, got %d", len(assigner.calls))
	}
	call := assigner.calls[0]
	if call.projectID != "prj-42" || call.organizationID != org.ID || call.userID != 42 || call.role != "viewer" {
		t.Fatalf("unexpected project assignment call: %+v", call)
	}
}
