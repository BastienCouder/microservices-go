package usecase

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"
)

type recordingContentCrawler struct {
	startInput ContentOptimizerCrawlStartInput
	job        ContentOptimizerCrawlJob

	resultJobID string
	resultInput ContentOptimizerCrawlResultInput
	result      ContentOptimizerCrawlResult
}

func (c *recordingContentCrawler) StartCrawl(_ context.Context, input ContentOptimizerCrawlStartInput) (ContentOptimizerCrawlJob, error) {
	c.startInput = input
	return c.job, nil
}

func (c *recordingContentCrawler) GetCrawl(_ context.Context, jobID string, input ContentOptimizerCrawlResultInput) (ContentOptimizerCrawlResult, error) {
	c.resultJobID = jobID
	c.resultInput = input
	return c.result, nil
}

type recordingProjectAccessVerifier struct {
	projectID      string
	organizationID int64
	err            error
}

func (v *recordingProjectAccessVerifier) EnsureProjectAccessible(_ context.Context, projectID string, organizationID int64) error {
	v.projectID = projectID
	v.organizationID = organizationID
	return v.err
}

func TestStartContentOptimizerCrawlValidatesAccessAndNormalizesRequest(t *testing.T) {
	ctx := context.Background()
	crawler := &recordingContentCrawler{
		job: ContentOptimizerCrawlJob{ID: "crawl-123", Status: "running"},
	}
	verifier := &recordingProjectAccessVerifier{}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		ProjectVerifier: verifier,
		ContentCrawler:  crawler,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	job, err := svc.StartContentOptimizerCrawl(ctx, "project-1", 42, ContentOptimizerCrawlStartInput{
		URL:    " https://example.com/docs ",
		Limit:  5,
		Depth:  2,
		Render: false,
	})
	if err != nil {
		t.Fatalf("start content optimizer crawl: %v", err)
	}

	if job.ID != "crawl-123" {
		t.Fatalf("expected crawl job id, got %q", job.ID)
	}
	if verifier.projectID != "project-1" || verifier.organizationID != 42 {
		t.Fatalf("expected project access check for project-1/42, got %q/%d", verifier.projectID, verifier.organizationID)
	}
	if crawler.startInput.URL != "https://example.com/docs" {
		t.Fatalf("expected trimmed crawl url, got %q", crawler.startInput.URL)
	}
	if crawler.startInput.Limit != 5 || crawler.startInput.Depth != 2 {
		t.Fatalf("expected limit/depth 5/2, got %d/%d", crawler.startInput.Limit, crawler.startInput.Depth)
	}
	if crawler.startInput.Render {
		t.Fatal("expected render false to be preserved")
	}
	if !reflect.DeepEqual(crawler.startInput.Formats, []string{"markdown"}) {
		t.Fatalf("expected markdown format default, got %#v", crawler.startInput.Formats)
	}
	if !reflect.DeepEqual(crawler.startInput.CrawlPurposes, []string{"search", "ai-input"}) {
		t.Fatalf("expected conservative crawl purposes, got %#v", crawler.startInput.CrawlPurposes)
	}
}

func TestStartContentOptimizerCrawlRejectsUnsupportedURLSchemes(t *testing.T) {
	svc := NewService()

	_, err := svc.StartContentOptimizerCrawl(context.Background(), "project-1", 42, ContentOptimizerCrawlStartInput{
		URL: "file:///etc/passwd",
	})
	if err == nil {
		t.Fatal("expected validation error, got nil")
	}
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected ErrValidation, got %v", err)
	}
}

func TestGetContentOptimizerCrawlForwardsResultOptions(t *testing.T) {
	ctx := context.Background()
	crawler := &recordingContentCrawler{
		result: ContentOptimizerCrawlResult{
			ID:       "crawl-123",
			Status:   "completed",
			Total:    1,
			Finished: 1,
			Records: []ContentOptimizerCrawlRecord{{
				URL:      "https://example.com/docs",
				Status:   "completed",
				Markdown: "# Docs",
				Title:    "Docs",
			}},
		},
	}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{ContentCrawler: crawler})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	result, err := svc.GetContentOptimizerCrawl(ctx, "project-1", 42, "crawl-123", ContentOptimizerCrawlResultInput{
		Limit:  10,
		Status: "completed",
	})
	if err != nil {
		t.Fatalf("get content optimizer crawl: %v", err)
	}

	if result.Status != "completed" || len(result.Records) != 1 {
		t.Fatalf("unexpected crawl result: %#v", result)
	}
	if crawler.resultJobID != "crawl-123" {
		t.Fatalf("expected job id crawl-123, got %q", crawler.resultJobID)
	}
	if crawler.resultInput.Limit != 10 || crawler.resultInput.Status != "completed" {
		t.Fatalf("expected result options to be forwarded, got %#v", crawler.resultInput)
	}
}

