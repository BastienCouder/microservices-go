package postgres

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bastiencouder/microservices-go/services/attribution-service/internal/usecase"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) InsertEvent(ctx context.Context, event usecase.Event) (usecase.Event, error) {
	const query = `
		INSERT INTO attribution_events (
			project_id,
			stage,
			source,
			count,
			revenue_cents,
			occurred_at
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`

	event.ProjectID = strings.TrimSpace(event.ProjectID)
	event.Stage = strings.TrimSpace(event.Stage)
	event.Source = strings.TrimSpace(event.Source)
	event.OccurredAt = event.OccurredAt.UTC()

	if err := r.db.QueryRow(
		ctx,
		query,
		event.ProjectID,
		event.Stage,
		event.Source,
		event.Count,
		event.RevenueCents,
		event.OccurredAt,
	).Scan(&event.ID, &event.CreatedAt); err != nil {
		return usecase.Event{}, fmt.Errorf("insert attribution event: %w", err)
	}

	return event, nil
}

func (r *Repository) ListEvents(ctx context.Context, projectID string, from, to time.Time, limit int) ([]usecase.Event, error) {
	const query = `
		SELECT id, project_id, stage, source, count, revenue_cents, occurred_at, created_at
		FROM attribution_events
		WHERE project_id = $1
		  AND occurred_at >= $2
		  AND occurred_at <= $3
		ORDER BY occurred_at DESC, id DESC
		LIMIT $4
	`

	rows, err := r.db.Query(ctx, query, strings.TrimSpace(projectID), from.UTC(), to.UTC(), limit)
	if err != nil {
		return nil, fmt.Errorf("list attribution events: %w", err)
	}
	defer rows.Close()

	out := make([]usecase.Event, 0)
	for rows.Next() {
		var event usecase.Event
		if err := rows.Scan(
			&event.ID,
			&event.ProjectID,
			&event.Stage,
			&event.Source,
			&event.Count,
			&event.RevenueCents,
			&event.OccurredAt,
			&event.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan attribution event: %w", err)
		}
		out = append(out, event)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate attribution events: %w", err)
	}
	return out, nil
}

func (r *Repository) GetFunnelTotals(ctx context.Context, projectID string, from, to time.Time) (usecase.FunnelTotals, error) {
	const query = `
		SELECT
			COALESCE(SUM(count) FILTER (WHERE stage = 'visit'), 0) AS visits,
			COALESCE(SUM(count) FILTER (WHERE stage = 'signup'), 0) AS signups,
			COALESCE(SUM(count) FILTER (WHERE stage = 'trial'), 0) AS trials,
			COALESCE(SUM(count) FILTER (WHERE stage = 'paid'), 0) AS paid,
			COALESCE(SUM(revenue_cents) FILTER (WHERE stage = 'paid'), 0) AS revenue_cents
		FROM attribution_events
		WHERE project_id = $1
		  AND occurred_at >= $2
		  AND occurred_at <= $3
	`

	var totals usecase.FunnelTotals
	if err := r.db.QueryRow(ctx, query, strings.TrimSpace(projectID), from.UTC(), to.UTC()).Scan(
		&totals.Visits,
		&totals.Signups,
		&totals.Trials,
		&totals.Paid,
		&totals.RevenueCents,
	); err != nil {
		return usecase.FunnelTotals{}, fmt.Errorf("query attribution funnel totals: %w", err)
	}
	return totals, nil
}
