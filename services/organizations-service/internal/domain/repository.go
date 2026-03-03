package domain

import (
	"context"
	"time"
)

type Repository interface {
	Create(ctx context.Context, organization *Organization) error
	GetByID(ctx context.Context, id int64) (*Organization, error)
	CreateTeam(ctx context.Context, team *Team) error
	ListTeams(ctx context.Context, organizationID int64) ([]Team, error)
	UpsertMember(ctx context.Context, member *Member) error
	ListMembers(ctx context.Context, organizationID int64) ([]Member, error)
	AssignRole(ctx context.Context, organizationID, userID int64, role string) (*Member, error)
	CreateInvitation(ctx context.Context, invitation *Invitation) error
	ListInvitations(ctx context.Context, organizationID int64) ([]Invitation, error)
	GetInvitationByID(ctx context.Context, organizationID, invitationID int64) (*Invitation, error)
	UpdateInvitation(ctx context.Context, invitation *Invitation) (*Invitation, error)
	DeleteInvitation(ctx context.Context, organizationID, invitationID int64) error
	AcceptInvitationByToken(ctx context.Context, token string, userID int64, acceptedAt time.Time) (*Invitation, *Member, error)
	RefuseInvitationByToken(ctx context.Context, token string, userID int64, refusedAt time.Time) (*Invitation, error)
}
