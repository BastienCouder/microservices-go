package kratos

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/auth-service/internal/domain"
)

type Client struct {
	baseURL    string
	appReturn  string
	httpClient *http.Client
	breaker    *circuitBreaker
	bulkhead   *bulkhead
}

func NewClient(baseURL, appReturnURL string) *Client {
	transport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           (&net.Dialer{Timeout: 2 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   50,
		IdleConnTimeout:       90 * time.Second,
		ResponseHeaderTimeout: 2 * time.Second,
		TLSHandshakeTimeout:   2 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}
	return &Client{
		baseURL:   strings.TrimRight(baseURL, "/"),
		appReturn: strings.TrimSpace(appReturnURL),
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   3 * time.Second,
		},
		breaker:  newCircuitBreaker(5, 30*time.Second),
		bulkhead: newBulkhead(128),
	}
}

func (c *Client) WhoAmI(ctx context.Context, cookieHeader, sessionToken string) (*domain.Session, int, error) {
	resp, body, err := c.doWithResilience(ctx, 3, 50*time.Millisecond, 900*time.Millisecond, func(attemptCtx context.Context) (*http.Request, error) {
		req, reqErr := http.NewRequestWithContext(attemptCtx, http.MethodGet, c.baseURL+"/sessions/whoami", nil)
		if reqErr != nil {
			return nil, reqErr
		}
		if cookieHeader != "" {
			req.Header.Set("Cookie", cookieHeader)
		}
		if sessionToken != "" {
			req.Header.Set("X-Session-Token", sessionToken)
		}
		return req, nil
	})
	if err != nil {
		return nil, 0, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, resp.StatusCode, nil
	}
	var session domain.Session
	if err := json.Unmarshal(body, &session); err != nil {
		return nil, 0, fmt.Errorf("decode kratos whoami response: %w", err)
	}
	return &session, resp.StatusCode, nil
}

func (c *Client) InitFlow(ctx context.Context, mode, returnTo, cookieHeader string) (*domain.BrowserFlow, []string, int, error) {
	path, err := flowInitPath(mode, firstNonEmpty(strings.TrimSpace(returnTo), c.appReturn))
	if err != nil {
		return nil, nil, 0, err
	}
	resp, body, err := c.doWithResilience(ctx, 3, 50*time.Millisecond, 900*time.Millisecond, func(attemptCtx context.Context) (*http.Request, error) {
		req, reqErr := http.NewRequestWithContext(attemptCtx, http.MethodGet, c.baseURL+path, nil)
		if reqErr != nil {
			return nil, reqErr
		}
		req.Header.Set("Accept", "application/json")
		if cookieHeader != "" {
			req.Header.Set("Cookie", cookieHeader)
		}
		return req, nil
	})
	if err != nil {
		return nil, nil, 0, err
	}
	var flow domain.BrowserFlow
	if err := json.Unmarshal(body, &flow); err != nil {
		return nil, nil, 0, fmt.Errorf("decode kratos flow init: %w", err)
	}
	return &flow, resp.Header.Values("Set-Cookie"), resp.StatusCode, nil
}

func (c *Client) SubmitFlow(ctx context.Context, mode, flowID string, payload any, cookieHeader string) (domain.RawJSON, []string, int, error) {
	if flowID == "" {
		return nil, nil, 0, fmt.Errorf("missing flow id")
	}

	flowPath, err := flowSubmitPath(mode)
	if err != nil {
		return nil, nil, 0, err
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, nil, 0, err
	}

	endpoint := c.baseURL + flowPath + "?flow=" + url.QueryEscape(flowID)
	resp, raw, err := c.doWithResilience(ctx, 3, 50*time.Millisecond, 900*time.Millisecond, func(attemptCtx context.Context) (*http.Request, error) {
		req, reqErr := http.NewRequestWithContext(attemptCtx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
		if reqErr != nil {
			return nil, reqErr
		}
		req.Header.Set("Accept", "application/json")
		req.Header.Set("Content-Type", "application/json")
		if cookieHeader != "" {
			req.Header.Set("Cookie", cookieHeader)
		}
		return req, nil
	})
	if err != nil {
		return nil, nil, 0, err
	}

	// Some Kratos OIDC flows answer with a redirect Location header (3xx) and
	// an empty body. Expose that redirect in JSON so upper layers can route the browser.
	if location := strings.TrimSpace(resp.Header.Get("Location")); location != "" {
		trimmed := bytes.TrimSpace(raw)
		if len(trimmed) == 0 {
			encoded, marshalErr := json.Marshal(map[string]string{"redirect_to": location})
			if marshalErr == nil {
				raw = encoded
			}
		}
	}

	return raw, resp.Header.Values("Set-Cookie"), resp.StatusCode, nil
}

func (c *Client) InitLogout(ctx context.Context, cookieHeader string) (*domain.LogoutInitResponse, []string, int, error) {
	resp, body, err := c.doWithResilience(ctx, 3, 50*time.Millisecond, 900*time.Millisecond, func(attemptCtx context.Context) (*http.Request, error) {
		req, reqErr := http.NewRequestWithContext(attemptCtx, http.MethodGet, c.baseURL+"/self-service/logout/browser", nil)
		if reqErr != nil {
			return nil, reqErr
		}
		req.Header.Set("Accept", "application/json")
		if cookieHeader != "" {
			req.Header.Set("Cookie", cookieHeader)
		}
		return req, nil
	})
	if err != nil {
		return nil, nil, 0, err
	}
	var payload domain.LogoutInitResponse
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, nil, 0, fmt.Errorf("decode logout init response: %w", err)
	}

	return &payload, resp.Header.Values("Set-Cookie"), resp.StatusCode, nil
}

