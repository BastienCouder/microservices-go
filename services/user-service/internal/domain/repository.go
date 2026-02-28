package domain

import "context"

type Repository interface {
	Create(ctx context.Context, user *User) error
	GetByID(ctx context.Context, id int64) (*User, error)
	GetByAuthIdentityID(ctx context.Context, authIdentityID string) (*User, error)
}
