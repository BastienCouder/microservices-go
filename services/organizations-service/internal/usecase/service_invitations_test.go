package usecase

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/domain"
)

type fakeInvitationNotifier struct {
	notifications []InvitationNotification
}

func (f *fakeInvitationNotifier) SendInvitation(_ context.Context, notification InvitationNotification) error {
	f.notifications = append(f.notifications, notification)
	return nil
}

type fakeUserEmailResolver struct {
	emails map[int64]string
}

func (f fakeUserEmailResolver) UserEmail(_ context.Context, userID int64) (string, error) {
	return f.emails[userID], nil
}

func (f fakeUserEmailResolver) UserProfile(_ context.Context, userID int64) (UserProfile, error) {
	return UserProfile{Email: f.emails[userID]}, nil
}

func TestInvitationCRUDFlow(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)

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
		"fr",
		"viewer",
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
		"fr",
		"editor",
		"Updated note",
		nil,
	)
	if err != nil {
		t.Fatalf("update invitation: %v", err)
	}
	if updated.Role != "editor" {
		t.Fatalf("expected updated role editor, got %s", updated.Role)
	}

	if err := svc.DeleteInvitation(context.Background(), org.ID, invitation.ID); err != nil {
		t.Fatalf("delete invitation: %v", err)
	}

	_, err = svc.GetInvitation(context.Background(), org.ID, invitation.ID)
	if !errors.Is(err, domain.ErrInvitationNotFound) {
		t.Fatalf("expected ErrInvitationNotFound after delete, got %v", err)
	}
}

func TestCreateInvitationSendsNotificationEmail(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)
	svc.now = func() time.Time { return time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC) }
	notifier := &fakeInvitationNotifier{}
	svc.EnableInvitationNotifications(notifier, "http://localhost:30004", "http://localhost:30000/login")

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}

	invitation, err := svc.CreateInvitation(
		context.Background(),
		org.ID,
		1,
		"invitee@acme.io",
		"en",
		"viewer",
		"Welcome to the team",
		nil,
	)
	if err != nil {
		t.Fatalf("create invitation: %v", err)
	}

	if len(notifier.notifications) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(notifier.notifications))
	}
	notification := notifier.notifications[0]
	if notification.Email != "invitee@acme.io" {
		t.Fatalf("expected invitee email, got %q", notification.Email)
	}
	if notification.OrganizationName != "Acme" {
		t.Fatalf("expected organization name Acme, got %q", notification.OrganizationName)
	}
	if notification.Locale != "en" {
		t.Fatalf("expected locale en, got %q", notification.Locale)
	}
	if notification.ExpiresAt == nil {
		t.Fatal("expected default expiration to be set")
	}
	if got, want := notification.ExpiresAt.UTC(), time.Date(2026, 1, 8, 12, 0, 0, 0, time.UTC); !got.Equal(want) {
		t.Fatalf("expected default expiration %s, got %s", want, got)
	}
	if !strings.Contains(notification.AcceptURL, invitation.Token) {
		t.Fatalf("expected accept URL to include token %q, got %q", invitation.Token, notification.AcceptURL)
	}
	if !strings.HasPrefix(notification.AcceptURL, "http://localhost:30000/login?") {
		t.Fatalf("expected accept URL to start on web auth, got %q", notification.AcceptURL)
	}
}

func TestUpdateInvitationResendsNotificationEmail(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)
	notifier := &fakeInvitationNotifier{}
	svc.EnableInvitationNotifications(notifier, "http://localhost:30004", "http://localhost:30000/login")

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}

	invitation, err := svc.CreateInvitation(
		context.Background(),
		org.ID,
		1,
		"invitee@acme.io",
		"fr",
		"viewer",
		"Welcome to the team",
		nil,
	)
	if err != nil {
		t.Fatalf("create invitation: %v", err)
	}

	updated, err := svc.UpdateInvitation(
		context.Background(),
		org.ID,
		invitation.ID,
		"invitee+again@acme.io",
		"en",
		"editor",
		"Second reminder",
		nil,
	)
	if err != nil {
		t.Fatalf("update invitation: %v", err)
	}

	if len(notifier.notifications) != 2 {
		t.Fatalf("expected 2 notifications, got %d", len(notifier.notifications))
	}
	notification := notifier.notifications[1]
	if notification.Email != "invitee+again@acme.io" {
		t.Fatalf("expected resent invitee email, got %q", notification.Email)
	}
	if notification.Role != "editor" {
		t.Fatalf("expected resent invitee role editor, got %q", notification.Role)
	}
	if notification.Message != "Second reminder" {
		t.Fatalf("expected resent invitee message, got %q", notification.Message)
	}
	if notification.Locale != "en" {
		t.Fatalf("expected resent invitee locale en, got %q", notification.Locale)
	}
	if !strings.Contains(notification.AcceptURL, updated.Token) {
		t.Fatalf("expected accept URL to include token %q, got %q", updated.Token, notification.AcceptURL)
	}
}

func TestCreateInvitationDoesNotSendNotificationEmailWhenEmailAlreadyBelongsToMember(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)
	notifier := &fakeInvitationNotifier{}
	svc.EnableInvitationNotifications(notifier, "http://localhost:30004", "http://localhost:30000/login")
	svc.EnableInvitationUserEmailValidation(fakeUserEmailResolver{
		emails: map[int64]string{
			1: "owner@acme.io",
			2: "member@acme.io",
		},
	})

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}
	if _, err := svc.AddMember(context.Background(), org.ID, 2); err != nil {
		t.Fatalf("add member: %v", err)
	}

	if _, err := svc.CreateInvitation(
		context.Background(),
		org.ID,
		1,
		"member@acme.io",
		"fr",
		"viewer",
		"Welcome back",
		nil,
	); err != nil {
		t.Fatalf("create invitation: %v", err)
	}

	if len(notifier.notifications) != 0 {
		t.Fatalf("expected no notification email, got %d", len(notifier.notifications))
	}
}

