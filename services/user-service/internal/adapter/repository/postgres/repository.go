package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bastiencouder/microservices-go/services/user-service/internal/adapter/repository/postgres/sqlc"
	"github.com/bastiencouder/microservices-go/services/user-service/internal/domain"
)

type Repository struct {
	db      *pgxpool.Pool
	queries *sqlc.Queries
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db, queries: sqlc.New(db)}
}

func (r *Repository) Create(ctx context.Context, user *domain.User, consent domain.UserConsent) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin create user: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var created sqlc.CreateUserRow
	err = tx.QueryRow(ctx, `
		INSERT INTO users (auth_identity_id, email, first_name, last_name, banned, banned_at, created_at, deleted_at)
		VALUES ($1, $2, $3, $4, FALSE, NULL, $5, NULL)
		RETURNING id, auth_identity_id, email, first_name, last_name, banned, banned_at, created_at, deleted_at
	`, user.AuthIdentityID, user.Email, user.FirstName, user.LastName, user.CreatedAt).Scan(
		&created.ID, &created.AuthIdentityID, &created.Email, &created.FirstName, &created.LastName,
		&created.Banned, &created.BannedAt, &created.CreatedAt, &created.DeletedAt,
	)
	if err != nil {
		return fmt.Errorf("insert user: %w", err)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO user_consent (user_id, type, version, accepted_at) VALUES ($1, $2, $3, $4)`, created.ID, consent.Type, consent.Version, consent.AcceptedAt); err != nil {
		return fmt.Errorf("insert user consent: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit create user: %w", err)
	}
	*user = *toDomainUserFromCreateRow(created)
	return nil
}

func (r *Repository) HasConsentByAuthIdentityID(ctx context.Context, authIdentityID, consentType, version string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM user_consent c
			JOIN users u ON u.id = c.user_id
			WHERE u.auth_identity_id = $1 AND u.deleted_at IS NULL AND c.type = $2 AND c.version = $3
		)
	`, authIdentityID, consentType, version).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("query user consent: %w", err)
	}
	return exists, nil
}

func (r *Repository) AddConsentByAuthIdentityID(ctx context.Context, authIdentityID string, consent domain.UserConsent) error {
	tag, err := r.db.Exec(ctx, `
		INSERT INTO user_consent (user_id, type, version, accepted_at)
		SELECT id, $2, $3, $4 FROM users WHERE auth_identity_id = $1 AND deleted_at IS NULL
		ON CONFLICT (user_id, type, version) DO NOTHING
	`, authIdentityID, consent.Type, consent.Version, consent.AcceptedAt)
	if err != nil {
		return fmt.Errorf("insert user consent: %w", err)
	}
	if tag.RowsAffected() == 0 {
		ok, checkErr := r.HasConsentByAuthIdentityID(ctx, authIdentityID, consent.Type, consent.Version)
		if checkErr != nil {
			return checkErr
		}
		if !ok {
			return domain.ErrUserNotFound
		}
	}
	return nil
}

func (r *Repository) List(ctx context.Context) ([]domain.User, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, auth_identity_id, email, first_name, last_name, banned, banned_at, created_at, deleted_at
		FROM users
		ORDER BY created_at DESC, id DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("query users: %w", err)
	}
	defer rows.Close()

	users := make([]domain.User, 0)
	for rows.Next() {
		user, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, *user)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return users, nil
}

func (r *Repository) GetByID(ctx context.Context, id int64) (*domain.User, error) {
	user, err := r.queries.GetUserByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrUserNotFound
		}
		return nil, fmt.Errorf("query user by id: %w", err)
	}
	return toDomainUserFromGetByIDRow(user), nil
}

type userScanner interface {
	Scan(dest ...any) error
}

func scanUser(row userScanner) (*domain.User, error) {
	var user domain.User
	var bannedAt pgtype.Timestamptz
	var createdAt pgtype.Timestamptz
	var deletedAt pgtype.Timestamptz
	if err := row.Scan(
		&user.ID,
		&user.AuthIdentityID,
		&user.Email,
		&user.FirstName,
		&user.LastName,
		&user.Banned,
		&bannedAt,
		&createdAt,
		&deletedAt,
	); err != nil {
		return nil, err
	}
	user.BannedAt = fromPgNullableTimestamptz(bannedAt)
	user.CreatedAt = fromPgTimestamptz(createdAt)
	user.DeletedAt = fromPgNullableTimestamptz(deletedAt)
	return &user, nil
}

func (r *Repository) GetByAuthIdentityID(ctx context.Context, authIdentityID string) (*domain.User, error) {
	user, err := r.queries.GetUserByAuthIdentityID(ctx, authIdentityID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrUserNotFound
		}
		return nil, fmt.Errorf("query user by auth identity id: %w", err)
	}
	return toDomainUserFromGetByAuthIdentityIDRow(user), nil
}