func TestGetContentOptimizerCrawlStoresCompletedResultAsLatest(t *testing.T) {
	ctx := context.Background()
	crawler := &recordingContentCrawler{
		result: ContentOptimizerCrawlResult{
			ID:       "crawl-123",
			Status:   "completed",
			Total:    1,
			Finished: 1,
			Records: []ContentOptimizerCrawlRecord{{
				URL:      "https://example.com/docs",
				Status:   "completed",
				Title:    "Docs",
				Markdown: "# Docs",
			}},
		},
	}
	svc, err := NewServiceWithDependencies(ctx, Dependencies{ContentCrawler: crawler})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}
	svc.now = func() time.Time { return time.Date(2026, 5, 13, 10, 0, 0, 0, time.UTC) }

	_, err = svc.GetContentOptimizerCrawl(ctx, "project-1", 42, "crawl-123", ContentOptimizerCrawlResultInput{})
	if err != nil {
		t.Fatalf("get content optimizer crawl: %v", err)
	}

	latest, err := svc.GetLatestContentOptimizerCrawl(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get latest content optimizer crawl: %v", err)
	}

	if latest.ProjectID != "project-1" || latest.OrganizationID != 42 {
		t.Fatalf("unexpected latest scope: %#v", latest)
	}
	if latest.JobID != "crawl-123" || latest.Result.Status != "completed" {
		t.Fatalf("unexpected latest crawl: %#v", latest)
	}
	if len(latest.Result.Records) != 1 || latest.Result.Records[0].Markdown != "# Docs" {
		t.Fatalf("expected saved record markdown, got %#v", latest.Result.Records)
	}
}

func TestGetContentOptimizerCrawlAnalyzesSEOAndGEOIssues(t *testing.T) {
	ctx := context.Background()
	crawler := &recordingContentCrawler{
		result: ContentOptimizerCrawlResult{
			ID:       "crawl-123",
			Status:   "completed",
			Total:    1,
			Finished: 1,
			Records: []ContentOptimizerCrawlRecord{{
				URL:        "https://example.com/running",
				Status:     "completed",
				HTTPStatus: 200,
				Title:      "Running",
				Markdown:   "# Running\nShort page about shoes.",
			}},
		},
	}
	svc, err := NewServiceWithDependencies(ctx, Dependencies{ContentCrawler: crawler})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	result, err := svc.GetContentOptimizerCrawl(ctx, "project-1", 42, "crawl-123", ContentOptimizerCrawlResultInput{})
	if err != nil {
		t.Fatalf("get content optimizer crawl: %v", err)
	}

	if len(result.Records) != 1 {
		t.Fatalf("expected one record, got %d", len(result.Records))
	}
	issues := result.Records[0].Issues
	if len(issues) == 0 {
		t.Fatal("expected SEO/GEO issues")
	}
	if !hasContentOptimizerIssueFixType(issues, "add_faq") {
		t.Fatalf("expected FAQ issue, got %#v", issues)
	}
	if !hasContentOptimizerIssueFixType(issues, "create_blog") {
		t.Fatalf("expected blog issue, got %#v", issues)
	}
	thinContent := findContentOptimizerIssue(issues, "expand_content")
	if thinContent == nil {
		t.Fatalf("expected thin content issue, got %#v", issues)
	}
	if thinContent.Recommendation == "Ajouter un bloc de contenu utile avec benefices, cas d'usage, preuves et liens internes." {
		t.Fatalf("expected concrete recommendation, got generic recommendation")
	}
	if !strings.Contains(strings.ToLower(thinContent.Recommendation), "running") {
		t.Fatalf("expected recommendation to mention page topic, got %q", thinContent.Recommendation)
	}
}

func TestGetContentOptimizerCrawlDoesNotStorePartialPollingResult(t *testing.T) {
	ctx := context.Background()
	crawler := &recordingContentCrawler{
		result: ContentOptimizerCrawlResult{
			ID:       "crawl-123",
			Status:   "completed",
			Total:    3,
			Finished: 3,
			Records: []ContentOptimizerCrawlRecord{{
				URL:    "https://example.com",
				Status: "completed",
			}},
		},
	}
	svc, err := NewServiceWithDependencies(ctx, Dependencies{ContentCrawler: crawler})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	_, err = svc.GetContentOptimizerCrawl(ctx, "project-1", 42, "crawl-123", ContentOptimizerCrawlResultInput{Limit: 1})
	if err != nil {
		t.Fatalf("get content optimizer crawl: %v", err)
	}

	_, err = svc.GetLatestContentOptimizerCrawl(ctx, "project-1", 42)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected latest crawl to stay empty for partial polling result, got %v", err)
	}
}

func hasContentOptimizerIssueFixType(issues []ContentOptimizerIssue, fixType string) bool {
	return findContentOptimizerIssue(issues, fixType) != nil
}

func findContentOptimizerIssue(issues []ContentOptimizerIssue, fixType string) *ContentOptimizerIssue {
	for index := range issues {
		if issues[index].FixType == fixType {
			return &issues[index]
		}
	}
	return nil
}
