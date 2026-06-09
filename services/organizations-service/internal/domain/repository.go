package domain

import (
	"context"
	"time"
)

type Repository interface {
	Create(ctx context.Context, organization *Organization) error
	GetByID(ctx context.Context, id int64) (*Organization, error)
	UpdateName(ctx context.Context, id int64, name string) (*Organization, error)
	DeleteOrganization(ctx context.Context, organizationID int64, deletedAt time.Time) error
	ListOrganizationsByUser(ctx context.Context, userID int64) ([]Membership, error)
	CreateAPIKey(ctx context.Context, key *OrganizationAPIKey) error
	ListAPIKeys(ctx context.Context, organizationID int64) ([]OrganizationAPIKey, error)
	GetAPIKeyByHash(ctx context.Context, keyHash string) (*OrganizationAPIKey, error)
	MarkAPIKeyLastUsed(ctx context.Context, keyID int64, lastUsedAt time.Time) error
	RevokeAPIKey(ctx context.Context, organizationID, keyID int64, revokedAt time.Time) error
	UpsertMember(ctx context.Context, member *Member) error
	ListMembers(ctx context.Context, organizationID int64) ([]Member, error)
	AssignRole(ctx context.Context, organizationID, userID int64, role string) (*Member, error)
	UpdateMemberRoles(ctx context.Context, organizationID, userID int64, roles []string) (*Member, error)
	RemoveMember(ctx context.Context, organizationID, userID int64, removedAt time.Time) error
	UpsertProjectMember(ctx context.Context, member *ProjectMember) error
	ListProjectMembers(ctx context.Context, organizationID int64, projectID string) ([]ProjectMember, error)
	ListProjectMembersByUser(ctx context.Context, organizationID, userID int64) ([]ProjectMember, error)
	RemoveProjectMember(ctx context.Context, organizationID int64, projectID string, userID int64) error
	CreateInvitation(ctx context.Context, invitation *Invitation) error
	ListInvitations(ctx context.Context, organizationID int64) ([]Invitation, error)
	GetInvitationByID(ctx context.Context, organizationID, invitationID int64) (*Invitation, error)
	GetInvitationByToken(ctx context.Context, token string) (*Invitation, error)
	UpdateInvitation(ctx context.Context, invitation *Invitation) (*Invitation, error)
	DeleteInvitation(ctx context.Context, organizationID, invitationID int64) error
	AcceptInvitationByToken(ctx context.Context, token string, userID int64, acceptedAt time.Time) (*Invitation, *Member, error)
	RefuseInvitationByToken(ctx context.Context, token string, userID int64, refusedAt time.Time) (*Invitation, error)
}
