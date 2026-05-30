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
		return fmt.Errorf("insert organization creator membership: %w", err)
	}
	if err := qtx.InsertMemberRole(ctx, sqlc.InsertMemberRoleParams{
		OrganizationID: created.ID,
		UserID:         organization.OwnerIdentityID,
		Role:           "admin",
	}); err != nil {
		return fmt.Errorf("insert organization creator role: %w", err)
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

func (r *Repository) UpdateName(ctx context.Context, id int64, name string) (*domain.Organization, error) {
	var org domain.Organization
	var createdAt pgtype.Timestamptz
	var deletedAt pgtype.Timestamptz
	if err := r.db.QueryRow(ctx, `
		UPDATE organizations
		SET name = $2
		WHERE id = $1
		  AND deleted_at IS NULL
		RETURNING id, name, owner_user_id, created_at, deleted_at
	`, id, name).Scan(
		&org.ID,
		&org.Name,
		&org.OwnerIdentityID,
		&createdAt,
		&deletedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrOrganizationNotFound
		}
		return nil, fmt.Errorf("update organization name: %w", err)
	}
	org.CreatedAt = fromPgTimestamptz(createdAt)
	org.DeletedAt = fromPgNullableTimestamptz(deletedAt)
	return &org, nil
}

func (r *Repository) DeleteOrganization(ctx context.Context, organizationID int64, deletedAt time.Time) error {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin delete organization transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	deletedAt = deletedAt.UTC()
	tag, err := tx.Exec(ctx, `
		UPDATE organizations
		SET name = $2,
		    owner_user_id = 0,
		    deleted_at = $3
		WHERE id = $1
		  AND deleted_at IS NULL
	`, organizationID, fmt.Sprintf("Deleted organization %d", organizationID), toPgTimestamptz(deletedAt))
	if err != nil {
		return fmt.Errorf("soft delete organization: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrOrganizationNotFound
	}

	if _, err := tx.Exec(ctx, `
		UPDATE teams
		SET name = 'Deleted team ' || id::text,
		    deleted_at = COALESCE(deleted_at, $2)
		WHERE organization_id = $1
	`, organizationID, toPgTimestamptz(deletedAt)); err != nil {
		return fmt.Errorf("anonymize organization teams: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		DELETE FROM member_roles
		WHERE organization_id = $1
	`, organizationID); err != nil {
		return fmt.Errorf("delete organization member roles: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE organization_members
		SET team_id = NULL,
		    deleted_at = COALESCE(deleted_at, $2)
		WHERE organization_id = $1
	`, organizationID, toPgTimestamptz(deletedAt)); err != nil {
		return fmt.Errorf("soft delete organization members: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE organization_invitations
		SET project_id = '',
		    email = 'deleted-invitation-' || id::text || '@anonymized.local',
		    token = 'deleted-invitation-' || id::text,
		    message = '',
		    status = 'revoked',
		    invited_by_user_id = 0,
		    accepted_by_user_id = 0,
		    responded_at = COALESCE(responded_at, $2),
		    deleted_at = COALESCE(deleted_at, $2)
		WHERE organization_id = $1
	`, organizationID, toPgTimestamptz(deletedAt)); err != nil {
		return fmt.Errorf("anonymize organization invitations: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE organization_api_keys
		SET name = 'Deleted API key ' || id::text,
		    prefix = 'deleted',
		    key_hash = 'deleted-api-key-' || id::text,
		    revoked_at = COALESCE(revoked_at, $2)
		WHERE organization_id = $1
	`, organizationID, toPgTimestamptz(deletedAt)); err != nil {
		return fmt.Errorf("anonymize organization api keys: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit delete organization transaction: %w", err)
	}
	return nil
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

func (r *Repository) CreateAPIKey(ctx context.Context, key *domain.OrganizationAPIKey) error {
	var createdAt pgtype.Timestamptz
	var lastUsedAt pgtype.Timestamptz
	var revokedAt pgtype.Timestamptz
	if err := r.db.QueryRow(ctx, `
		INSERT INTO organization_api_keys (
			organization_id,
			name,
			prefix,
			key_hash,
			created_at,
			last_used_at,
			revoked_at
		)
		SELECT o.id, $2, $3, $4, $5, NULL, NULL
		FROM organizations o
		WHERE o.id = $1
		  AND o.deleted_at IS NULL
		RETURNING id, organization_id, name, prefix, key_hash, created_at, last_used_at, revoked_at
	`, key.OrganizationID, key.Name, key.Prefix, key.KeyHash, toPgTimestamptz(key.CreatedAt)).Scan(
		&key.ID,
		&key.OrganizationID,
		&key.Name,
		&key.Prefix,
		&key.KeyHash,
		&createdAt,
		&lastUsedAt,
		&revokedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) || isFKViolation(err) {
			return domain.ErrOrganizationNotFound
		}
		return fmt.Errorf("insert organization api key: %w", err)
	}
	key.CreatedAt = fromPgTimestamptz(createdAt)
	key.LastUsedAt = fromPgNullableTimestamptz(lastUsedAt)
	key.RevokedAt = fromPgNullableTimestamptz(revokedAt)
	return nil
}

func (r *Repository) ListAPIKeys(ctx context.Context, organizationID int64) ([]domain.OrganizationAPIKey, error) {
	if _, err := r.GetByID(ctx, organizationID); err != nil {
		return nil, err
	}

	rows, err := r.db.Query(ctx, `
		SELECT id, organization_id, name, prefix, key_hash, created_at, last_used_at, revoked_at
		FROM organization_api_keys
		WHERE organization_id = $1
		  AND revoked_at IS NULL
		ORDER BY created_at DESC, id DESC
	`, organizationID)
	if err != nil {
		return nil, fmt.Errorf("list organization api keys: %w", err)
	}
	defer rows.Close()

	keys := make([]domain.OrganizationAPIKey, 0)
	for rows.Next() {
		key, err := scanOrganizationAPIKey(rows)
		if err != nil {
			return nil, err
		}
		keys = append(keys, key)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate organization api keys: %w", err)
	}
	return keys, nil
}

func (r *Repository) GetAPIKeyByHash(ctx context.Context, keyHash string) (*domain.OrganizationAPIKey, error) {
	key, err := scanOrganizationAPIKey(r.db.QueryRow(ctx, `
		SELECT id, organization_id, name, prefix, key_hash, created_at, last_used_at, revoked_at
		FROM organization_api_keys
		WHERE key_hash = $1
		  AND revoked_at IS NULL
		LIMIT 1
	`, keyHash))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrOrganizationNotFound
		}
		return nil, fmt.Errorf("get organization api key by hash: %w", err)
	}
	return &key, nil
}

func (r *Repository) MarkAPIKeyLastUsed(ctx context.Context, keyID int64, lastUsedAt time.Time) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE organization_api_keys
		SET last_used_at = $2
		WHERE id = $1
		  AND revoked_at IS NULL
	`, keyID, toPgTimestamptz(lastUsedAt))
	if err != nil {
		return fmt.Errorf("mark organization api key last used: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrOrganizationNotFound
	}
	return nil
}

func (r *Repository) RevokeAPIKey(ctx context.Context, organizationID, keyID int64, revokedAt time.Time) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE organization_api_keys
		SET revoked_at = $3
		WHERE organization_id = $1
		  AND id = $2
		  AND revoked_at IS NULL
	`, organizationID, keyID, toPgTimestamptz(revokedAt))
	if err != nil {
		return fmt.Errorf("revoke organization api key: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrOrganizationNotFound
	}
	return nil
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
		Where("m.deleted_at IS NULL").
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

func (r *Repository) UpdateMemberTeam(ctx context.Context, organizationID, userID, teamID int64) (*domain.Member, error) {
	memberRow, err := r.queries.GetMemberByOrgAndUser(ctx, sqlc.GetMemberByOrgAndUserParams{
		OrganizationID: organizationID,
		UserID:         userID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			if _, orgErr := r.GetByID(ctx, organizationID); orgErr != nil {
				return nil, orgErr
			}
			return nil, domain.ErrMemberNotFound
		}
		return nil, fmt.Errorf("get member before team update: %w", err)
	}

	if teamID > 0 {
		var teamExists bool
		if err := r.db.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1
				FROM teams
				WHERE organization_id = $1
				  AND id = $2
				  AND deleted_at IS NULL
			)
		`, organizationID, teamID).Scan(&teamExists); err != nil {
			return nil, fmt.Errorf("check team before member update: %w", err)
		}
		if !teamExists {
			return nil, domain.ErrTeamNotFound
		}
	}

	var updated domain.Member
	var deletedAt pgtype.Timestamptz
	if err := r.db.QueryRow(ctx, `
		UPDATE organization_members
		SET team_id = $3
		WHERE organization_id = $1
		  AND user_id = $2
		  AND deleted_at IS NULL
		RETURNING organization_id, user_id, COALESCE(team_id, 0), added_at, deleted_at
	`, organizationID, userID, nullableTeamID(teamID)).Scan(
		&updated.OrganizationID,
		&updated.UserID,
		&updated.TeamID,
		&updated.AddedAt,
		&deletedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrMemberNotFound
		}
		return nil, fmt.Errorf("update member team: %w", err)
	}
	updated.DeletedAt = fromPgNullableTimestamptz(deletedAt)
	if updated.AddedAt.IsZero() {
		updated.AddedAt = fromPgTimestamptz(memberRow.AddedAt)
	}

	roles, err := r.queries.ListMemberRolesByOrgAndUser(ctx, sqlc.ListMemberRolesByOrgAndUserParams{
		OrganizationID: organizationID,
		UserID:         userID,
	})
	if err != nil {
		return nil, fmt.Errorf("list member roles after team update: %w", err)
	}
	updated.Roles = append([]string(nil), roles...)
	return &updated, nil
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

func (r *Repository) UpdateMemberRoles(ctx context.Context, organizationID, userID int64, roles []string) (*domain.Member, error) {
	if _, err := r.GetByID(ctx, organizationID); err != nil {
		return nil, err
	}

	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("begin update member roles transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	member, err := getActiveMember(ctx, tx, organizationID, userID)
	if err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		DELETE FROM member_roles
		WHERE organization_id = $1
		  AND user_id = $2
	`, organizationID, userID); err != nil {
		return nil, fmt.Errorf("delete member roles: %w", err)
	}

	for _, role := range roles {
		if _, err := tx.Exec(ctx, `
			INSERT INTO member_roles (organization_id, user_id, role)
			VALUES ($1, $2, $3)
			ON CONFLICT (organization_id, user_id, role) DO NOTHING
		`, organizationID, userID, role); err != nil {
			return nil, fmt.Errorf("insert member role: %w", err)
		}
	}

	member.Roles = append([]string(nil), roles...)
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit update member roles transaction: %w", err)
	}
	return member, nil
}

