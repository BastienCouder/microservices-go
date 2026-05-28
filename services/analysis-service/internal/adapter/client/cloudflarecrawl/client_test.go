package cloudflarecrawl

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/usecase"
)

func TestStartCrawlPostsCloudflarePayload(t *testing.T) {
	var gotAuthorization string
	var gotPath string
	var gotBody map[string]any

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuthorization = r.Header.Get("Authorization")
		gotPath = r.URL.Path
		if err := json.NewDecoder(r.Body).Decode(&gotBody); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"result":"crawl-123"}`))
	}))
	defer server.Close()

	client, err := NewClient(Config{
		AccountID: "account-1",
		APIToken:  "token-1",
		BaseURL:   server.URL,
	})
	if err != nil {
		t.Fatalf("new cloudflare crawl client: %v", err)
	}

	job, err := client.StartCrawl(context.Background(), usecase.ContentOptimizerCrawlStartInput{
		URL:     "https://example.com",
		Limit:   12,
		Depth:   2,
		Formats: []string{"markdown"},
		Render:  false,
	})
	if err != nil {
		t.Fatalf("start crawl: %v", err)
	}

	if job.ID != "crawl-123" || job.Status != "running" {
		t.Fatalf("unexpected job: %#v", job)
	}
	if gotAuthorization != "Bearer token-1" {
		t.Fatalf("expected bearer token, got %q", gotAuthorization)
	}
	if gotPath != "/client/v4/accounts/account-1/browser-rendering/crawl" {
		t.Fatalf("unexpected path %q", gotPath)
	}
	if gotBody["url"] != "https://example.com" {
		t.Fatalf("expected url in request, got %#v", gotBody["url"])
	}
	if gotBody["render"] != false {
		t.Fatalf("expected render false, got %#v", gotBody["render"])
	}
}

func TestSelectedURLsStartOneDirectCrawlPerURL(t *testing.T) {
	requestedURLs := make([]string, 0)
	resultByID := map[string]string{
		"crawl-1": "https://example.com/pricing",
		"crawl-2": "https://example.com/docs",
	}
	nextJob := 1

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.Method {
		case http.MethodPost:
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Fatalf("decode request body: %v", err)
			}
			requestedURL, _ := body["url"].(string)
			requestedURLs = append(requestedURLs, requestedURL)
			if _, ok := body["options"]; ok {
				t.Fatalf("selected direct crawl must not forward includePatterns, got %#v", body["options"])
			}
			jobID := "crawl-" + string(rune('0'+nextJob))
			nextJob++
			_, _ = w.Write([]byte(`{"success":true,"result":"` + jobID + `"}`))
		case http.MethodGet:
			jobID := r.URL.Path[strings.LastIndex(r.URL.Path, "/")+1:]
			recordURL := resultByID[jobID]
			_, _ = w.Write([]byte(`{
				"success": true,
				"result": {
					"id": "` + jobID + `",
					"status": "completed",
					"total": 1,
					"finished": 1,
					"records": [{
						"url": "` + recordURL + `",
						"status": "completed",
						"markdown": "# Page",
						"metadata": {"status": 200, "title": "Page", "url": "` + recordURL + `"}
					}]
				}
			}`))
		default:
			t.Fatalf("unexpected method %s", r.Method)
		}
	}))
	defer server.Close()

	client, err := NewClient(Config{
		AccountID: "account-1",
		APIToken:  "token-1",
		BaseURL:   server.URL,
	})
	if err != nil {
		t.Fatalf("new cloudflare crawl client: %v", err)
	}

	job, err := client.StartCrawl(context.Background(), usecase.ContentOptimizerCrawlStartInput{
		URL:     "https://example.com",
		Limit:   2,
		Depth:   1,
		Formats: []string{"markdown"},
		Options: usecase.ContentOptimizerCrawlOptions{
			IncludePatterns: []string{
				"https://example.com/pricing",
				"https://example.com/docs",
			},
		},
	})
	if err != nil {
		t.Fatalf("start selected crawl: %v", err)
	}
	if job.ID == "" || job.Status != "running" {
		t.Fatalf("unexpected selected job: %#v", job)
	}
	if len(requestedURLs) != 2 {
		t.Fatalf("expected two direct crawls, got %d: %#v", len(requestedURLs), requestedURLs)
	}
	if requestedURLs[0] != "https://example.com/pricing" || requestedURLs[1] != "https://example.com/docs" {
		t.Fatalf("unexpected requested urls: %#v", requestedURLs)
	}

	result, err := client.GetCrawl(context.Background(), job.ID, usecase.ContentOptimizerCrawlResultInput{
		Limit: 10,
	})
	if err != nil {
		t.Fatalf("get selected crawl: %v", err)
	}
	if result.Status != "completed" || result.Total != 2 || result.Finished != 2 {
		t.Fatalf("unexpected selected result summary: %#v", result)
	}
	if len(result.Records) != 2 {
		t.Fatalf("expected two selected records, got %d", len(result.Records))
	}
	if result.Records[0].URL != "https://example.com/pricing" || result.Records[1].URL != "https://example.com/docs" {
		t.Fatalf("unexpected selected records: %#v", result.Records)
	}
}

func TestStartCrawlNormalizesBearerTokenPrefix(t *testing.T) {
	var gotAuthorization string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuthorization = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"result":"crawl-123"}`))
	}))
	defer server.Close()

	client, err := NewClient(Config{
		AccountID: "account-1",
		APIToken:  "Bearer token-1",
		BaseURL:   server.URL,
	})
	if err != nil {
		t.Fatalf("new cloudflare crawl client: %v", err)
	}

	_, err = client.StartCrawl(context.Background(), usecase.ContentOptimizerCrawlStartInput{
		URL:     "https://example.com",
		Limit:   12,
		Depth:   2,
		Formats: []string{"markdown"},
	})
	if err != nil {
		t.Fatalf("start crawl: %v", err)
	}

	if gotAuthorization != "Bearer token-1" {
		t.Fatalf("expected normalized bearer token, got %q", gotAuthorization)
	}
}

