package cloudflarecrawl

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/usecase"
)

const (
	defaultBaseURL = "https://api.cloudflare.com"
	defaultTimeout = 30 * time.Second
)

var ErrAuthentication = errors.New("cloudflare crawl authentication failed")

type Config struct {
	AccountID  string
	APIToken   string
	BaseURL    string
	HTTPClient *http.Client
}

type Client struct {
	accountID  string
	apiToken   string
	baseURL    string
	httpClient *http.Client
	mu         sync.RWMutex
	nextMulti  int64
	multiJobs  map[string]multiCrawlJob
}

type multiCrawlJob struct {
	ID       string
	Children []multiCrawlChild
}

type multiCrawlChild struct {
	ID  string
	URL string
}

func NewClient(cfg Config) (*Client, error) {
	accountID := strings.TrimSpace(cfg.AccountID)
	if accountID == "" {
		return nil, fmt.Errorf("cloudflare account id is required")
	}
	apiToken := normalizeAPIToken(cfg.APIToken)
	if apiToken == "" {
		return nil, fmt.Errorf("cloudflare api token is required")
	}
	baseURL := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	if baseURL == "" {
		baseURL = defaultBaseURL
	}
	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: defaultTimeout}
	}
	return &Client{
		accountID:  accountID,
		apiToken:   apiToken,
		baseURL:    baseURL,
		httpClient: httpClient,
		multiJobs:  make(map[string]multiCrawlJob),
	}, nil
}

func normalizeAPIToken(value string) string {
	token := strings.TrimSpace(value)
	if strings.HasPrefix(strings.ToLower(token), "bearer ") {
		return strings.TrimSpace(token[len("bearer "):])
	}
	return token
}

func (c *Client) StartCrawl(ctx context.Context, input usecase.ContentOptimizerCrawlStartInput) (usecase.ContentOptimizerCrawlJob, error) {
	if len(input.Options.IncludePatterns) > 0 {
		return c.startSelectedURLCrawls(ctx, input)
	}
	return c.startSingleCrawl(ctx, input)
}

func (c *Client) startSelectedURLCrawls(ctx context.Context, input usecase.ContentOptimizerCrawlStartInput) (usecase.ContentOptimizerCrawlJob, error) {
	children := make([]multiCrawlChild, 0, len(input.Options.IncludePatterns))
	for _, selectedURL := range input.Options.IncludePatterns {
		selectedURL = strings.TrimSpace(selectedURL)
		if selectedURL == "" {
			continue
		}

		childInput := input
		childInput.URL = selectedURL
		childInput.Limit = 1
		childInput.Depth = 1
		childInput.Options.IncludePatterns = nil
		childInput.Options.ExcludePatterns = nil

		job, err := c.startSingleCrawl(ctx, childInput)
		if err != nil {
			return usecase.ContentOptimizerCrawlJob{}, err
		}
		children = append(children, multiCrawlChild{ID: job.ID, URL: selectedURL})
	}
	if len(children) == 0 {
		return usecase.ContentOptimizerCrawlJob{}, &apiError{
			operation:  "start",
			message:    "selected crawl requires at least one URL",
			validation: true,
		}
	}

	c.mu.Lock()
	c.nextMulti++
	jobID := "multi-" + strconv.FormatInt(c.nextMulti, 10)
	c.multiJobs[jobID] = multiCrawlJob{
		ID:       jobID,
		Children: append([]multiCrawlChild(nil), children...),
	}
	c.mu.Unlock()

	return usecase.ContentOptimizerCrawlJob{ID: jobID, Status: "running"}, nil
}

func (c *Client) startSingleCrawl(ctx context.Context, input usecase.ContentOptimizerCrawlStartInput) (usecase.ContentOptimizerCrawlJob, error) {
	body := map[string]any{
		"url":           input.URL,
		"limit":         input.Limit,
		"depth":         input.Depth,
		"source":        input.Source,
		"formats":       input.Formats,
		"render":        input.Render,
		"crawlPurposes": input.CrawlPurposes,
	}
	options := map[string]any{}
	if input.Options.IncludeExternalLinks {
		options["includeExternalLinks"] = true
	}
	if input.Options.IncludeSubdomains {
		options["includeSubdomains"] = true
	}
	if len(input.Options.IncludePatterns) > 0 {
		options["includePatterns"] = input.Options.IncludePatterns
	}
	if len(input.Options.ExcludePatterns) > 0 {
		options["excludePatterns"] = input.Options.ExcludePatterns
	}
	if len(options) > 0 {
		body["options"] = options
	}

	var envelope apiEnvelope[string]
	if err := c.doJSON(ctx, http.MethodPost, c.crawlURL(""), nil, body, &envelope); err != nil {
		return usecase.ContentOptimizerCrawlJob{}, err
	}
	if !envelope.Success || strings.TrimSpace(envelope.Result) == "" {
		return usecase.ContentOptimizerCrawlJob{}, newAPIErrorFromEnvelope("start", envelope)
	}
	return usecase.ContentOptimizerCrawlJob{ID: envelope.Result, Status: "running"}, nil
}

