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
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin create organization transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := r.queries.WithTx(tx)
	created, err := qtx.CreateOrganization(ctx, sqlc.CreateOrganizationParams{
		Name:        organization.Name,
		OwnerUserID: organization.OwnerIdentityID,
		CreatedAt:   toPgTimestamptz(organization.CreatedAt),
	})
	if err != nil {
		return fmt.Errorf("insert organization: %w", err)
	}

	if err := qtx.UpsertMember(ctx, sqlc.UpsertMemberParams{
		ID:      created.ID,
		UserID:  organization.OwnerIdentityID,
		TeamID:  pgtype.Int8{},
		AddedAt: toPgTimestamptz(organization.CreatedAt),
	}); err != nil {
		return fmt.Errorf("insert owner membership: %w", err)
	}
	if err := qtx.InsertMemberRole(ctx, sqlc.InsertMemberRoleParams{
		OrganizationID: created.ID,
		UserID:         organization.OwnerIdentityID,
		Role:           "owner",
	}); err != nil {
		return fmt.Errorf("insert owner role: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit create organization transaction: %w", err)
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

func (r *Repository) ListOrganizationsByUser(ctx context.Context, userID int64) ([]domain.Membership, error) {
	query := r.psql.Select(
		"m.organization_id",
		"m.user_id",
		"COALESCE(array_agg(distinct r.role) filter (where r.role is not null), '{}'::text[]) AS roles",
	).
		From("organization_members m").
		Join("organizations o ON o.id = m.organization_id").
		LeftJoin("member_roles r ON r.organization_id = m.organization_id AND r.user_id = m.user_id").
		Where(sq.Eq{"m.user_id": userID}).
		Where("m.deleted_at IS NULL").
		Where("o.deleted_at IS NULL").
		GroupBy("m.organization_id, m.user_id").
		OrderBy("m.organization_id ASC")

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, fmt.Errorf("build list organizations by user query: %w", err)
	}

	rows, err := r.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, fmt.Errorf("list organizations by user: %w", err)
	}
	defer rows.Close()

	memberships := make([]domain.Membership, 0)
	for rows.Next() {
		var item domain.Membership
		var roles []string
		if err := rows.Scan(&item.OrganizationID, &item.UserID, &roles); err != nil {
			return nil, fmt.Errorf("scan organization membership: %w", err)
		}
		item.Roles = append([]string(nil), roles...)
		memberships = append(memberships, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate organization memberships: %w", err)
	}
	return memberships, nil
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

func (r *Repository) CreateInvitation(ctx context.Context, invitation *domain.Invitation) error {
	created, err := r.queries.CreateInvitation(ctx, sqlc.CreateInvitationParams{
		OrganizationID:  invitation.OrganizationID,
		Email:           invitation.Email,
		Role:            invitation.Role,
		Token:           invitation.Token,
		Message:         invitation.Message,
		InvitedByUserID: invitation.InvitedByUserID,
		CreatedAt:       toPgTimestamptz(invitation.CreatedAt),
		ExpiresAt:       toPgNullableTimestamptz(invitation.ExpiresAt),
	})
	if err != nil {
		if isFKViolation(err) {
			return domain.ErrOrganizationNotFound
		}
		return fmt.Errorf("create invitation: %w", err)
	}
	mapped := mapInvitation(created)
	*invitation = mapped
	return nil
}

func (r *Repository) ListInvitations(ctx context.Context, organizationID int64) ([]domain.Invitation, error) {
	if _, err := r.GetByID(ctx, organizationID); err != nil {
		return nil, err
	}

	rows, err := r.queries.ListInvitationsByOrganization(ctx, organizationID)
	if err != nil {
		return nil, fmt.Errorf("list invitations: %w", err)
	}

	invitations := make([]domain.Invitation, 0, len(rows))
	for _, row := range rows {
		invitations = append(invitations, mapInvitation(row))
	}
	return invitations, nil
}

func (r *Repository) GetInvitationByID(ctx context.Context, organizationID, invitationID int64) (*domain.Invitation, error) {
	row, err := r.queries.GetInvitationByID(ctx, sqlc.GetInvitationByIDParams{
		OrganizationID: organizationID,
		ID:             invitationID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrInvitationNotFound
		}
		return nil, fmt.Errorf("get invitation: %w", err)
	}
	invitation := mapInvitation(row)
	return &invitation, nil
}

func (r *Repository) UpdateInvitation(ctx context.Context, invitation *domain.Invitation) (*domain.Invitation, error) {
	current, err := r.queries.GetInvitationByID(ctx, sqlc.GetInvitationByIDParams{
		OrganizationID: invitation.OrganizationID,
		ID:             invitation.ID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrInvitationNotFound
		}
		return nil, fmt.Errorf("get invitation before update: %w", err)
	}
	if domain.InvitationStatus(current.Status) != domain.InvitationStatusPending {
		return nil, domain.ErrInvitationAlreadyHandled
	}

	row, err := r.queries.UpdateInvitationByID(ctx, sqlc.UpdateInvitationByIDParams{
		OrganizationID: invitation.OrganizationID,
		ID:             invitation.ID,
		Email:          invitation.Email,
		Role:           invitation.Role,
		Message:        invitation.Message,
		ExpiresAt:      toPgNullableTimestamptz(invitation.ExpiresAt),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrInvitationNotFound
		}
		return nil, fmt.Errorf("update invitation: %w", err)
	}
	updated := mapInvitation(row)
	return &updated, nil
}

func (r *Repository) DeleteInvitation(ctx context.Context, organizationID, invitationID int64) error {
	rowsAffected, err := r.queries.RevokeInvitationByID(ctx, sqlc.RevokeInvitationByIDParams{
		OrganizationID: organizationID,
		ID:             invitationID,
		DeletedAt:      toPgTimestamptz(time.Now().UTC()),
	})
	if err != nil {
		return fmt.Errorf("revoke invitation: %w", err)
	}
	if rowsAffected == 0 {
		return domain.ErrInvitationNotFound
	}
	return nil
}

func (r *Repository) AcceptInvitationByToken(ctx context.Context, token string, userID int64, acceptedAt time.Time) (*domain.Invitation, *domain.Member, error) {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, nil, fmt.Errorf("begin accept invitation transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := r.queries.WithTx(tx)
	invitationRow, err := qtx.GetInvitationByTokenForUpdate(ctx, token)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, domain.ErrInvitationNotFound
		}
		return nil, nil, fmt.Errorf("get invitation by token: %w", err)
	}
	invitation := mapInvitation(invitationRow)
	if invitation.Status != domain.InvitationStatusPending {
		return nil, nil, domain.ErrInvitationAlreadyHandled
	}
	if isInvitationExpired(invitation, acceptedAt) {
		return nil, nil, domain.ErrInvitationExpired
	}

	updatedRow, err := qtx.MarkInvitationAccepted(ctx, sqlc.MarkInvitationAcceptedParams{
		ID:               invitation.ID,
		AcceptedByUserID: userID,
		RespondedAt:      toPgTimestamptz(acceptedAt.UTC()),
	})
	if err != nil {
		return nil, nil, fmt.Errorf("mark invitation accepted: %w", err)
	}

	addedAt := acceptedAt.UTC()
	if err := qtx.UpsertMember(ctx, sqlc.UpsertMemberParams{
		ID:      invitation.OrganizationID,
		UserID:  userID,
		TeamID:  pgtype.Int8{},
		AddedAt: toPgTimestamptz(addedAt),
	}); err != nil {
		if isFKViolation(err) {
			return nil, nil, domain.ErrOrganizationNotFound
		}
		return nil, nil, fmt.Errorf("upsert invited member: %w", err)
	}
	if err := qtx.InsertMemberRole(ctx, sqlc.InsertMemberRoleParams{
		OrganizationID: invitation.OrganizationID,
		UserID:         userID,
		Role:           invitation.Role,
	}); err != nil {
		return nil, nil, fmt.Errorf("insert invited member role: %w", err)
	}

	memberRow, err := qtx.GetMemberByOrgAndUser(ctx, sqlc.GetMemberByOrgAndUserParams{
		OrganizationID: invitation.OrganizationID,
		UserID:         userID,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("get invited member: %w", err)
	}
	roles, err := qtx.ListMemberRolesByOrgAndUser(ctx, sqlc.ListMemberRolesByOrgAndUserParams{
		OrganizationID: invitation.OrganizationID,
		UserID:         userID,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("list invited member roles: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, nil, fmt.Errorf("commit accept invitation transaction: %w", err)
	}

	updatedInvitation := mapInvitation(updatedRow)
	member := &domain.Member{
		OrganizationID: memberRow.OrganizationID,
		UserID:         memberRow.UserID,
		TeamID:         memberRow.TeamID,
		AddedAt:        fromPgTimestamptz(memberRow.AddedAt),
		DeletedAt:      fromPgNullableTimestamptz(memberRow.DeletedAt),
		Roles:          append([]string(nil), roles...),
	}
	return &updatedInvitation, member, nil
}

func (r *Repository) RefuseInvitationByToken(ctx context.Context, token string, userID int64, refusedAt time.Time) (*domain.Invitation, error) {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("begin refuse invitation transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := r.queries.WithTx(tx)
	invitationRow, err := qtx.GetInvitationByTokenForUpdate(ctx, token)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrInvitationNotFound
		}
		return nil, fmt.Errorf("get invitation by token: %w", err)
	}
	invitation := mapInvitation(invitationRow)
	if invitation.Status != domain.InvitationStatusPending {
		return nil, domain.ErrInvitationAlreadyHandled
	}
	if isInvitationExpired(invitation, refusedAt) {
		return nil, domain.ErrInvitationExpired
	}

	updatedRow, err := qtx.MarkInvitationRefused(ctx, sqlc.MarkInvitationRefusedParams{
		ID:               invitation.ID,
		AcceptedByUserID: userID,
		RespondedAt:      toPgTimestamptz(refusedAt.UTC()),
	})
	if err != nil {
		return nil, fmt.Errorf("mark invitation refused: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit refuse invitation transaction: %w", err)
	}

	updated := mapInvitation(updatedRow)
	return &updated, nil
}

func nullableTeamID(teamID int64) pgtype.Int8 {
	if teamID <= 0 {
		return pgtype.Int8{}
	}
	return pgtype.Int8{Int64: teamID, Valid: true}
}

func toPgNullableTimestamptz(value *time.Time) pgtype.Timestamptz {
	if value == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: value.UTC(), Valid: true}
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

func mapInvitation(row sqlc.OrganizationInvitation) domain.Invitation {
	return domain.Invitation{
		ID:               row.ID,
		OrganizationID:   row.OrganizationID,
		Email:            row.Email,
		Role:             row.Role,
		Token:            row.Token,
		Message:          row.Message,
		Status:           domain.InvitationStatus(row.Status),
		InvitedByUserID:  row.InvitedByUserID,
		AcceptedByUserID: row.AcceptedByUserID,
		CreatedAt:        fromPgTimestamptz(row.CreatedAt),
		ExpiresAt:        fromPgNullableTimestamptz(row.ExpiresAt),
		RespondedAt:      fromPgNullableTimestamptz(row.RespondedAt),
		DeletedAt:        fromPgNullableTimestamptz(row.DeletedAt),
	}
}

func isInvitationExpired(invitation domain.Invitation, now time.Time) bool {
	return invitation.ExpiresAt != nil && !invitation.ExpiresAt.After(now.UTC())
}

func isFKViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}