func (c *Client) CompleteLogout(ctx context.Context, logoutURL, cookieHeader string) ([]string, int, error) {
	targetURL := c.rewriteToInternalBase(logoutURL)
	resp, _, err := c.doWithResilienceNoRedirect(ctx, 3, 50*time.Millisecond, 900*time.Millisecond, func(attemptCtx context.Context) (*http.Request, error) {
		req, reqErr := http.NewRequestWithContext(attemptCtx, http.MethodGet, targetURL, nil)
		if reqErr != nil {
			return nil, reqErr
		}
		if cookieHeader != "" {
			req.Header.Set("Cookie", cookieHeader)
		}
		return req, nil
	})
	if err != nil {
		return nil, 0, err
	}
	return resp.Header.Values("Set-Cookie"), resp.StatusCode, nil
}

func (c *Client) rewriteToInternalBase(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return raw
	}
	target, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	base, err := url.Parse(c.baseURL)
	if err != nil {
		return raw
	}
	if target.Host == "" || base.Host == "" {
		return raw
	}

	host := strings.ToLower(target.Hostname())
	if host == "localhost" || host == "127.0.0.1" {
		target.Scheme = base.Scheme
		target.Host = base.Host
		return target.String()
	}
	return raw
}

func (c *Client) doWithResilience(
	ctx context.Context,
	attempts int,
	baseBackoff time.Duration,
	attemptTimeout time.Duration,
	reqBuilder func(context.Context) (*http.Request, error),
) (*http.Response, []byte, error) {
	return c.doWithClient(ctx, c.httpClient, attempts, baseBackoff, attemptTimeout, reqBuilder)
}

func (c *Client) doWithResilienceNoRedirect(
	ctx context.Context,
	attempts int,
	baseBackoff time.Duration,
	attemptTimeout time.Duration,
	reqBuilder func(context.Context) (*http.Request, error),
) (*http.Response, []byte, error) {
	noRedirectClient := *c.httpClient
	noRedirectClient.CheckRedirect = func(_ *http.Request, _ []*http.Request) error {
		return http.ErrUseLastResponse
	}
	return c.doWithClient(ctx, &noRedirectClient, attempts, baseBackoff, attemptTimeout, reqBuilder)
}

func (c *Client) doWithClient(
	ctx context.Context,
	client *http.Client,
	attempts int,
	baseBackoff time.Duration,
	attemptTimeout time.Duration,
	reqBuilder func(context.Context) (*http.Request, error),
) (*http.Response, []byte, error) {
	if attempts <= 0 {
		return nil, nil, fmt.Errorf("attempts must be positive")
	}
	if err := c.breaker.Allow(time.Now().UTC()); err != nil {
		return nil, nil, err
	}
	release, err := c.bulkhead.Acquire(ctx)
	if err != nil {
		return nil, nil, err
	}
	defer release()

	backoff := baseBackoff
	var lastErr error
	for i := 0; i < attempts; i++ {
		attemptCtx, cancel := context.WithTimeout(ctx, attemptTimeout)
		req, reqErr := reqBuilder(attemptCtx)
		if reqErr != nil {
			cancel()
			c.breaker.OnFailure(time.Now().UTC())
			return nil, nil, reqErr
		}
		resp, doErr := client.Do(req)
		if doErr != nil {
			cancel()
			lastErr = doErr
			if !isTransientError(doErr) || i == attempts-1 {
				c.breaker.OnFailure(time.Now().UTC())
				return nil, nil, doErr
			}
			if err := sleepWithContext(ctx, backoff); err != nil {
				c.breaker.OnFailure(time.Now().UTC())
				return nil, nil, err
			}
			backoff *= 2
			continue
		}
		body, readErr := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		cancel()
		if readErr != nil {
			lastErr = readErr
			if i == attempts-1 {
				c.breaker.OnFailure(time.Now().UTC())
				return nil, nil, readErr
			}
			if err := sleepWithContext(ctx, backoff); err != nil {
				c.breaker.OnFailure(time.Now().UTC())
				return nil, nil, err
			}
			backoff *= 2
			continue
		}
		if isTransientHTTPStatus(resp.StatusCode) && i < attempts-1 {
			lastErr = fmt.Errorf("kratos status=%d", resp.StatusCode)
			if err := sleepWithContext(ctx, backoff); err != nil {
				c.breaker.OnFailure(time.Now().UTC())
				return nil, nil, err
			}
			backoff *= 2
			continue
		}
		c.breaker.OnSuccess()
		resp.Body = io.NopCloser(bytes.NewReader(body))
		return resp, body, nil
	}
	c.breaker.OnFailure(time.Now().UTC())
	return nil, nil, lastErr
}

func isTransientHTTPStatus(status int) bool {
	return status == http.StatusTooManyRequests || status == http.StatusBadGateway || status == http.StatusServiceUnavailable || status == http.StatusGatewayTimeout
}

func flowInitPath(mode, appReturnURL string) (string, error) {
	withReturn := func(path string) string {
		if strings.TrimSpace(appReturnURL) == "" {
			return path
		}
		sep := "?"
		if strings.Contains(path, "?") {
			sep = "&"
		}
		return path + sep + "return_to=" + url.QueryEscape(strings.TrimSpace(appReturnURL))
	}

	switch mode {
	case "login":
		return withReturn("/self-service/login/browser?refresh=true"), nil
	case "registration":
		return withReturn("/self-service/registration/browser"), nil
	default:
		return "", fmt.Errorf("invalid mode: %s", mode)
	}
}

func flowSubmitPath(mode string) (string, error) {
	switch mode {
	case "login":
		return "/self-service/login", nil
	case "registration":
		return "/self-service/registration", nil
	default:
		return "", fmt.Errorf("invalid mode: %s", mode)
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
