package usecase

import (
	"context"
	"errors"
	"testing"

	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/domain"
)

type fakeRepo struct {
	organizations map[int64]*domain.Organization
	teams         map[int64][]domain.Team
	members       map[[2]int64]domain.Member
	nextOrgID     int64
	nextTeamID    int64
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		organizations: make(map[int64]*domain.Organization),
		teams:         make(map[int64][]domain.Team),
		members:       make(map[[2]int64]domain.Member),
		nextOrgID:     1,
		nextTeamID:    1,
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
