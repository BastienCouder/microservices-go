package postgres

import (
	"context"
	"fmt"
	"hash/fnv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
)

type schedulerLease struct {
	conn *pgxpool.Conn
	key  int64
}

func (s *StateStore) TryAcquireSchedulerLease(ctx context.Context, name string) (usecase.SchedulerLease, bool, error) {
	if s == nil || s.db == nil {
		return nil, false, fmt.Errorf("scheduler lease store is not initialized")
	}

	lockName := strings.TrimSpace(name)
	if lockName == "" {
		return nil, false, fmt.Errorf("scheduler lease name is required")
	}

	conn, err := s.db.Acquire(ctx)
	if err != nil {
		return nil, false, fmt.Errorf("acquire scheduler lease connection: %w", err)
	}

	key := advisoryLockKey(lockName)
	var acquired bool
	if err := conn.QueryRow(ctx, `SELECT pg_try_advisory_lock($1)`, key).Scan(&acquired); err != nil {
		conn.Release()
		return nil, false, fmt.Errorf("acquire scheduler advisory lock: %w", err)
	}
	if !acquired {
		conn.Release()
		return nil, false, nil
	}

	return &schedulerLease{conn: conn, key: key}, true, nil
}

func (l *schedulerLease) Release(ctx context.Context) error {
	if l == nil || l.conn == nil {
		return nil
	}

	var released bool
	err := l.conn.QueryRow(ctx, `SELECT pg_advisory_unlock($1)`, l.key).Scan(&released)
	l.conn.Release()
	l.conn = nil
	if err != nil {
		return fmt.Errorf("release scheduler advisory lock: %w", err)
	}
	if !released {
		return fmt.Errorf("scheduler advisory lock was not held")
	}
	return nil
}

func advisoryLockKey(name string) int64 {
	hasher := fnv.New64a()
	_, _ = hasher.Write([]byte(name))
	return int64(hasher.Sum64())
}