func (c *Client) GetCrawl(ctx context.Context, jobID string, input usecase.ContentOptimizerCrawlResultInput) (usecase.ContentOptimizerCrawlResult, error) {
	if job, ok := c.multiCrawlJob(jobID); ok {
		return c.getSelectedURLCrawls(ctx, job, input)
	}
	return c.getSingleCrawl(ctx, jobID, input)
}

func (c *Client) multiCrawlJob(jobID string) (multiCrawlJob, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	job, ok := c.multiJobs[strings.TrimSpace(jobID)]
	if !ok {
		return multiCrawlJob{}, false
	}
	job.Children = append([]multiCrawlChild(nil), job.Children...)
	return job, true
}

func (c *Client) getSelectedURLCrawls(ctx context.Context, job multiCrawlJob, input usecase.ContentOptimizerCrawlResultInput) (usecase.ContentOptimizerCrawlResult, error) {
	records := make([]usecase.ContentOptimizerCrawlRecord, 0, len(job.Children))
	browserSecondsUsed := 0.0
	finished := 0
	running := false
	errored := false

	childInput := input
	childInput.Limit = 1
	childInput.Cursor = ""

	for _, child := range job.Children {
		result, err := c.getSingleCrawl(ctx, child.ID, childInput)
		if err != nil {
			return usecase.ContentOptimizerCrawlResult{}, err
		}

		browserSecondsUsed += result.BrowserSecondsUsed
		if isCloudflareTerminalJobStatus(result.Status) {
			finished++
		} else {
			running = true
		}
		if strings.EqualFold(strings.TrimSpace(result.Status), "errored") {
			errored = true
		}

		for _, record := range result.Records {
			if strings.TrimSpace(record.URL) == "" {
				record.URL = child.URL
			}
			records = append(records, record)
		}
	}

	limit := input.Limit
	if limit > 0 && len(records) > limit {
		records = records[:limit]
	}

	status := "completed"
	if running {
		status = "running"
	} else if errored && len(records) == 0 {
		status = "errored"
	}

	return usecase.ContentOptimizerCrawlResult{
		ID:                 job.ID,
		Status:             status,
		BrowserSecondsUsed: browserSecondsUsed,
		Total:              len(job.Children),
		Finished:           finished,
		Records:            records,
	}, nil
}

func isCloudflareTerminalJobStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "completed", "errored", "cancelled_due_to_timeout", "cancelled_due_to_limits", "cancelled_by_user":
		return true
	default:
		return false
	}
}

func (c *Client) getSingleCrawl(ctx context.Context, jobID string, input usecase.ContentOptimizerCrawlResultInput) (usecase.ContentOptimizerCrawlResult, error) {
	query := url.Values{}
	if input.Cursor != "" {
		query.Set("cursor", input.Cursor)
	}
	if input.Limit > 0 {
		query.Set("limit", strconv.Itoa(input.Limit))
	}
	if input.Status != "" {
		query.Set("status", input.Status)
	}

	var envelope apiEnvelope[crawlResultPayload]
	if err := c.doJSON(ctx, http.MethodGet, c.crawlURL(jobID), query, nil, &envelope); err != nil {
		return usecase.ContentOptimizerCrawlResult{}, err
	}
	if !envelope.Success {
		return usecase.ContentOptimizerCrawlResult{}, newAPIErrorFromEnvelope("result", envelope)
	}
	return envelope.Result.toUsecase(), nil
}

func (c *Client) crawlURL(jobID string) string {
	path := c.baseURL + "/client/v4/accounts/" + url.PathEscape(c.accountID) + "/browser-rendering/crawl"
	if strings.TrimSpace(jobID) != "" {
		path += "/" + url.PathEscape(strings.TrimSpace(jobID))
	}
	return path
}

func (c *Client) doJSON(ctx context.Context, method, rawURL string, query url.Values, body any, out any) error {
	if len(query) > 0 {
		rawURL += "?" + query.Encode()
	}

	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("encode cloudflare crawl request: %w", err)
		}
		reader = bytes.NewReader(payload)
	}

	req, err := http.NewRequestWithContext(ctx, method, rawURL, reader)
	if err != nil {
		return fmt.Errorf("create cloudflare crawl request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return &apiError{
			message: "send cloudflare crawl request: " + err.Error(),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 16<<10))
		message := strings.TrimSpace(string(raw))
		if message == "" {
			message = http.StatusText(resp.StatusCode)
		}
		return newAPIErrorFromStatus(resp.StatusCode, message)
	}

	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return &apiError{
			message: "decode cloudflare crawl response: " + err.Error(),
		}
	}
	return nil
}

type apiEnvelope[T any] struct {
	Success bool             `json:"success"`
	Result  T                `json:"result"`
	Errors  []apiErrorObject `json:"errors"`
}

type apiErrorObject struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (e apiEnvelope[T]) errorMessage() string {
	messages := make([]string, 0, len(e.Errors))
	for _, item := range e.Errors {
		if message := strings.TrimSpace(item.Message); message != "" {
			messages = append(messages, message)
		}
	}
	if len(messages) == 0 {
		return "unknown error"
	}
	return strings.Join(messages, "; ")
}

