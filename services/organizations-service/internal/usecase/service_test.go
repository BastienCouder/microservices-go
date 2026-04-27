package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/domain"
)

type fakeRepo struct {
	organizations map[int64]*domain.Organization
	teams         map[int64][]domain.Team
	members       map[[2]int64]domain.Member
	invitations   map[int64]domain.Invitation
	tokenIndex    map[string]int64
	nextOrgID     int64
	nextTeamID    int64
	nextInviteID  int64
}

type fakeProjectMemberAssigner struct {
	calls []fakeProjectMemberAssignment
}

type fakeProjectMemberAssignment struct {
	projectID      string
	organizationID int64
	userID         int64
	role           string
}

func (f *fakeProjectMemberAssigner) AssignProjectMember(_ context.Context, projectID string, organizationID, userID int64, role string) error {
	f.calls = append(f.calls, fakeProjectMemberAssignment{
		projectID:      projectID,
		organizationID: organizationID,
		userID:         userID,
		role:           role,
	})
	return nil
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		organizations: make(map[int64]*domain.Organization),
		teams:         make(map[int64][]domain.Team),
		members:       make(map[[2]int64]domain.Member),
		invitations:   make(map[int64]domain.Invitation),
		tokenIndex:    make(map[string]int64),
		nextOrgID:     1,
		nextTeamID:    1,
		nextInviteID:  1,
	}
}

func (f *fakeRepo) Create(_ context.Context, organization *domain.Organization) error {
	organization.ID = f.nextOrgID
	f.nextOrgID++
	clone := *organization
	f.organizations[organization.ID] = &clone
	return nil
}

func (f *fakeRepo) GetByID(_ context.Context, id int64) (*domain.Organization, error) {
	org, ok := f.organizations[id]
	if !ok {
		return nil, domain.ErrOrganizationNotFound
	}
	clone := *org
	return &clone, nil
}

func (f *fakeRepo) ListOrganizationsByUser(_ context.Context, userID int64) ([]domain.Membership, error) {
	out := make([]domain.Membership, 0)
	for key, member := range f.members {
		if key[1] != userID {
			continue
		}
		out = append(out, domain.Membership{
			OrganizationID: member.OrganizationID,
			UserID:         member.UserID,
			Roles:          append([]string(nil), member.Roles...),
		})
	}
	return out, nil
}

func (f *fakeRepo) CreateTeam(_ context.Context, team *domain.Team) error {
	if _, ok := f.organizations[team.OrganizationID]; !ok {
		return domain.ErrOrganizationNotFound
	}
	team.ID = f.nextTeamID
	f.nextTeamID++
	clone := *team
	f.teams[team.OrganizationID] = append(f.teams[team.OrganizationID], clone)
	return nil
}

func (f *fakeRepo) ListTeams(_ context.Context, organizationID int64) ([]domain.Team, error) {
	if _, ok := f.organizations[organizationID]; !ok {
		return nil, domain.ErrOrganizationNotFound
	}
	teams := f.teams[organizationID]
	out := make([]domain.Team, len(teams))
	copy(out, teams)
	return out, nil
}

func (f *fakeRepo) UpsertMember(_ context.Context, member *domain.Member) error {
	if _, ok := f.organizations[member.OrganizationID]; !ok {
		return domain.ErrOrganizationNotFound
	}
	if member.TeamID > 0 {
		found := false
		for _, t := range f.teams[member.OrganizationID] {
			if t.ID == member.TeamID {
				found = true
				break
			}
		}
		if !found {
			return domain.ErrTeamNotFound
		}
	}

	key := [2]int64{member.OrganizationID, member.UserID}
	clone := *member
	clone.Roles = append([]string(nil), member.Roles...)
	f.members[key] = clone
	return nil
}

func (f *fakeRepo) ListMembers(_ context.Context, organizationID int64) ([]domain.Member, error) {
	if _, ok := f.organizations[organizationID]; !ok {
		return nil, domain.ErrOrganizationNotFound
	}
	out := make([]domain.Member, 0)
	for key, member := range f.members {
		if key[0] == organizationID {
			clone := member
			clone.Roles = append([]string(nil), member.Roles...)
			out = append(out, clone)
		}
	}
	return out, nil
}