func (r *Repository) RemoveMember(ctx context.Context, organizationID, userID int64, removedAt time.Time) error {
	if _, err := r.GetByID(ctx, organizationID); err != nil {
		return err
	}

	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin remove member transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := getActiveMember(ctx, tx, organizationID, userID); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		DELETE FROM member_roles
		WHERE organization_id = $1
		  AND user_id = $2
	`, organizationID, userID); err != nil {
		return fmt.Errorf("delete member roles before removal: %w", err)
	}

	tag, err := tx.Exec(ctx, `
		UPDATE organization_members
		SET deleted_at = $3
		WHERE organization_id = $1
		  AND user_id = $2
		  AND deleted_at IS NULL
	`, organizationID, userID, toPgTimestamptz(removedAt.UTC()))
	if err != nil {
		return fmt.Errorf("remove member: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrMemberNotFound
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit remove member transaction: %w", err)
	}
	return nil
}

func (r *Repository) CreateInvitation(ctx context.Context, invitation *domain.Invitation) error {
	created, err := r.queries.CreateInvitation(ctx, sqlc.CreateInvitationParams{
		OrganizationID:  invitation.OrganizationID,
		ProjectID:       invitation.ProjectID,
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

func (r *Repository) GetInvitationByToken(ctx context.Context, token string) (*domain.Invitation, error) {
	row, err := r.queries.GetInvitationByTokenForUpdate(ctx, token)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrInvitationNotFound
		}
		return nil, fmt.Errorf("get invitation by token: %w", err)
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
	memberRole := invitation.Role
	if invitation.ProjectID != "" {
		memberRole = "member"
	}
	if err := qtx.InsertMemberRole(ctx, sqlc.InsertMemberRoleParams{
		OrganizationID: invitation.OrganizationID,
		UserID:         userID,
		Role:           memberRole,
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

func getActiveMember(ctx context.Context, tx pgx.Tx, organizationID, userID int64) (*domain.Member, error) {
	var member domain.Member
	var deletedAt pgtype.Timestamptz
	if err := tx.QueryRow(ctx, `
		SELECT organization_id, user_id, COALESCE(team_id, 0), added_at, deleted_at
		FROM organization_members
		WHERE organization_id = $1
		  AND user_id = $2
		  AND deleted_at IS NULL
	`, organizationID, userID).Scan(
		&member.OrganizationID,
		&member.UserID,
		&member.TeamID,
		&member.AddedAt,
		&deletedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrMemberNotFound
		}
		return nil, fmt.Errorf("get active member: %w", err)
	}
	member.DeletedAt = fromPgNullableTimestamptz(deletedAt)
	return &member, nil
}

func listActiveMemberRoles(ctx context.Context, tx pgx.Tx, organizationID, userID int64) ([]string, error) {
	rows, err := tx.Query(ctx, `
		SELECT role
		FROM member_roles
		WHERE organization_id = $1
		  AND user_id = $2
		ORDER BY role
	`, organizationID, userID)
	if err != nil {
		return nil, fmt.Errorf("list member roles: %w", err)
	}
	defer rows.Close()

	roles := make([]string, 0)
	for rows.Next() {
		var role string
		if err := rows.Scan(&role); err != nil {
			return nil, fmt.Errorf("scan member role: %w", err)
		}
		roles = append(roles, role)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate member roles: %w", err)
	}
	return roles, nil
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

func scanOrganizationAPIKey(row pgx.Row) (domain.OrganizationAPIKey, error) {
	var key domain.OrganizationAPIKey
	var createdAt pgtype.Timestamptz
	var lastUsedAt pgtype.Timestamptz
	var revokedAt pgtype.Timestamptz
	if err := row.Scan(
		&key.ID,
		&key.OrganizationID,
		&key.Name,
		&key.Prefix,
		&key.KeyHash,
		&createdAt,
		&lastUsedAt,
		&revokedAt,
	); err != nil {
		return domain.OrganizationAPIKey{}, fmt.Errorf("scan organization api key: %w", err)
	}
	key.CreatedAt = fromPgTimestamptz(createdAt)
	key.LastUsedAt = fromPgNullableTimestamptz(lastUsedAt)
	key.RevokedAt = fromPgNullableTimestamptz(revokedAt)
	return key, nil
}

func mapInvitation(row sqlc.OrganizationInvitation) domain.Invitation {
	return domain.Invitation{
		ID:               row.ID,
		OrganizationID:   row.OrganizationID,
		ProjectID:        row.ProjectID,
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
