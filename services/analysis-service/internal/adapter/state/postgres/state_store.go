package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

const singletonStateID = 1

type StateStore struct {
	db *pgxpool.Pool
}

func NewStateStore(db *pgxpool.Pool) *StateStore {
	return &StateStore{db: db}
}

func (s *StateStore) Load(ctx context.Context) ([]byte, bool, error) {
	const query = `
		SELECT payload
		FROM analysis_service_state
		WHERE id = $1
	`

	var payload []byte
	err := s.db.QueryRow(ctx, query, singletonStateID).Scan(&payload)
	if err != nil {
		if isNoRows(err) {
			return nil, false, nil
		}
		return nil, false, fmt.Errorf("select analysis state: %w", err)
	}

	return payload, true, nil
}

func (s *StateStore) Save(ctx context.Context, payload []byte) error {
	const query = `
		INSERT INTO analysis_service_state (id, payload, updated_at)
		VALUES ($1, $2::jsonb, NOW())
		ON CONFLICT (id)
		DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
	`

	if _, err := s.db.Exec(ctx, query, singletonStateID, payload); err != nil {
		return fmt.Errorf("upsert analysis state: %w", err)
	}
	return nil
}