func (f *fakeRepo) UpdateMemberTeam(_ context.Context, organizationID, userID, teamID int64) (*domain.Member, error) {
	if _, ok := f.organizations[organizationID]; !ok {
		return nil, domain.ErrOrganizationNotFound
	}
	key := [2]int64{organizationID, userID}
	member, ok := f.members[key]
	if !ok {
		return nil, domain.ErrMemberNotFound
	}
	if teamID > 0 {
		found := false
		for _, team := range f.teams[organizationID] {
			if team.ID == teamID {
				found = true
				break
			}
		}
		if !found {
			return nil, domain.ErrTeamNotFound
		}
	}
	member.TeamID = teamID
	f.members[key] = member
	clone := member
	clone.Roles = append([]string(nil), member.Roles...)
	return &clone, nil
}

func (f *fakeRepo) AssignRole(_ context.Context, organizationID, userID int64, role string) (*domain.Member, error) {
	if _, ok := f.organizations[organizationID]; !ok {
		return nil, domain.ErrOrganizationNotFound
	}
	key := [2]int64{organizationID, userID}
	member, ok := f.members[key]
	if !ok {
		return nil, domain.ErrMemberNotFound
	}
	member.Roles = domain.AddRole(member.Roles, role)
	f.members[key] = member
	clone := member
	clone.Roles = append([]string(nil), member.Roles...)
	return &clone, nil
}

func (f *fakeRepo) UpdateMemberRoles(_ context.Context, organizationID, userID int64, roles []string) (*domain.Member, error) {
	if _, ok := f.organizations[organizationID]; !ok {
		return nil, domain.ErrOrganizationNotFound
	}
	key := [2]int64{organizationID, userID}
	member, ok := f.members[key]
	if !ok || member.DeletedAt != nil {
		return nil, domain.ErrMemberNotFound
	}
	member.Roles = append([]string(nil), roles...)
	f.members[key] = member
	clone := member
	clone.Roles = append([]string(nil), member.Roles...)
	return &clone, nil
}

func (f *fakeRepo) RemoveMember(_ context.Context, organizationID, userID int64, removedAt time.Time) error {
	if _, ok := f.organizations[organizationID]; !ok {
		return domain.ErrOrganizationNotFound
	}
	key := [2]int64{organizationID, userID}
	member, ok := f.members[key]
	if !ok || member.DeletedAt != nil {
		return domain.ErrMemberNotFound
	}
	removedAt = removedAt.UTC()
	member.DeletedAt = &removedAt
	member.Roles = nil
	f.members[key] = member
	return nil
}

func (f *fakeRepo) SetMemberBanned(_ context.Context, organizationID, userID int64, banned bool) (*domain.Member, error) {
	if _, ok := f.organizations[organizationID]; !ok {
		return nil, domain.ErrOrganizationNotFound
	}
	key := [2]int64{organizationID, userID}
	member, ok := f.members[key]
	if !ok || member.DeletedAt != nil {
		return nil, domain.ErrMemberNotFound
	}
	if banned {
		member.Roles = domain.AddRole(member.Roles, domain.RoleBanned)
	} else {
		next := make([]string, 0, len(member.Roles))
		for _, role := range member.Roles {
			if role != domain.RoleBanned {
				next = append(next, role)
			}
		}
		member.Roles = next
	}
	f.members[key] = member
	clone := member
	clone.Roles = append([]string(nil), member.Roles...)
	return &clone, nil
}

func (f *fakeRepo) CreateInvitation(_ context.Context, invitation *domain.Invitation) error {
	if _, ok := f.organizations[invitation.OrganizationID]; !ok {
		return domain.ErrOrganizationNotFound
	}
	invitation.ID = f.nextInviteID
	f.nextInviteID++
	clone := cloneInvitation(*invitation)
	f.invitations[clone.ID] = clone
	f.tokenIndex[clone.Token] = clone.ID
	return nil
}

func (f *fakeRepo) ListInvitations(_ context.Context, organizationID int64) ([]domain.Invitation, error) {
	if _, ok := f.organizations[organizationID]; !ok {
		return nil, domain.ErrOrganizationNotFound
	}
	out := make([]domain.Invitation, 0)
	for _, invitation := range f.invitations {
		if invitation.OrganizationID != organizationID || invitation.DeletedAt != nil {
			continue
		}
		out = append(out, cloneInvitation(invitation))
	}
	return out, nil
}

