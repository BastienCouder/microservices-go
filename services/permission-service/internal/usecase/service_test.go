package usecase

import (
	"context"
	"errors"
	"testing"

	"github.com/bastiencouder/microservices-go/services/permission-service/internal/domain"
)

type fakeRepo struct {
	result      domain.CheckResult
	claimedUser int64
}

type fakeScopeResolver struct {
	projectID string
}

func (f *fakeRepo) CheckPolicy(_ context.Context, _ domain.CheckInput) (domain.CheckResult, error) {
	return f.result, nil
}

func (f *fakeRepo) ListOrganizationRoles(_ context.Context, _, _ int64) ([]string, error) {
	return []string{"viewer"}, nil
}

func (f *fakeRepo) ListOrganizationsByUser(_ context.Context, _ int64) ([]domain.Membership, error) {
	return nil, nil
}

func (f *fakeRepo) ClaimGlobalSuperAdmin(_ context.Context, userID int64) (*domain.Member, error) {
	f.claimedUser = userID
	return &domain.Member{OrganizationID: 0, UserID: userID, Roles: []string{"super_admin"}}, nil
}

func (f *fakeRepo) GrantGlobalSuperAdmin(_ context.Context, userID int64) (*domain.Member, error) {
	return &domain.Member{OrganizationID: 0, UserID: userID, Roles: []string{"super_admin"}}, nil
}

func (f *fakeRepo) ListGlobalSuperAdmins(_ context.Context) ([]int64, error) {
	return nil, nil
}

func (f *fakeRepo) HasGlobalSuperAdmin(_ context.Context) (bool, error) {
	return false, nil
}

func (f *fakeRepo) ListMembers(_ context.Context, _ int64) ([]domain.Member, error) {
	return nil, nil
}

func (f *fakeRepo) UpsertMember(_ context.Context, _ *domain.Member) error {
	return nil
}

func (f *fakeRepo) UpdateMemberRoles(_ context.Context, organizationID, userID int64, roles []string) (*domain.Member, error) {
	return &domain.Member{OrganizationID: organizationID, UserID: userID, Roles: roles}, nil
}

func (f *fakeRepo) RemoveMember(_ context.Context, _, _ int64) error {
	return nil
}

func (f *fakeRepo) ListProjectMembers(_ context.Context, _ int64, _ string) ([]domain.ProjectMember, error) {
	return nil, nil
}

func (f *fakeRepo) ListProjectMembersByUser(_ context.Context, _ int64, _ int64) ([]domain.ProjectMember, error) {
	return nil, nil
}

func (f *fakeRepo) UpsertProjectMember(_ context.Context, _ *domain.ProjectMember) error {
	return nil
}

func (f *fakeRepo) RemoveProjectMember(_ context.Context, _ int64, _ string, _ int64) error {
	return nil
}

func (f *fakeRepo) DeleteOrganizationPermissions(_ context.Context, _ int64) error {
	return nil
}

func (f *fakeScopeResolver) ResolveProjectID(_ context.Context, _ int64, _, _ string) (string, error) {
	return f.projectID, nil
}

func TestCheck(t *testing.T) {
	svc := NewService(
		&fakeRepo{result: domain.CheckResult{Allowed: true, Reason: "ok"}},
		&fakeScopeResolver{},
	)
	result, err := svc.Check(context.Background(), domain.CheckInput{
		OrganizationID: 1,
		UserID:         1,
		Action:         "read",
		Resource:       "organization",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Allowed {
		t.Fatalf("expected allowed")
	}

	_, err = svc.Check(context.Background(), domain.CheckInput{})
	if !errors.Is(err, domain.ErrInvalidPermissionCheck) {
		t.Fatalf("expected invalid permission error, got %v", err)
	}
}

func TestClaimGlobalSuperAdmin(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo, nil)

	member, err := svc.ClaimGlobalSuperAdmin(context.Background(), 42)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.claimedUser != 42 {
		t.Fatalf("expected claimed user 42, got %d", repo.claimedUser)
	}
	if member.OrganizationID != 0 || member.UserID != 42 || len(member.Roles) != 1 || member.Roles[0] != "super_admin" {
		t.Fatalf("unexpected member: %+v", member)
	}

	_, err = svc.ClaimGlobalSuperAdmin(context.Background(), 0)
	if !errors.Is(err, domain.ErrInvalidPermissionCheck) {
		t.Fatalf("expected invalid permission error, got %v", err)
	}
}
