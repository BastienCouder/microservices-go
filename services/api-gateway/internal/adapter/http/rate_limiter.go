package http

import (
	"fmt"
	"sync"
	"time"
)

const rateLimiterMaxEntries = 50_000

type rateLimiter struct {
	mu         sync.Mutex
	windowFrom time.Time
	window     time.Duration
	limit      int
	hits       map[string]int
}

func newRateLimiter(limit int, window time.Duration) (*rateLimiter, error) {
	if limit <= 0 {
		return nil, fmt.Errorf("invalid rate limit: %d", limit)
	}
	return &rateLimiter{
		windowFrom: time.Now().UTC(),
		window:     window,
		limit:      limit,
		hits:       make(map[string]int),
	}, nil
}

func (l *rateLimiter) Allow(key string) bool {
	now := time.Now().UTC()

	l.mu.Lock()
	defer l.mu.Unlock()

	if now.Sub(l.windowFrom) >= l.window {
		l.windowFrom = now
		l.hits = make(map[string]int)
	}

	// Prevent memory exhaustion from spoofed IPs.
	if _, exists := l.hits[key]; !exists && len(l.hits) >= rateLimiterMaxEntries {
		return false
	}

	l.hits[key]++
	return l.hits[key] <= l.limit
}
