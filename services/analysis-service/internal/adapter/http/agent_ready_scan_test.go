package http

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/bastiencouder/microservices-go/contracts/pkg/httpjson"
	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/usecase"
)

func TestAgentReadyScanScoresSelectedChecks(t *testing.T) {
	result := scoreAgentReadyScan("https://example.com", "content-site", []agentReadyCheckResult{
		{ID: "robots_txt", CategoryID: "discoverability", Status: "pass", MaxScore: 10},
		{ID: "sitemap", CategoryID: "discoverability", Status: "warning", MaxScore: 10},
		{ID: "link_headers", CategoryID: "discoverability", Status: "fail", MaxScore: 15},
		{ID: "markdown_negotiation", CategoryID: "content", Status: "pass", MaxScore: 35},
		{ID: "ai_bot_rules", CategoryID: "bot_access", Status: "warning", MaxScore: 10},
		{ID: "content_signals", CategoryID: "bot_access", Status: "fail", MaxScore: 20},
	})

	if result.Score != 55 {
		t.Fatalf("expected global score 55, got %d", result.Score)
	}
	if result.Level != "Partially Ready" {
		t.Fatalf("expected partially ready level, got %q", result.Level)
	}
	if result.Summary.Passed != 2 || result.Summary.Warning != 2 || result.Summary.Failed != 2 {
		t.Fatalf("unexpected summary: %+v", result.Summary)
	}
	if result.Categories[0].Score != 15 || result.Categories[0].MaxScore != 35 {
		t.Fatalf("unexpected discoverability category: %+v", result.Categories[0])
	}
}

func TestAgentReadyAnalyzerDetectsContentSiteSignals(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/robots.txt":
			w.Header().Set("Content-Type", "text/plain")
			_, _ = w.Write([]byte("User-agent: *\nAllow: /\nSitemap: " + "http://" + r.Host + "/sitemap.xml\nUser-agent: GPTBot\nDisallow: /\n"))
		case "/sitemap.xml":
			w.Header().Set("Content-Type", "application/xml")
			_, _ = w.Write([]byte(`<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/</loc></url></urlset>`))
		default:
			w.Header().Add("Link", `<https://example.com/.well-known/ai-plugin.json>; rel="service"`)
			w.Header().Set("Content-Signal", "ai-training=restricted")
			if strings.Contains(r.Header.Get("Accept"), "text/markdown") {
				w.Header().Set("Content-Type", "text/markdown")
				_, _ = w.Write([]byte("# Home\n\nUseful page content."))
				return
			}
			w.Header().Set("Content-Type", "text/html")
			_, _ = w.Write([]byte("<html><body><h1>Home</h1></body></html>"))
		}
	}))
	defer server.Close()

	analyzer := newAgentReadyAnalyzer(server.Client(), 2*time.Second)
	result := analyzer.analyze(agentReadyScanRequest{
		URL:    server.URL,
		Mode:   "content-site",
		Checks: defaultAgentReadyCheckIDs(),
	})

	if result.Status != "done" {
		t.Fatalf("expected done status, got %q", result.Status)
	}
	if result.Score != 100 {
		t.Fatalf("expected perfect score, got %d: %+v", result.Score, result.Checks)
	}
	for _, check := range result.Checks {
		if check.Status != "pass" {
			t.Fatalf("expected %s to pass, got %s issue=%s", check.ID, check.Status, check.Issue)
		}
	}
}

func TestAgentReadyScanRejectsUnsupportedMode(t *testing.T) {
	if err := validateAgentReadyScanRequest(agentReadyScanRequest{
		URL:    "https://example.com",
		Mode:   "api-application",
		Checks: []string{"robots_txt"},
	}); err == nil {
		t.Fatal("expected unsupported mode error")
	}
}

func TestAgentReadyScanRoutesUseCanonicalPathsOnly(t *testing.T) {
	canonicalCollection := httptest.NewRequest(http.MethodPost, "/analysis/agent-ready/scans", nil)
	if !isAgentReadyScanCollectionRequest(canonicalCollection) {
		t.Fatal("expected canonical scan collection route to match")
	}

	legacyCollection := httptest.NewRequest(http.MethodPost, "/api/scan", nil)
	if isAgentReadyScanCollectionRequest(legacyCollection) {
		t.Fatal("expected legacy scan collection route to be removed")
	}

	canonicalItem := httptest.NewRequest(http.MethodGet, "/analysis/agent-ready/scans/scan-1", nil)
	if !isAgentReadyScanItemRequest(canonicalItem) {
		t.Fatal("expected canonical scan item route to match")
	}
	if got := agentReadyScanIDFromPath(canonicalItem.URL.Path); got != "scan-1" {
		t.Fatalf("unexpected canonical scan id: %q", got)
	}

	legacyItem := httptest.NewRequest(http.MethodGet, "/api/scan/scan-1", nil)
	if isAgentReadyScanItemRequest(legacyItem) {
		t.Fatal("expected legacy scan item route to be removed")
	}
}

func TestAgentReadyScanCollectionListsRecoverableScanIDs(t *testing.T) {
	h := NewHandler(nil)
	scanID := h.scanStore.create(agentReadyScanRequest{URL: "https://example.com", Mode: "content-site"})

	req := httptest.NewRequest(http.MethodGet, "/analysis/agent-ready/scans?url=https://example.com", nil)
	resp := httptest.NewRecorder()

	h.handleAgentReadyScan(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", resp.Code, resp.Body.String())
	}
	var payload struct {
		Items []agentReadyScanResult `json:"items"`
	}
	if err := httpjson.DecodeSuccessData(resp.Body, &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(payload.Items) != 1 || payload.Items[0].ScanID != scanID {
		t.Fatalf("expected listed scan id %s, got %+v", scanID, payload.Items)
	}
}

func TestCreateAgentReadyScanConsumesCreditsWhenOrganizationIsAuthenticated(t *testing.T) {
	ctx := context.Background()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/robots.txt" {
			w.Header().Set("Content-Type", "text/plain")
			_, _ = w.Write([]byte("User-agent: *\nAllow: /\n"))
			return
		}
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte("<html><body>OK</body></html>"))
	}))
	defer server.Close()

	svc, err := usecase.NewServiceWithDependencies(ctx, usecase.Dependencies{
		BillingQuota: staticAgentReadyBillingQuota{monthlyQuota: 100},
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}
	h := NewHandler(svc)
	h.httpClient = server.Client()

	req := httptest.NewRequest(
		http.MethodPost,
		"/analysis/agent-ready/scans",
		bytes.NewBufferString(`{"url":"`+server.URL+`","checks":["robots_txt"]}`),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Organization-ID", "42")
	resp := httptest.NewRecorder()

	h.handleAgentReadyScan(resp, req)

	if resp.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d body=%s", resp.Code, resp.Body.String())
	}
	projectID := agentReadyUsageProjectID(server.URL)
	var usage usecase.PromptQuotaUsage
	for attempt := 0; attempt < 20; attempt++ {
		usage, err = svc.GetPromptQuotaUsage(ctx, projectID, 42)
		if err != nil {
			t.Fatalf("get quota usage: %v", err)
		}
		if usage.UsedCredits == 5 {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("expected 5 credits for successful quick agent ready scan, got %d", usage.UsedCredits)
}

type staticAgentReadyBillingQuota struct {
	monthlyQuota int
}

func (p staticAgentReadyBillingQuota) GetMonthlyQuota(_ context.Context, _ int64) (int, bool, error) {
	return p.monthlyQuota, p.monthlyQuota > 0, nil
}
