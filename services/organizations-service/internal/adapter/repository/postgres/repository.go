package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

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
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{
		db:      db,
		queries: sqlc.New(db),
	}
}

func (r *Repository) Create(ctx context.Context, organization *domain.Organization) error {
	var createdID int64
	if err := r.db.QueryRow(ctx, `
		INSERT INTO organizations (public_id, name, owner_user_id, created_at, deleted_at)
		VALUES ($1, $2, $3, $4, NULL)
		RETURNING id
	`, organization.PublicID, organization.Name, organization.OwnerIdentityID, toPgTimestamptz(organization.CreatedAt)).Scan(
		&createdID,
	); err != nil {
		return fmt.Errorf("insert organization: %w", err)
	}

	organization.ID = createdID
	return nil
}

func (r *Repository) GetByID(ctx context.Context, id int64) (*domain.Organization, error) {
	var org domain.Organization
	var createdAt pgtype.Timestamptz
	var deletedAt pgtype.Timestamptz
	if err := r.db.QueryRow(ctx, `
		SELECT id, public_id, name, owner_user_id, created_at, deleted_at
		FROM organizations
		WHERE id = $1
		  AND deleted_at IS NULL
	`, id).Scan(
		&org.ID,
		&org.PublicID,
		&org.Name,
		&org.OwnerIdentityID,
		&createdAt,
		&deletedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrOrganizationNotFound
		}
		return nil, fmt.Errorf("get organization: %w", err)
	}

	org.CreatedAt = fromPgTimestamptz(createdAt)
	org.DeletedAt = fromPgNullableTimestamptz(deletedAt)
	return &org, nil
}

func (r *Repository) GetByPublicID(ctx context.Context, publicID string) (*domain.Organization, error) {
	var org domain.Organization
	var createdAt pgtype.Timestamptz
	var deletedAt pgtype.Timestamptz
	if err := r.db.QueryRow(ctx, `
		SELECT id, public_id, name, owner_user_id, created_at, deleted_at
		FROM organizations
		WHERE public_id = $1
		  AND deleted_at IS NULL
	`, publicID).Scan(
		&org.ID,
		&org.PublicID,
		&org.Name,
		&org.OwnerIdentityID,
		&createdAt,
		&deletedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrOrganizationNotFound
		}
		return nil, fmt.Errorf("get organization by public id: %w", err)
	}

	org.CreatedAt = fromPgTimestamptz(createdAt)
	org.DeletedAt = fromPgNullableTimestamptz(deletedAt)
	return &org, nil
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
		RETURNING id, public_id, name, owner_user_id, created_at, deleted_at
	`, id, name).Scan(
		&org.ID,
		&org.PublicID,
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

	if err := tx.Commit(ctx); err != nil {
		return nil, nil, fmt.Errorf("commit accept invitation transaction: %w", err)
	}

	updatedInvitation := mapInvitation(updatedRow)
	memberRole := invitation.Role
	if invitation.ProjectID != "" {
		memberRole = domain.RoleViewer
	}
	member := &domain.Member{
		OrganizationID: invitation.OrganizationID,
		UserID:         userID,
		AddedAt:        acceptedAt.UTC(),
		Roles:          []string{memberRole},
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