func (r *Repository) UpdateProfile(ctx context.Context, id int64, firstName, lastName string) (*domain.User, error) {
	var user domain.User
	var bannedAt pgtype.Timestamptz
	var createdAt pgtype.Timestamptz
	var deletedAt pgtype.Timestamptz
	if err := r.db.QueryRow(ctx, `
		UPDATE users
		SET first_name = $2,
		    last_name = $3
		WHERE id = $1
		  AND deleted_at IS NULL
		RETURNING id, auth_identity_id, email, first_name, last_name, banned, banned_at, created_at, deleted_at
	`, id, firstName, lastName).Scan(
		&user.ID,
		&user.AuthIdentityID,
		&user.Email,
		&user.FirstName,
		&user.LastName,
		&user.Banned,
		&bannedAt,
		&createdAt,
		&deletedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrUserNotFound
		}
		return nil, fmt.Errorf("update user profile: %w", err)
	}
	user.BannedAt = fromPgNullableTimestamptz(bannedAt)
	user.CreatedAt = fromPgTimestamptz(createdAt)
	user.DeletedAt = fromPgNullableTimestamptz(deletedAt)
	return &user, nil
}

func (r *Repository) SetBanned(ctx context.Context, id int64, banned bool, at time.Time) error {
	rows, err := r.queries.SetUserBanned(ctx, sqlc.SetUserBannedParams{
		ID:       id,
		Banned:   banned,
		BannedAt: toPgNullableTimestamptz(at),
	})
	if err != nil {
		return fmt.Errorf("set user banned: %w", err)
	}
	if rows == 0 {
		return domain.ErrUserNotFound
	}
	return nil
}

func (r *Repository) SoftDelete(ctx context.Context, id int64, at time.Time, anonymized domain.AnonymizedUser) error {
	rows, err := r.queries.SoftDeleteUser(ctx, sqlc.SoftDeleteUserParams{
		ID:             id,
		AuthIdentityID: anonymized.AuthIdentityID,
		Email:          anonymized.Email,
		FirstName:      anonymized.FirstName,
		LastName:       anonymized.LastName,
		DeletedAt:      toPgTimestamptz(at),
	})
	if err != nil {
		return fmt.Errorf("soft delete user: %w", err)
	}
	if rows == 0 {
		return domain.ErrUserNotFound
	}
	return nil
}

func (r *Repository) Restore(ctx context.Context, id int64) error {
	rows, err := r.queries.RestoreUser(ctx, id)
	if err != nil {
		return fmt.Errorf("restore user: %w", err)
	}
	if rows == 0 {
		return domain.ErrUserNotFound
	}
	return nil
}

func toDomainUserFromCreateRow(user sqlc.CreateUserRow) *domain.User {
	return &domain.User{
		ID:             user.ID,
		AuthIdentityID: user.AuthIdentityID,
		Email:          user.Email,
		FirstName:      user.FirstName,
		LastName:       user.LastName,
		Banned:         user.Banned,
		BannedAt:       fromPgNullableTimestamptz(user.BannedAt),
		CreatedAt:      fromPgTimestamptz(user.CreatedAt),
		DeletedAt:      fromPgNullableTimestamptz(user.DeletedAt),
	}
}

func toDomainUserFromGetByIDRow(user sqlc.GetUserByIDRow) *domain.User {
	return &domain.User{
		ID:             user.ID,
		AuthIdentityID: user.AuthIdentityID,
		Email:          user.Email,
		FirstName:      user.FirstName,
		LastName:       user.LastName,
		Banned:         user.Banned,
		BannedAt:       fromPgNullableTimestamptz(user.BannedAt),
		CreatedAt:      fromPgTimestamptz(user.CreatedAt),
		DeletedAt:      fromPgNullableTimestamptz(user.DeletedAt),
	}
}

func toDomainUserFromGetByAuthIdentityIDRow(user sqlc.GetUserByAuthIdentityIDRow) *domain.User {
	return &domain.User{
		ID:             user.ID,
		AuthIdentityID: user.AuthIdentityID,
		Email:          user.Email,
		FirstName:      user.FirstName,
		LastName:       user.LastName,
		Banned:         user.Banned,
		BannedAt:       fromPgNullableTimestamptz(user.BannedAt),
		CreatedAt:      fromPgTimestamptz(user.CreatedAt),
		DeletedAt:      fromPgNullableTimestamptz(user.DeletedAt),
	}
}

func toPgTimestamptz(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: value, Valid: true}
}

func toPgNullableTimestamptz(value time.Time) pgtype.Timestamptz {
	if value.IsZero() {
		return pgtype.Timestamptz{}
	}
	return toPgTimestamptz(value)
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
