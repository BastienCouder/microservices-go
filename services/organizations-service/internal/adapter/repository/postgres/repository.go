package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/adapter/repository/postgres/sqlc"
	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/domain"
)

type Repository struct {
	db      *pgxpool.Pool
	queries *sqlc.Queries
	psql    sq.StatementBuilderType
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{
		db:      db,
		queries: sqlc.New(db),
		psql:    sq.StatementBuilder.PlaceholderFormat(sq.Dollar),
	}
}

func (r *Repository) Create(ctx context.Context, organization *domain.Organization) error {
	created, err := r.queries.CreateOrganization(ctx, sqlc.CreateOrganizationParams{
		Name:        organization.Name,
		OwnerUserID: organization.OwnerIdentityID,
		CreatedAt:   toPgTimestamptz(organization.CreatedAt),
	})
	if err != nil {
		return fmt.Errorf("insert organization: %w", err)
	}

	organization.ID = created.ID
	return nil
}

func (r *Repository) GetByID(ctx context.Context, id int64) (*domain.Organization, error) {
	org, err := r.queries.GetOrganizationByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrOrganizationNotFound
		}
		return nil, fmt.Errorf("get organization: %w", err)
	}

	return &domain.Organization{
		ID:              org.ID,
		Name:            org.Name,
		OwnerIdentityID: org.OwnerUserID,
		CreatedAt:       fromPgTimestamptz(org.CreatedAt),
		DeletedAt:       fromPgNullableTimestamptz(org.DeletedAt),
	}, nil
}

func (r *Repository) CreateTeam(ctx context.Context, team *domain.Team) error {
	created, err := r.queries.CreateTeam(ctx, sqlc.CreateTeamParams{
		ID:        team.OrganizationID,
		Name:      team.Name,
		CreatedAt: toPgTimestamptz(team.CreatedAt),
	})
	if err != nil {
		if isFKViolation(err) {
			return domain.ErrOrganizationNotFound
		}
		return fmt.Errorf("insert team: %w", err)
	}

	team.ID = created.ID
	return nil
}

func (r *Repository) ListTeams(ctx context.Context, organizationID int64) ([]domain.Team, error) {
	if _, err := r.GetByID(ctx, organizationID); err != nil {
		return nil, err
	}

	rows, err := r.queries.ListTeamsByOrganization(ctx, organizationID)
	if err != nil {
		return nil, fmt.Errorf("list teams: %w", err)
	}

	teams := make([]domain.Team, 0, len(rows))
	for _, row := range rows {
		teams = append(teams, domain.Team{
			ID:             row.ID,
			OrganizationID: row.OrganizationID,
			Name:           row.Name,
			CreatedAt:      fromPgTimestamptz(row.CreatedAt),
			DeletedAt:      fromPgNullableTimestamptz(row.DeletedAt),
		})
	}
	return teams, nil
}

func (r *Repository) UpsertMember(ctx context.Context, member *domain.Member) error {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin upsert member transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := r.queries.WithTx(tx)
	if err := qtx.UpsertMember(ctx, sqlc.UpsertMemberParams{
		ID:      member.OrganizationID,
		UserID:  member.UserID,
		TeamID:  nullableTeamID(member.TeamID),
		AddedAt: toPgTimestamptz(member.AddedAt),
	}); err != nil {
		if isFKViolation(err) {
			if member.TeamID > 0 {
				return domain.ErrTeamNotFound
			}
			return domain.ErrOrganizationNotFound
		}
		return fmt.Errorf("upsert member: %w", err)
	}

	for _, role := range member.Roles {
		if err := qtx.InsertMemberRole(ctx, sqlc.InsertMemberRoleParams{
			OrganizationID: member.OrganizationID,
			UserID:         member.UserID,
			Role:           role,
		}); err != nil {
			return fmt.Errorf("insert member role: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit upsert member transaction: %w", err)
	}

	return nil
}

func (r *Repository) ListMembers(ctx context.Context, organizationID int64) ([]domain.Member, error) {
	if _, err := r.GetByID(ctx, organizationID); err != nil {
		return nil, err
	}

	query := r.psql.Select(
		"m.organization_id",
		"m.user_id",
		"COALESCE(m.team_id, 0) AS team_id",
		"m.added_at",
		"COALESCE(array_agg(r.role ORDER BY r.role) FILTER (WHERE r.role IS NOT NULL), '{}')",
	).
		From("organization_members m").
		LeftJoin("member_roles r ON r.organization_id = m.organization_id AND r.user_id = m.user_id").
		Where(sq.Eq{"m.organization_id": organizationID}).
		GroupBy("m.organization_id, m.user_id, m.team_id, m.added_at").
		OrderBy("m.user_id")

	sqlQuery, args, err := query.ToSql()
	if err != nil {
		return nil, fmt.Errorf("build list members query: %w", err)
	}

	rows, err := r.db.Query(ctx, sqlQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("list members: %w", err)
	}
	defer rows.Close()

	members := make([]domain.Member, 0)
	for rows.Next() {
		var member domain.Member
		var roles []string
		if err := rows.Scan(&member.OrganizationID, &member.UserID, &member.TeamID, &member.AddedAt, &roles); err != nil {
			return nil, fmt.Errorf("scan member: %w", err)
		}
		member.Roles = append([]string(nil), roles...)
		member.DeletedAt = nil
		members = append(members, member)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate members: %w", err)
	}

	return members, nil
}

func (r *Repository) AssignRole(ctx context.Context, organizationID, userID int64, role string) (*domain.Member, error) {
	if err := r.queries.InsertMemberRole(ctx, sqlc.InsertMemberRoleParams{
		OrganizationID: organizationID,
		UserID:         userID,
		Role:           role,
	}); err != nil {
		if isFKViolation(err) {
			if _, orgErr := r.GetByID(ctx, organizationID); orgErr != nil {
				return nil, orgErr
			}
			return nil, domain.ErrMemberNotFound
		}
		return nil, fmt.Errorf("assign role: %w", err)
	}

	memberRow, err := r.queries.GetMemberByOrgAndUser(ctx, sqlc.GetMemberByOrgAndUserParams{
		OrganizationID: organizationID,
		UserID:         userID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrMemberNotFound
		}
		return nil, fmt.Errorf("get member: %w", err)
	}

	roles, err := r.queries.ListMemberRolesByOrgAndUser(ctx, sqlc.ListMemberRolesByOrgAndUserParams{
		OrganizationID: organizationID,
		UserID:         userID,
	})
	if err != nil {
		return nil, fmt.Errorf("list member roles: %w", err)
	}

	return &domain.Member{
		OrganizationID: memberRow.OrganizationID,
		UserID:         memberRow.UserID,
		TeamID:         memberRow.TeamID,
		AddedAt:        fromPgTimestamptz(memberRow.AddedAt),
		DeletedAt:      fromPgNullableTimestamptz(memberRow.DeletedAt),
		Roles:          append([]string(nil), roles...),
	}, nil
}

func nullableTeamID(teamID int64) pgtype.Int8 {
	if teamID <= 0 {
		return pgtype.Int8{}
	}
	return pgtype.Int8{Int64: teamID, Valid: true}
}

func toPgTimestamptz(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: value, Valid: true}
}

func fromPgTimestamptz(value pgtype.Timestamptz) time.Time {
	if !value.Valid {
		return time.Time{}
	}
	return value.Time
}

func fromPgNullableTimestamptz(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	t := value.Time
	return &t
}

func isFKViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}