func TestUpdateInvitationDoesNotResendNotificationEmailWhenEmailAlreadyBelongsToMember(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)
	notifier := &fakeInvitationNotifier{}
	svc.EnableInvitationNotifications(notifier, "http://localhost:30004", "http://localhost:30000/login")
	svc.EnableInvitationUserEmailValidation(fakeUserEmailResolver{
		emails: map[int64]string{
			1: "owner@acme.io",
			2: "member@acme.io",
		},
	})

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}
	invitation, err := svc.CreateInvitation(
		context.Background(),
		org.ID,
		1,
		"invitee@acme.io",
		"fr",
		"viewer",
		"Welcome to the team",
		nil,
	)
	if err != nil {
		t.Fatalf("create invitation: %v", err)
	}
	if _, err := svc.AddMember(context.Background(), org.ID, 2); err != nil {
		t.Fatalf("add member: %v", err)
	}

	if _, err := svc.UpdateInvitation(
		context.Background(),
		org.ID,
		invitation.ID,
		"member@acme.io",
		"fr",
		"editor",
		"Updated note",
		nil,
	); err != nil {
		t.Fatalf("update invitation: %v", err)
	}

	if len(notifier.notifications) != 1 {
		t.Fatalf("expected only original notification email, got %d", len(notifier.notifications))
	}
}

func TestCreateProjectInvitationUsesProjectNameInNotification(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)
	svc.EnableProjectHierarchy(fakeProjectLister{
		projects: []ProjectSummary{
			{ID: "prj_6f19c6db-6ad5-4b7c-b23b-4178e1b20838", OrganizationID: 1, Name: "Projet GEO"},
		},
	})
	notifier := &fakeInvitationNotifier{}
	svc.EnableInvitationNotifications(notifier, "http://localhost:30004", "http://localhost:30000/en/auth")

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}

	_, err = svc.CreateProjectInvitation(
		context.Background(),
		org.ID,
		1,
		"invitee@acme.io",
		"fr",
		"viewer",
		"Bienvenue",
		"prj_6f19c6db-6ad5-4b7c-b23b-4178e1b20838",
		nil,
	)
	if err != nil {
		t.Fatalf("create project invitation: %v", err)
	}

	if len(notifier.notifications) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(notifier.notifications))
	}
	if got := notifier.notifications[0].ProjectName; got != "Projet GEO" {
		t.Fatalf("expected project name Projet GEO, got %q", got)
	}
	if !strings.HasPrefix(notifier.notifications[0].AcceptURL, "http://localhost:30000/en/login?") {
		t.Fatalf("expected localized login URL, got %q", notifier.notifications[0].AcceptURL)
	}
}

func TestAcceptInvitationRejectsAuthenticatedUserEmailMismatch(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)
	svc.EnableInvitationUserEmailValidation(fakeUserEmailResolver{
		emails: map[int64]string{
			1: "owner@acme.io",
			2: "invitee@acme.io",
		},
	})

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}
	invitation, err := svc.CreateInvitation(
		context.Background(),
		org.ID,
		1,
		"invitee@acme.io",
		"fr",
		"viewer",
		"",
		nil,
	)
	if err != nil {
		t.Fatalf("create invitation: %v", err)
	}

	_, _, err = svc.AcceptInvitation(context.Background(), invitation.Token, 1)
	if !errors.Is(err, domain.ErrInvitationEmailMismatch) {
		t.Fatalf("expected ErrInvitationEmailMismatch, got %v", err)
	}

	fetched, err := svc.GetInvitation(context.Background(), org.ID, invitation.ID)
	if err != nil {
		t.Fatalf("get invitation: %v", err)
	}
	if fetched.Status != domain.InvitationStatusPending {
		t.Fatalf("expected invitation to stay pending, got %s", fetched.Status)
	}
}

func TestInvitationCannotAssignOwnerRole(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}

	_, err = svc.CreateInvitation(
		context.Background(),
		org.ID,
		1,
		"owner@acme.io",
		"fr",
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
		"fr",
		"viewer",
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
		"fr",
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
	svc := newTestService(repo)

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}

	invitation, err := svc.CreateInvitation(
		context.Background(),
		org.ID,
		1,
		"first@acme.io",
		"fr",
		"viewer",
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
		"fr",
		"viewer",
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
	svc := newTestService(repo)

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}

	invitation, err := svc.CreateProjectInvitation(
		context.Background(),
		org.ID,
		1,
		"project-user@acme.io",
		"fr",
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
	if len(acceptedMember.Roles) != 1 || acceptedMember.Roles[0] != "viewer" {
		t.Fatalf("expected invited organization role viewer, got %v", acceptedMember.Roles)
	}
	projectMembers, err := svc.ListProjectMembers(context.Background(), "prj-42", org.ID)
	if err != nil {
		t.Fatalf("list project members: %v", err)
	}
	if len(projectMembers) != 1 {
		t.Fatalf("expected 1 project member, got %d", len(projectMembers))
	}
	member := projectMembers[0]
	if member.ProjectID != "prj-42" || member.OrganizationID != org.ID || member.UserID != 42 || member.Role != "viewer" {
		t.Fatalf("unexpected project member: %+v", member)
	}
}
