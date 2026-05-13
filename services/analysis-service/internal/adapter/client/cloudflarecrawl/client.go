package cloudflarecrawl

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/usecase"
)

const (
	defaultBaseURL = "https://api.cloudflare.com"
	defaultTimeout = 30 * time.Second
)

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
}

func NewClient(cfg Config) (*Client, error) {
	accountID := strings.TrimSpace(cfg.AccountID)
	if accountID == "" {
		return nil, fmt.Errorf("cloudflare account id is required")
	}
	apiToken := strings.TrimSpace(cfg.APIToken)
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
	}, nil
}

func (c *Client) StartCrawl(ctx context.Context, input usecase.ContentOptimizerCrawlStartInput) (usecase.ContentOptimizerCrawlJob, error) {
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
		return usecase.ContentOptimizerCrawlJob{}, fmt.Errorf("cloudflare crawl start failed: %s", envelope.errorMessage())
	}
	return usecase.ContentOptimizerCrawlJob{ID: envelope.Result, Status: "running"}, nil
}

func (c *Client) GetCrawl(ctx context.Context, jobID string, input usecase.ContentOptimizerCrawlResultInput) (usecase.ContentOptimizerCrawlResult, error) {
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
		return usecase.ContentOptimizerCrawlResult{}, fmt.Errorf("cloudflare crawl result failed: %s", envelope.errorMessage())
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
		return fmt.Errorf("send cloudflare crawl request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 16<<10))
		message := strings.TrimSpace(string(raw))
		if message == "" {
			message = http.StatusText(resp.StatusCode)
		}
		return fmt.Errorf("cloudflare crawl error (%d): %s", resp.StatusCode, message)
	}

	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode cloudflare crawl response: %w", err)
	}
	return nil
}

type apiEnvelope[T any] struct {
	Success bool             `json:"success"`
	Result  T                `json:"result"`
	Errors  []apiErrorObject `json:"errors"`
}

type apiErrorObject struct {
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
