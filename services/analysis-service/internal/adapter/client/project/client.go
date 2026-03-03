package project

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	projectv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/project/v1"
	grpctls "github.com/bastiencouder/microservices-go/contracts/pkg/grpctls"
	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/security"
	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/usecase"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

var errCircuitOpen = fmt.Errorf("project grpc circuit open")

type circuitBreaker struct {
	mu               sync.Mutex
	failures         int
	openedAt         time.Time
	failureThreshold int
	openDuration     time.Duration
}

func newCircuitBreaker(failureThreshold int, openDuration time.Duration) *circuitBreaker {
	return &circuitBreaker{failureThreshold: failureThreshold, openDuration: openDuration}
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

type Client struct {
	conn      *grpc.ClientConn
	client    projectv1.ProjectServiceClient
	jwtSecret string
	jwtIssuer string
	breaker   *circuitBreaker
	bulkhead  *bulkhead
}

func NewClient(target, jwtSecret, jwtIssuer string, tlsConfig grpctls.ClientConfig) (*Client, error) {
	target = strings.TrimSpace(target)
	if target == "" {
		return nil, fmt.Errorf("project grpc target is required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	dialOptions, err := grpctls.ClientDialOptions(tlsConfig)
	if err != nil {
		return nil, fmt.Errorf("configure project grpc tls: %w", err)
	}
	dialOptions = append(dialOptions, grpc.WithBlock())

	conn, err := grpc.DialContext(
		ctx,
		target,
		dialOptions...,
	)
	if err != nil {
		return nil, fmt.Errorf("dial project grpc: %w", err)
	}

	return &Client{
		conn:      conn,
		client:    projectv1.NewProjectServiceClient(conn),
		jwtSecret: jwtSecret,
		jwtIssuer: jwtIssuer,
		breaker:   newCircuitBreaker(5, 30*time.Second),
		bulkhead:  newBulkhead(128),
	}, nil
}

func (c *Client) Close() error {
	if c == nil || c.conn == nil {
		return nil
	}
	return c.conn.Close()
}

func (c *Client) EnsureProjectOwnedByUser(ctx context.Context, projectID, userID string) error {
	projectID = strings.TrimSpace(projectID)
	userID = strings.TrimSpace(userID)
	if projectID == "" {
		return fmt.Errorf("%w: projectId is required", usecase.ErrValidation)
	}
	if userID == "" {
		return fmt.Errorf("%w: userId is required", usecase.ErrValidation)
	}

	parsedUserID, err := strconv.ParseInt(userID, 10, 64)
	if err != nil || parsedUserID <= 0 {
		return fmt.Errorf("%w: userId must be a positive integer", usecase.ErrValidation)
	}

	claims := security.OutboundTokenClaims{UserID: parsedUserID}
	token, err := security.SignInternalJWT(c.jwtSecret, c.jwtIssuer, "project-service", "analysis-service", claims)
	if err != nil {
		return fmt.Errorf("sign internal jwt: %w", err)
	}

	var grpcResp *projectv1.CheckProjectAccessResponse
	err = c.executeWithResilience(ctx, 3, 50*time.Millisecond, 800*time.Millisecond, func(attemptCtx context.Context) (bool, error) {
		callCtx := metadata.AppendToOutgoingContext(attemptCtx, "authorization", "Bearer "+token)
		resp, callErr := c.client.CheckProjectAccess(callCtx, &projectv1.CheckProjectAccessRequest{ProjectId: projectID, UserId: parsedUserID})
		if callErr != nil {
			return isTransientGRPCError(callErr), callErr
		}
		grpcResp = resp
		return false, nil
	})
	if err != nil {
		st, ok := status.FromError(err)
		if ok && st.Code() == codes.InvalidArgument {
			return fmt.Errorf("%w: %s", usecase.ErrValidation, st.Message())
		}
		return err
	}

	if grpcResp.GetAllowed() {
		return nil
	}
	if !grpcResp.GetExists() {
		return fmt.Errorf("%w: project", usecase.ErrNotFound)
	}
	return fmt.Errorf("%w: project access denied", usecase.ErrUnauthorized)
}

func (c *Client) executeWithResilience(
	ctx context.Context,
	attempts int,
	baseBackoff time.Duration,
	attemptTimeout time.Duration,
	call func(context.Context) (retryable bool, err error),
) error {
	if attempts <= 0 {
		return fmt.Errorf("attempts must be positive")
	}
	if err := c.breaker.Allow(time.Now().UTC()); err != nil {
		return err
	}
	release, err := c.bulkhead.Acquire(ctx)
	if err != nil {
		return err
	}
	defer release()

	backoff := baseBackoff
	var lastErr error
	for i := 0; i < attempts; i++ {
		attemptCtx, cancel := context.WithTimeout(ctx, attemptTimeout)
		retryable, callErr := call(attemptCtx)
		cancel()
		if callErr == nil {
			c.breaker.OnSuccess()
			return nil
		}
		lastErr = callErr
		if !retryable || i == attempts-1 {
			c.breaker.OnFailure(time.Now().UTC())
			return callErr
		}
		if err := sleepWithContext(ctx, backoff); err != nil {
			c.breaker.OnFailure(time.Now().UTC())
			return err
		}
		backoff *= 2
	}
	c.breaker.OnFailure(time.Now().UTC())
	return lastErr
}

func isTransientGRPCError(err error) bool {
	st, ok := status.FromError(err)
	if !ok {
		return false
	}
	switch st.Code() {
	case codes.Unavailable, codes.DeadlineExceeded, codes.ResourceExhausted, codes.Aborted:
		return true
	default:
		return false
	}
}
