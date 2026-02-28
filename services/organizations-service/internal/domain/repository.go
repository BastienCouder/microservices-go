package domain

import "context"

type Repository interface {
	Create(ctx context.Context, organization *Organization) error
	GetByID(ctx context.Context, id int64) (*Organization, error)
	CreateTeam(ctx context.Context, team *Team) error
	ListTeams(ctx context.Context, organizationID int64) ([]Team, error)
	UpsertMember(ctx context.Context, member *Member) error
	ListMembers(ctx context.Context, organizationID int64) ([]Member, error)
	AssignRole(ctx context.Context, organizationID, userID int64, role string) (*Member, error)
}
