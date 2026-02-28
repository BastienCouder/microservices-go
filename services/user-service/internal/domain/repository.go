package domain

import (
	"context"
	"time"
)

type Repository interface {
	Create(ctx context.Context, user *User) error
	GetByID(ctx context.Context, id int64) (*User, error)
	GetByAuthIdentityID(ctx context.Context, authIdentityID string) (*User, error)
	SetBanned(ctx context.Context, id int64, banned bool, at time.Time) error
	SoftDelete(ctx context.Context, id int64, at time.Time) error
	Restore(ctx context.Context, id int64) error
}
