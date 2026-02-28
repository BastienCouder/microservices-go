package domain

import "context"

type Repository interface {
	Upsert(ctx context.Context, subscription *Subscription) error
	GetByOrganizationID(ctx context.Context, organizationID int64) (*Subscription, error)
}