type apiError struct {
	operation      string
	statusCode     int
	message        string
	authentication bool
	rateLimited    bool
	validation     bool
}

func (e *apiError) Error() string {
	message := strings.TrimSpace(e.message)
	if message == "" {
		message = "unknown error"
	}
	switch {
	case e.authentication:
		return "cloudflare crawl authentication failed: " + message
	case e.rateLimited:
		if e.operation != "" {
			return "quota exceeded: cloudflare crawl " + e.operation + " failed: " + message
		}
		return "quota exceeded: cloudflare crawl failed: " + message
	case e.validation:
		if e.operation != "" {
			return "validation error: cloudflare crawl " + e.operation + " request invalid: " + message
		}
		return "validation error: cloudflare crawl request invalid: " + message
	default:
		if e.operation != "" {
			return "dependency unavailable: cloudflare crawl " + e.operation + " failed: " + message
		}
		return "dependency unavailable: cloudflare crawl failed: " + message
	}
}

func (e *apiError) Is(target error) bool {
	switch target {
	case ErrAuthentication:
		return e.authentication
	case usecase.ErrQuotaExceeded:
		return e.rateLimited
	case usecase.ErrValidation:
		return e.validation
	case usecase.ErrDependencyUnavailable:
		return !e.validation && !e.rateLimited
	default:
		return false
	}
}

func newAPIErrorFromStatus(statusCode int, message string) error {
	rateLimited := statusCode == http.StatusTooManyRequests || containsRateLimitMessage(message)
	return &apiError{
		statusCode:     statusCode,
		message:        message,
		authentication: statusCode == http.StatusUnauthorized || statusCode == http.StatusForbidden,
		rateLimited:    rateLimited,
		validation:     !rateLimited && (statusCode == http.StatusBadRequest || statusCode == http.StatusUnprocessableEntity),
	}
}

func newAPIErrorFromEnvelope[T any](operation string, envelope apiEnvelope[T]) error {
	message := envelope.errorMessage()
	authentication := envelope.hasErrorCode(10000) || containsAuthenticationMessage(message)
	rateLimited := envelope.hasErrorCode(2001) || containsRateLimitMessage(message)
	return &apiError{
		operation:      operation,
		message:        message,
		authentication: authentication,
		rateLimited:    !authentication && rateLimited,
		validation:     !authentication && !rateLimited && envelope.hasValidationError(),
	}
}

func (e apiEnvelope[T]) hasErrorCode(code int) bool {
	for _, item := range e.Errors {
		if item.Code == code {
			return true
		}
	}
	return false
}

func (e apiEnvelope[T]) hasValidationError() bool {
	for _, item := range e.Errors {
		if item.Code == 1000 {
			return true
		}
	}
	return false
}

func containsAuthenticationMessage(message string) bool {
	message = strings.ToLower(strings.TrimSpace(message))
	return strings.Contains(message, "authentication")
}

func containsRateLimitMessage(message string) bool {
	message = strings.ToLower(strings.TrimSpace(message))
	return strings.Contains(message, "rate limit exceeded") || strings.Contains(message, "rate limited")
}

type crawlResultPayload struct {
	ID                 string               `json:"id"`
	Status             string               `json:"status"`
	BrowserSecondsUsed float64              `json:"browserSecondsUsed"`
	Total              int                  `json:"total"`
	Finished           int                  `json:"finished"`
	Records            []crawlRecordPayload `json:"records"`
	Cursor             json.RawMessage      `json:"cursor"`
}

type crawlRecordPayload struct {
	URL      string              `json:"url"`
	Status   string              `json:"status"`
	Markdown string              `json:"markdown"`
	HTML     string              `json:"html"`
	JSON     any                 `json:"json"`
	Metadata crawlRecordMetadata `json:"metadata"`
}

type crawlRecordMetadata struct {
	Status int    `json:"status"`
	Title  string `json:"title"`
	URL    string `json:"url"`
}

func (p crawlResultPayload) toUsecase() usecase.ContentOptimizerCrawlResult {
	records := make([]usecase.ContentOptimizerCrawlRecord, 0, len(p.Records))
	for _, record := range p.Records {
		recordURL := strings.TrimSpace(record.URL)
		if recordURL == "" {
			recordURL = strings.TrimSpace(record.Metadata.URL)
		}
		records = append(records, usecase.ContentOptimizerCrawlRecord{
			URL:        recordURL,
			Status:     record.Status,
			HTTPStatus: record.Metadata.Status,
			Title:      record.Metadata.Title,
			Markdown:   record.Markdown,
			HTML:       record.HTML,
			JSON:       record.JSON,
		})
	}

	return usecase.ContentOptimizerCrawlResult{
		ID:                 p.ID,
		Status:             p.Status,
		BrowserSecondsUsed: p.BrowserSecondsUsed,
		Total:              p.Total,
		Finished:           p.Finished,
		Records:            records,
		Cursor:             parseCursor(p.Cursor),
	}
}

func parseCursor(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}
	var value string
	if err := json.Unmarshal(raw, &value); err == nil {
		return value
	}
	return strings.TrimSpace(string(raw))
}