func (f *fakeRepo) GetInvitationByID(_ context.Context, organizationID, invitationID int64) (*domain.Invitation, error) {
	invitation, ok := f.invitations[invitationID]
	if !ok || invitation.OrganizationID != organizationID || invitation.DeletedAt != nil {
		return nil, domain.ErrInvitationNotFound
	}
	clone := cloneInvitation(invitation)
	return &clone, nil
}

func (f *fakeRepo) UpdateInvitation(_ context.Context, invitation *domain.Invitation) (*domain.Invitation, error) {
	current, ok := f.invitations[invitation.ID]
	if !ok || current.OrganizationID != invitation.OrganizationID || current.DeletedAt != nil {
		return nil, domain.ErrInvitationNotFound
	}
	if current.Status != domain.InvitationStatusPending {
		return nil, domain.ErrInvitationAlreadyHandled
	}
	current.Email = invitation.Email
	current.Role = invitation.Role
	current.Message = invitation.Message
	current.ExpiresAt = cloneTimePtr(invitation.ExpiresAt)
	f.invitations[invitation.ID] = current
	clone := cloneInvitation(current)
	return &clone, nil
}

func (f *fakeRepo) DeleteInvitation(_ context.Context, organizationID, invitationID int64) error {
	current, ok := f.invitations[invitationID]
	if !ok || current.OrganizationID != organizationID || current.DeletedAt != nil {
		return domain.ErrInvitationNotFound
	}
	now := time.Now().UTC()
	current.Status = domain.InvitationStatusRevoked
	current.DeletedAt = &now
	current.RespondedAt = &now
	f.invitations[invitationID] = current
	return nil
}

func (f *fakeRepo) AcceptInvitationByToken(_ context.Context, token string, userID int64, acceptedAt time.Time) (*domain.Invitation, *domain.Member, error) {
	id, ok := f.tokenIndex[token]
	if !ok {
		return nil, nil, domain.ErrInvitationNotFound
	}
	invitation, ok := f.invitations[id]
	if !ok || invitation.DeletedAt != nil {
		return nil, nil, domain.ErrInvitationNotFound
	}
	if invitation.Status != domain.InvitationStatusPending {
		return nil, nil, domain.ErrInvitationAlreadyHandled
	}
	if invitation.ExpiresAt != nil && !invitation.ExpiresAt.After(acceptedAt) {
		return nil, nil, domain.ErrInvitationExpired
	}
	if _, ok := f.organizations[invitation.OrganizationID]; !ok {
		return nil, nil, domain.ErrOrganizationNotFound
	}

	actedAt := acceptedAt.UTC()
	invitation.Status = domain.InvitationStatusAccepted
	invitation.AcceptedByUserID = userID
	invitation.RespondedAt = &actedAt
	f.invitations[id] = invitation

	member := domain.Member{
		OrganizationID: invitation.OrganizationID,
		UserID:         userID,
		TeamID:         0,
		Roles:          []string{invitation.Role},
		AddedAt:        actedAt,
	}
	if invitation.ProjectID != "" {
		member.Roles = []string{"project_member"}
	}
	key := [2]int64{member.OrganizationID, member.UserID}
	f.members[key] = member

	invitationClone := cloneInvitation(invitation)
	memberClone := member
	memberClone.Roles = append([]string(nil), member.Roles...)
	return &invitationClone, &memberClone, nil
}

func (f *fakeRepo) RefuseInvitationByToken(_ context.Context, token string, userID int64, refusedAt time.Time) (*domain.Invitation, error) {
	id, ok := f.tokenIndex[token]
	if !ok {
		return nil, domain.ErrInvitationNotFound
	}
	invitation, ok := f.invitations[id]
	if !ok || invitation.DeletedAt != nil {
		return nil, domain.ErrInvitationNotFound
	}
	if invitation.Status != domain.InvitationStatusPending {
		return nil, domain.ErrInvitationAlreadyHandled
	}
	if invitation.ExpiresAt != nil && !invitation.ExpiresAt.After(refusedAt) {
		return nil, domain.ErrInvitationExpired
	}
	actedAt := refusedAt.UTC()
	invitation.Status = domain.InvitationStatusRefused
	invitation.AcceptedByUserID = userID
	invitation.RespondedAt = &actedAt
	f.invitations[id] = invitation
	clone := cloneInvitation(invitation)
	return &clone, nil
}

func cloneInvitation(value domain.Invitation) domain.Invitation {
	value.ExpiresAt = cloneTimePtr(value.ExpiresAt)
	value.RespondedAt = cloneTimePtr(value.RespondedAt)
	value.DeletedAt = cloneTimePtr(value.DeletedAt)
	return value
}

