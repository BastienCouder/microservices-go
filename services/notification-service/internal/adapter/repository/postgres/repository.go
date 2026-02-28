package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bastiencouder/microservices-go/services/notification-service/internal/adapter/repository/postgres/sqlc"
	"github.com/bastiencouder/microservices-go/services/notification-service/internal/domain"
)

type Repository struct {
	db      *pgxpool.Pool
	queries *sqlc.Queries
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db, queries: sqlc.New(db)}
}

func (r *Repository) Create(ctx context.Context, notification *domain.Notification) error {
	created, err := r.queries.CreateNotification(ctx, sqlc.CreateNotificationParams{
		Channel:   notification.Channel,
		Recipient: notification.Recipient,
		Subject:   nullableString(notification.Subject),
		Message:   notification.Message,
		CreatedAt: toPgTimestamptz(notification.CreatedAt),
	})
	if err != nil {
		return fmt.Errorf("create notification: %w", err)
	}

	notification.ID = created.ID
	return nil
}

func (r *Repository) List(ctx context.Context, limit int) ([]domain.Notification, error) {
	if limit <= 0 {
		limit = 20
	}

	rows, err := r.queries.ListNotifications(ctx, int32(limit))
	if err != nil {
		return nil, fmt.Errorf("list notifications: %w", err)
	}

	out := make([]domain.Notification, 0, len(rows))
	for _, row := range rows {
		out = append(out, domain.Notification{
			ID:        row.ID,
			Channel:   row.Channel,
			Recipient: row.Recipient,
			Subject:   derefText(row.Subject),
			Message:   row.Message,
			CreatedAt: row.CreatedAt.Time,
		})
	}
	return out, nil
}

func nullableString(value string) pgtype.Text {
	if value == "" {
		return pgtype.Text{}
	}
	return pgtype.Text{String: value, Valid: true}
}

func derefText(value pgtype.Text) string {
	if !value.Valid {
		return ""
	}
	return value.String
}

func toPgTimestamptz(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: value, Valid: true}
}