func TestGetCrawlMapsCompletedRecords(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("status") != "completed" {
			t.Fatalf("expected completed status filter, got %q", r.URL.Query().Get("status"))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"success": true,
			"result": {
				"id": "crawl-123",
				"status": "completed",
				"browserSecondsUsed": 4.5,
				"total": 1,
				"finished": 1,
				"records": [{
					"url": "https://example.com",
					"status": "completed",
					"markdown": "# Home",
					"metadata": {
						"status": 200,
						"title": "Home",
						"url": "https://example.com"
					}
				}]
			}
		}`))
	}))
	defer server.Close()

	client, err := NewClient(Config{
		AccountID: "account-1",
		APIToken:  "token-1",
		BaseURL:   server.URL,
	})
	if err != nil {
		t.Fatalf("new cloudflare crawl client: %v", err)
	}

	result, err := client.GetCrawl(context.Background(), "crawl-123", usecase.ContentOptimizerCrawlResultInput{
		Status: "completed",
	})
	if err != nil {
		t.Fatalf("get crawl: %v", err)
	}

	if result.Status != "completed" || result.Total != 1 || result.BrowserSecondsUsed != 4.5 {
		t.Fatalf("unexpected result summary: %#v", result)
	}
	if len(result.Records) != 1 {
		t.Fatalf("expected one record, got %d", len(result.Records))
	}
	if result.Records[0].Title != "Home" || result.Records[0].HTTPStatus != 200 {
		t.Fatalf("unexpected record: %#v", result.Records[0])
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func TestStartCrawlMapsTransportErrorsToDependencyUnavailable(t *testing.T) {
	client, err := NewClient(Config{
		AccountID: "account-1",
		APIToken:  "token-1",
		BaseURL:   "https://example.com",
		HTTPClient: &http.Client{
			Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
				return nil, errors.New("dial timeout")
			}),
		},
	})
	if err != nil {
		t.Fatalf("new cloudflare crawl client: %v", err)
	}

	_, err = client.StartCrawl(context.Background(), usecase.ContentOptimizerCrawlStartInput{
		URL:     "https://example.com",
		Limit:   12,
		Depth:   2,
		Formats: []string{"markdown"},
	})
	if !errors.Is(err, usecase.ErrDependencyUnavailable) {
		t.Fatalf("expected dependency unavailable, got %v", err)
	}
}

func TestStartCrawlMapsDecodeErrorsToDependencyUnavailable(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `not-json`)
	}))
	defer server.Close()

	client, err := NewClient(Config{
		AccountID: "account-1",
		APIToken:  "token-1",
		BaseURL:   server.URL,
	})
	if err != nil {
		t.Fatalf("new cloudflare crawl client: %v", err)
	}

	_, err = client.StartCrawl(context.Background(), usecase.ContentOptimizerCrawlStartInput{
		URL:     "https://example.com",
		Limit:   12,
		Depth:   2,
		Formats: []string{"markdown"},
	})
	if !errors.Is(err, usecase.ErrDependencyUnavailable) {
		t.Fatalf("expected dependency unavailable, got %v", err)
	}
}
