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

func (r *Repository) Create(ctx context.Context, user *domain.User) error {
	created, err := r.queries.CreateUser(ctx, sqlc.CreateUserParams{
		AuthIdentityID: user.AuthIdentityID,
		Email:          user.Email,
		FirstName:      user.FirstName,
		LastName:       user.LastName,
		CreatedAt:      toPgTimestamptz(user.CreatedAt),
	})
	if err != nil {
		return fmt.Errorf("insert user: %w", err)
	}
	user.ID = created.ID
	return nil
}

func (r *Repository) GetByID(ctx context.Context, id int64) (*domain.User, error) {
	user, err := r.queries.GetUserByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrUserNotFound
		}
		return nil, fmt.Errorf("query user by id: %w", err)
	}
	return toDomainUser(user), nil
}

func (r *Repository) GetByAuthIdentityID(ctx context.Context, authIdentityID string) (*domain.User, error) {
	user, err := r.queries.GetUserByAuthIdentityID(ctx, authIdentityID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrUserNotFound
		}
		return nil, fmt.Errorf("query user by auth identity id: %w", err)
	}
	return toDomainUser(user), nil
}

func toDomainUser(user sqlc.User) *domain.User {
	return &domain.User{
		ID:             user.ID,
		AuthIdentityID: user.AuthIdentityID,
		Email:          user.Email,
		FirstName:      user.FirstName,
		LastName:       user.LastName,
		CreatedAt:      fromPgTimestamptz(user.CreatedAt),
	}
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