func cloneTimePtr(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	clone := *value
	return &clone
}

func TestCreateOrganization(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		repo := newFakeRepo()
		svc := NewService(repo)
		organization, err := svc.CreateOrganization(context.Background(), "Acme", 1)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if organization.ID != 1 {
			t.Fatalf("expected id 1, got %d", organization.ID)
		}
	})

	t.Run("validation error", func(t *testing.T) {
		repo := newFakeRepo()
		svc := NewService(repo)
		_, err := svc.CreateOrganization(context.Background(), "", 0)
		if !errors.Is(err, domain.ErrInvalidOrganization) {
			t.Fatalf("expected ErrInvalidOrganization, got %v", err)
		}
	})
}

func TestTeamsMembersRolesFlow(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}

	team, err := svc.CreateTeam(context.Background(), org.ID, "Platform")
	if err != nil {
		t.Fatalf("create team: %v", err)
	}

	member, err := svc.AddMember(context.Background(), org.ID, 42, team.ID)
	if err != nil {
		t.Fatalf("add member: %v", err)
	}
	if member.UserID != 42 {
		t.Fatalf("unexpected member user id: %d", member.UserID)
	}

	updated, err := svc.AssignRole(context.Background(), org.ID, 42, "admin")
	if err != nil {
		t.Fatalf("assign role: %v", err)
	}
	if len(updated.Roles) < 2 {
		t.Fatalf("expected at least 2 roles, got %v", updated.Roles)
	}

	teams, err := svc.ListTeams(context.Background(), org.ID)
	if err != nil {
		t.Fatalf("list teams: %v", err)
	}
	if len(teams) != 1 {
		t.Fatalf("expected 1 team, got %d", len(teams))
	}

	members, err := svc.ListMembers(context.Background(), org.ID)
	if err != nil {
		t.Fatalf("list members: %v", err)
	}
	if len(members) != 1 {
		t.Fatalf("expected 1 member, got %d", len(members))
	}
}

func TestMemberActionsFlow(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	svc.now = func() time.Time {
		return time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	}

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}
	member, err := svc.AddMember(context.Background(), org.ID, 42, 0)
	if err != nil {
		t.Fatalf("add member: %v", err)
	}

	updated, err := svc.UpdateMemberRoles(context.Background(), org.ID, member.UserID, []string{" Admin ", "editor", "admin"})
	if err != nil {
		t.Fatalf("update member roles: %v", err)
	}
	if got, want := updated.Roles, []string{"admin", "editor"}; !equalStrings(got, want) {
		t.Fatalf("roles mismatch: got %v want %v", got, want)
	}

	banned, err := svc.BanMember(context.Background(), org.ID, member.UserID)
	if err != nil {
		t.Fatalf("ban member: %v", err)
	}
	if !containsString(banned.Roles, domain.RoleBanned) {
		t.Fatalf("expected banned role, got %v", banned.Roles)
	}

	unbanned, err := svc.UnbanMember(context.Background(), org.ID, member.UserID)
	if err != nil {
		t.Fatalf("unban member: %v", err)
	}
	if containsString(unbanned.Roles, domain.RoleBanned) {
		t.Fatalf("expected banned role removed, got %v", unbanned.Roles)
	}

	if err := svc.RemoveMember(context.Background(), org.ID, member.UserID); err != nil {
		t.Fatalf("remove member: %v", err)
	}
	if _, err := svc.BanMember(context.Background(), org.ID, member.UserID); !errors.Is(err, domain.ErrMemberNotFound) {
		t.Fatalf("expected ErrMemberNotFound after removal, got %v", err)
	}
}

func TestUpdateMemberRolesRejectsEmptyRoleSet(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	org, err := svc.CreateOrganization(context.Background(), "Acme", 1)
	if err != nil {
		t.Fatalf("create org: %v", err)
	}
	if _, err := svc.AddMember(context.Background(), org.ID, 42, 0); err != nil {
		t.Fatalf("add member: %v", err)
	}

	_, err = svc.UpdateMemberRoles(context.Background(), org.ID, 42, []string{" ", ""})
	if !errors.Is(err, domain.ErrInvalidRole) {
		t.Fatalf("expected ErrInvalidRole, got %v", err)
	}
}

func equalStrings(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
