package analysis

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	analysisv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/analysis/v1"
	grpctls "github.com/bastiencouder/microservices-go/contracts/pkg/grpctls"
	"github.com/bastiencouder/microservices-go/services/project-service/internal/security"
	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

var errCircuitOpen = fmt.Errorf("analysis grpc circuit open")

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
	client    analysisv1.AnalysisServiceClient
	jwtSecret string
	jwtIssuer string
	breaker   *circuitBreaker
	bulkhead  *bulkhead
}

func NewClient(target, jwtSecret, jwtIssuer string, tlsConfig grpctls.ClientConfig) (*Client, error) {
	target = strings.TrimSpace(target)
	if target == "" {
		return nil, fmt.Errorf("analysis grpc target is required")
	}
	dialOptions, err := grpctls.ClientDialOptions(tlsConfig)
	if err != nil {
		return nil, fmt.Errorf("configure analysis grpc tls: %w", err)
	}
	conn, err := grpc.Dial(target, dialOptions...)
	if err != nil {
		return nil, fmt.Errorf("dial analysis grpc: %w", err)
	}

	return &Client{
		conn:      conn,
		client:    analysisv1.NewAnalysisServiceClient(conn),
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

func (c *Client) StartAnalysis(ctx context.Context, req usecase.AnalysisStartRequest) (usecase.AnalysisStartResponse, error) {
	claims := security.OutboundTokenClaims{
		UserID:       req.CreatedBy,
		Organization: req.OrganizationID,
	}
	token, err := security.SignInternalJWT(c.jwtSecret, c.jwtIssuer, "analysis-service", "project-service", claims)
	if err != nil {
		return usecase.AnalysisStartResponse{}, fmt.Errorf("sign internal jwt: %w", err)
	}

	promptTexts := make([]*analysisv1.PromptText, 0, len(req.PromptTexts))
	for _, prompt := range req.PromptTexts {
		promptTexts = append(promptTexts, &analysisv1.PromptText{Id: prompt.ID, Text: prompt.Text})
	}
	var grpcResp *analysisv1.StartAnalysisResponse
	err = c.executeWithResilience(ctx, 3, 50*time.Millisecond, 900*time.Millisecond, func(attemptCtx context.Context) (bool, error) {
		callCtx := metadata.AppendToOutgoingContext(attemptCtx, "authorization", "Bearer "+token)
		resp, callErr := c.client.StartAnalysis(callCtx, &analysisv1.StartAnalysisRequest{
			RequestId:   req.RequestID,
			UserId:      req.CreatedBy,
			ProjectId:   req.ProjectID,
			PromptTexts: promptTexts,
			ModelIds:    req.ModelIDs,
			RunType:     req.RunType,
		})
		if callErr != nil {
			return isTransientGRPCError(callErr), callErr
		}
		grpcResp = resp
		return false, nil
	})
	if err != nil {
		return usecase.AnalysisStartResponse{}, err
	}

	out := usecase.AnalysisStartResponse{RunID: grpcResp.GetAnalysisRun().GetId()}
	out.PromptRuns = make([]usecase.AnalysisPromptRun, 0, len(grpcResp.GetPromptRuns()))
	for _, promptRun := range grpcResp.GetPromptRuns() {
		out.PromptRuns = append(out.PromptRuns, usecase.AnalysisPromptRun{
			ID:         promptRun.GetId(),
			PromptID:   promptRun.GetPromptId(),
			PromptText: promptRun.GetPromptText(),
		})
	}
	return out, nil
}

func (c *Client) RecordResponse(ctx context.Context, runID string, input usecase.AnalysisRecordResponseInput) error {
	token, err := security.SignInternalJWT(c.jwtSecret, c.jwtIssuer, "analysis-service", "project-service", security.OutboundTokenClaims{})
	if err != nil {
		return fmt.Errorf("sign internal jwt: %w", err)
	}

	return c.executeWithResilience(ctx, 3, 50*time.Millisecond, 800*time.Millisecond, func(attemptCtx context.Context) (bool, error) {
		callCtx := metadata.AppendToOutgoingContext(attemptCtx, "authorization", "Bearer "+token)
		_, callErr := c.client.RecordResponse(callCtx, &analysisv1.RecordResponseRequest{
			RunId:          runID,
			PromptRunId:    input.PromptRunID,
			ModelId:        input.ModelID,
			RawResponse:    input.RawResponse,
			BrandMentioned: input.BrandMentioned,
			BrandPosition:  input.BrandPosition,
			CitationFound:  input.CitationFound,
			CitedUrls:      input.CitedURLs,
			Sentiment:      input.Sentiment,
		})
		if callErr != nil {
			return isTransientGRPCError(callErr), callErr
		}
		return false, nil
	})
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
