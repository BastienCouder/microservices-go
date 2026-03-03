package http

import (
	"context"
	"errors"
	"net"
	"net/http"
	"time"
)

var errUnauthorized = errors.New("unauthorized")

func (h *Handler) executeDependencyCall(
	ctx context.Context,
	breaker *circuitBreaker,
	bh *bulkhead,
	attempts int,
	baseBackoff time.Duration,
	attemptTimeout time.Duration,
	call func(context.Context) (retryable bool, dependency bool, err error),
) error {
	if attempts <= 0 {
		return errors.New("attempts must be positive")
	}
	if err := breaker.Allow(time.Now().UTC()); err != nil {
		return err
	}
	release, err := bh.Acquire(ctx)
	if err != nil {
		return err
	}
	defer release()

	backoff := baseBackoff
	var lastErr error
	for i := 0; i < attempts; i++ {
		attemptCtx, cancel := context.WithTimeout(ctx, attemptTimeout)
		retryable, dependency, callErr := call(attemptCtx)
		cancel()
		if callErr == nil {
			breaker.OnSuccess()
			return nil
		}
		if !dependency {
			return callErr
		}
		lastErr = callErr
		if !retryable || i == attempts-1 {
			breaker.OnFailure(time.Now().UTC())
			return callErr
		}
		if err := sleepWithContext(ctx, backoff); err != nil {
			breaker.OnFailure(time.Now().UTC())
			return err
		}
		backoff *= 2
	}
	breaker.OnFailure(time.Now().UTC())
	return lastErr
}

func isTransientHTTPStatus(status int) bool {
	return status == http.StatusTooManyRequests ||
		status == http.StatusBadGateway ||
		status == http.StatusServiceUnavailable ||
		status == http.StatusGatewayTimeout
}

func isTransientNetError(err error) bool {
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		return netErr.Timeout()
	}
	return false
}

func isDependencyUnavailableError(err error) bool {
	return errors.Is(err, errCircuitOpen) || errors.Is(err, context.DeadlineExceeded) || isTransientNetError(err)
}
