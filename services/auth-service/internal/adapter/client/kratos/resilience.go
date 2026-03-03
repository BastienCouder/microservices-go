package kratos

import (
	"context"
	"errors"
	"net"
	"sync"
	"time"
)

var errCircuitOpen = errors.New("kratos circuit open")

type circuitBreaker struct {
	mu               sync.Mutex
	failures         int
	openedAt         time.Time
	failureThreshold int
	openDuration     time.Duration
}

func newCircuitBreaker(failureThreshold int, openDuration time.Duration) *circuitBreaker {
	return &circuitBreaker{
		failureThreshold: failureThreshold,
		openDuration:     openDuration,
	}
}

func (c *circuitBreaker) Allow(now time.Time) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.openedAt.IsZero() {
		return nil
	}
	if now.Sub(c.openedAt) >= c.openDuration {
		c.openedAt = time.Time{}
		c.failures = 0
		return nil
	}
	return errCircuitOpen
}

func (c *circuitBreaker) OnSuccess() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.failures = 0
	c.openedAt = time.Time{}
}

func (c *circuitBreaker) OnFailure(now time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.failures++
	if c.failures >= c.failureThreshold {
		c.openedAt = now
	}
}

type bulkhead struct {
	sem chan struct{}
}

func newBulkhead(size int) *bulkhead {
	return &bulkhead{sem: make(chan struct{}, size)}
}

func (b *bulkhead) Acquire(ctx context.Context) (func(), error) {
	select {
	case b.sem <- struct{}{}:
		return func() { <-b.sem }, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func isTransientError(err error) bool {
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		return netErr.Timeout()
	}
	return false
}

func sleepWithContext(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
