package ia

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	iav1 "github.com/bastiencouder/microservices-go/contracts/gen/go/ia/v1"
	grpctls "github.com/bastiencouder/microservices-go/contracts/pkg/grpctls"
	"github.com/bastiencouder/microservices-go/contracts/pkg/internalauth"
	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

var errCircuitOpen = fmt.Errorf("ia grpc circuit open")

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
	conn           *grpc.ClientConn
	client         iav1.IAServiceClient
	jwtSecret      string
	jwtIssuer      string
	attemptTimeout time.Duration
	breaker        *circuitBreaker
	bulkhead       *bulkhead
}

func NewClient(target, jwtSecret, jwtIssuer string, tlsConfig grpctls.ClientConfig) (*Client, error) {
	return NewClientWithOptions(target, jwtSecret, jwtIssuer, tlsConfig, 30*time.Second)
}

func NewClientWithOptions(target, jwtSecret, jwtIssuer string, tlsConfig grpctls.ClientConfig, attemptTimeout time.Duration) (*Client, error) {
	target = strings.TrimSpace(target)
	if target == "" {
		return nil, fmt.Errorf("ia grpc target is required")
	}
	if attemptTimeout <= 0 {
		attemptTimeout = 30 * time.Second
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	dialOptions, err := grpctls.ClientDialOptions(tlsConfig)
	if err != nil {
		return nil, fmt.Errorf("configure ia grpc tls: %w", err)
	}
	dialOptions = append(dialOptions, grpc.WithBlock())

	conn, err := grpc.DialContext(
		ctx,
		target,
		dialOptions...,
	)
	if err != nil {
		return nil, fmt.Errorf("dial ia grpc: %w", err)
	}

	return &Client{
		conn:           conn,
		client:         iav1.NewIAServiceClient(conn),
		jwtSecret:      jwtSecret,
		jwtIssuer:      jwtIssuer,
		attemptTimeout: attemptTimeout,
		breaker:        newCircuitBreaker(5, 30*time.Second),
		bulkhead:       newBulkhead(128),
	}, nil
}

func (c *Client) Close() error {
	if c == nil || c.conn == nil {
		return nil
	}
	return c.conn.Close()
}

func (c *Client) ExecutePrompt(ctx context.Context, input usecase.IAExecutePromptInput) (usecase.IAExecutePromptResult, error) {
	token, err := internalauth.SignInternalJWT(c.jwtSecret, c.jwtIssuer, "ia-service", "project-service", internalauth.Claims{})
	if err != nil {
		return usecase.IAExecutePromptResult{}, fmt.Errorf("sign internal jwt: %w", err)
	}

	var grpcResp *iav1.ExecutePromptResponse
	err = c.executeWithResilience(ctx, 3, 50*time.Millisecond, c.attemptTimeout, func(attemptCtx context.Context) (bool, error) {
		callCtx := metadata.AppendToOutgoingContext(attemptCtx, "authorization", "Bearer "+token)
		resp, callErr := c.client.ExecutePrompt(callCtx, &iav1.ExecutePromptRequest{
			PromptId:       input.PromptID,
			PromptText:     input.PromptText,
			ModelId:        input.ModelID,
			BrandName:      input.BrandName,
			Competitors:    input.Competitors,
			ProviderId:     input.ProviderID,
			ProviderApiKey: input.ProviderAPIKey,
			PromptMode:     string(input.PromptMode),
		})
		if callErr != nil {
			return isTransientGRPCError(callErr), callErr
		}
		grpcResp = resp
		return false, nil
	})
	if err != nil {
		return usecase.IAExecutePromptResult{}, err
	}

	result := usecase.IAExecutePromptResult{RawResponse: grpcResp.GetRawResponse()}
	if analysis := grpcResp.GetAnalysis(); analysis != nil {
		result.Analysis.BrandMentioned = analysis.GetBrandMentioned()
		result.Analysis.BrandPosition = analysis.GetBrandPosition()
		result.Analysis.CitationFound = analysis.GetCitationFound()
		result.Analysis.CitedURLs = append([]string(nil), analysis.GetCitedUrls()...)
		result.Analysis.Sentiment = analysis.GetSentiment()
	}
	return result, nil
}

func (c *Client) ListModels(ctx context.Context, onlyActive bool) ([]usecase.AIModel, error) {
	token, err := internalauth.SignInternalJWT(c.jwtSecret, c.jwtIssuer, "ia-service", "project-service", internalauth.Claims{})
	if err != nil {
		return nil, fmt.Errorf("sign internal jwt: %w", err)
	}

	var grpcResp *iav1.ListModelsResponse
	err = c.executeWithResilience(ctx, 3, 50*time.Millisecond, c.attemptTimeout, func(attemptCtx context.Context) (bool, error) {
		callCtx := metadata.AppendToOutgoingContext(attemptCtx, "authorization", "Bearer "+token)
		resp, callErr := c.client.ListModels(callCtx, &iav1.ListModelsRequest{ActiveOnly: onlyActive})
		if callErr != nil {
			return isTransientGRPCError(callErr), callErr
		}
		grpcResp = resp
		return false, nil
	})
	if err != nil {
		return nil, fmt.Errorf("%w: ia model catalog unavailable: %v", usecase.ErrDependencyUnavailable, err)
	}
	models := make([]usecase.AIModel, 0, len(grpcResp.GetModels()))
	for _, model := range grpcResp.GetModels() {
		models = append(models, usecase.AIModel{
			ID:                 strings.TrimSpace(model.GetId()),
			Label:              strings.TrimSpace(model.GetDisplayName()),
			Provider:           strings.TrimSpace(model.GetProvider()),
			Group:              strings.TrimSpace(model.GetGroupName()),
			IconKey:            strings.TrimSpace(model.GetIconKey()),
			ModelID:            strings.TrimSpace(model.GetProviderModelId()),
			IsActive:           model.GetIsActive(),
			SupportsLiveSearch: model.GetSupportsLiveSearch(),
			Source:             strings.TrimSpace(model.GetSource()),
			CreditCost:         int(model.GetCreditCost()),
		})
	}
	return models, nil
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
