package domain

import "context"

type Repository interface {
	Create(ctx context.Context, notification *Notification) error
	List(ctx context.Context, limit int) ([]Notification, error)
}
