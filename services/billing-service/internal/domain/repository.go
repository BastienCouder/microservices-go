package domain

import (
	"context"
	"time"
)

type Repository interface {
	Upsert(ctx context.Context, subscription *Subscription) error
	GetByOrganizationID(ctx context.Context, organizationID int64) (*Subscription, error)
	RecordStripeWebhookEvent(ctx context.Context, eventID, eventType string, processedAt time.Time) (bool, error)
}
