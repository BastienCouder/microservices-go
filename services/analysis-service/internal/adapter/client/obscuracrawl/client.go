package obscuracrawl

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

type Config struct {
	BaseURL    string
	Token      string
	HTTPClient *http.Client
}

type Client struct {
	baseURL string
	token   string
	http    *http.Client
}

func NewClient(cfg Config) (*Client, error) {
	baseURL := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	if baseURL == "" {
		return nil, fmt.Errorf("crawler service URL is required")
	}
	if _, err := url.ParseRequestURI(baseURL); err != nil {
		return nil, fmt.Errorf("invalid crawler service URL: %w", err)
	}
	client := cfg.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 60 * time.Second}
	}
	return &Client{baseURL: baseURL, token: strings.TrimSpace(cfg.Token), http: client}, nil
}

func (c *Client) StartCrawl(ctx context.Context, input usecase.ContentOptimizerCrawlStartInput) (usecase.ContentOptimizerCrawlJob, error) {
	var job usecase.ContentOptimizerCrawlJob
	err := c.do(ctx, http.MethodPost, "/internal/crawls", nil, map[string]any{
		"projectId": input.ProjectID, "organizationId": input.OrganizationID,
		"url": input.URL, "limit": input.Limit, "depth": input.Depth,
		"options": input.Options,
	}, &job)
	return job, err
}

func (c *Client) GetCrawl(ctx context.Context, jobID string, input usecase.ContentOptimizerCrawlResultInput) (usecase.ContentOptimizerCrawlResult, error) {
	query := url.Values{}
	if input.Limit > 0 {
		query.Set("limit", strconv.Itoa(input.Limit))
	}
	if input.Status != "" {
		query.Set("status", input.Status)
	}
	if input.Cursor != "" {
		query.Set("cursor", input.Cursor)
	}
	var result usecase.ContentOptimizerCrawlResult
	err := c.do(ctx, http.MethodGet, "/internal/crawls/"+url.PathEscape(jobID), query, nil, &result)
	return result, err
}

func (c *Client) GetLatestCrawl(ctx context.Context, projectID string, organizationID int64) (usecase.ContentOptimizerCrawlSnapshot, error) {
	query := url.Values{"projectId": {projectID}, "organizationId": {strconv.FormatInt(organizationID, 10)}}
	var snapshot *usecase.ContentOptimizerCrawlSnapshot
	if err := c.do(ctx, http.MethodGet, "/internal/crawls/latest", query, nil, &snapshot); err != nil {
		return usecase.ContentOptimizerCrawlSnapshot{}, err
	}
	if snapshot == nil {
		return usecase.ContentOptimizerCrawlSnapshot{}, fmt.Errorf("%w: content optimizer crawl not found", usecase.ErrNotFound)
	}
	return *snapshot, nil
}

func (c *Client) do(ctx context.Context, method, path string, query url.Values, body any, output any) error {
	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(payload)
	}
	target := c.baseURL + path
	if len(query) > 0 {
		target += "?" + query.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, method, target, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("%w: crawler service: %v", usecase.ErrDependencyUnavailable, err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	payload, err := io.ReadAll(io.LimitReader(resp.Body, 64<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var failure struct {
			Error string `json:"error"`
		}
		_ = json.Unmarshal(payload, &failure)
		if failure.Error == "" {
			failure.Error = string(payload)
		}
		return fmt.Errorf("%w: crawler service returned %d: %s", usecase.ErrDependencyUnavailable, resp.StatusCode, failure.Error)
	}
	if output != nil && len(payload) > 0 {
		if err := json.Unmarshal(payload, output); err != nil {
			return fmt.Errorf("decode crawler response: %w", err)
		}
	}
	return nil
}
