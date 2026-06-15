package domain

import "context"

type Repository interface {
	CheckPolicy(ctx context.Context, in CheckInput) (CheckResult, error)
	ListOrganizationRoles(ctx context.Context, organizationID, userID int64) ([]string, error)
	ListOrganizationsByUser(ctx context.Context, userID int64) ([]Membership, error)
	ListMembers(ctx context.Context, organizationID int64) ([]Member, error)
	UpsertMember(ctx context.Context, member *Member) error
	UpdateMemberRoles(ctx context.Context, organizationID, userID int64, roles []string) (*Member, error)
	RemoveMember(ctx context.Context, organizationID, userID int64) error
	ListProjectMembers(ctx context.Context, organizationID int64, projectID string) ([]ProjectMember, error)
	ListProjectMembersByUser(ctx context.Context, organizationID, userID int64) ([]ProjectMember, error)
	UpsertProjectMember(ctx context.Context, member *ProjectMember) error
	RemoveProjectMember(ctx context.Context, organizationID int64, projectID string, userID int64) error
	DeleteOrganizationPermissions(ctx context.Context, organizationID int64) error
}
