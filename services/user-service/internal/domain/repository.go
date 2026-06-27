package domain

import (
	"context"
	"time"
)

type Repository interface {
	Create(ctx context.Context, user *User, consent UserConsent) error
	HasConsentByAuthIdentityID(ctx context.Context, authIdentityID, consentType, version string) (bool, error)
	AddConsentByAuthIdentityID(ctx context.Context, authIdentityID string, consent UserConsent) error
	List(ctx context.Context) ([]User, error)
	GetByID(ctx context.Context, id int64) (*User, error)
	GetByAuthIdentityID(ctx context.Context, authIdentityID string) (*User, error)
	UpdateProfile(ctx context.Context, id int64, firstName, lastName string) (*User, error)
	SetBanned(ctx context.Context, id int64, banned bool, at time.Time) error
	SoftDelete(ctx context.Context, id int64, at time.Time, anonymized AnonymizedUser) error
	Restore(ctx context.Context, id int64) error
}
