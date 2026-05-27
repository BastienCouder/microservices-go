package cloudflarecrawl

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
