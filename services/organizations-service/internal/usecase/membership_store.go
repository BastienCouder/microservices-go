package usecase

import (
	"context"

	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/domain"
)

type MembershipStore interface {
	ListOrganizationsByUser(ctx context.Context, userID int64) ([]domain.Membership, error)
	ListMembers(ctx context.Context, organizationID int64) ([]domain.Member, error)
	UpsertMember(ctx context.Context, member *domain.Member) error
	UpdateMemberRoles(ctx context.Context, organizationID, userID int64, roles []string) (*domain.Member, error)
	RemoveMember(ctx context.Context, organizationID, userID int64) error
	ListProjectMembers(ctx context.Context, organizationID int64, projectID string) ([]domain.ProjectMember, error)
	ListProjectMembersByUser(ctx context.Context, organizationID, userID int64) ([]domain.ProjectMember, error)
	UpsertProjectMember(ctx context.Context, member *domain.ProjectMember) error
	RemoveProjectMember(ctx context.Context, organizationID int64, projectID string, userID int64) error
	DeleteOrganizationPermissions(ctx context.Context, organizationID int64) error
}
