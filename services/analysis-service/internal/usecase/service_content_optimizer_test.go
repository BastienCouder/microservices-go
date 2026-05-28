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

type recordingContentIssueAnalyzer struct {
	input  ContentIssueAnalysisInput
	issues []ContentOptimizerIssue
	err    error
}

func (a *recordingContentIssueAnalyzer) AnalyzeContentIssues(_ context.Context, input ContentIssueAnalysisInput) ([]ContentOptimizerIssue, error) {
	a.input = input
	if a.err != nil {
		return nil, a.err
	}
	return append([]ContentOptimizerIssue(nil), a.issues...), nil
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

func TestPreviewOnboardingBrandProfileCrawlsHomeAndAboutPages(t *testing.T) {
	crawler := &recordingContentCrawler{
		job: ContentOptimizerCrawlJob{ID: "onboarding-crawl", Status: "running"},
		result: ContentOptimizerCrawlResult{
			ID:       "onboarding-crawl",
			Status:   "completed",
			Total:    2,
			Finished: 2,
			Records: []ContentOptimizerCrawlRecord{
				{
					URL:      "https://example.com/",
					Status:   "completed",
					Title:    "Acme",
					Markdown: "Acme aide les equipes marketing a suivre leur visibilite dans les reponses IA.\n\n- Monitoring des prompts strategiques\n- Analyse des concurrents\n- Optimisation du contenu cite par les IA",
				},
				{
					URL:      "https://example.com/a-propos",
					Status:   "completed",
					Markdown: "A propos d'Acme\n\nNotre plateforme SaaS consolide les signaux SEO et IA pour les marques.",
				},
			},
		},
	}
	svc, err := NewServiceWithDependencies(context.Background(), Dependencies{ContentCrawler: crawler})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	preview, err := svc.PreviewOnboardingBrandProfile(context.Background(), OnboardingBrandProfileInput{
		WebsiteURL: "example.com",
		BrandName:  "Acme",
	})
	if err != nil {
		t.Fatalf("preview onboarding brand profile: %v", err)
	}

	if crawler.startInput.URL != "https://example.com" {
		t.Fatalf("expected normalized website url, got %q", crawler.startInput.URL)
	}
	if crawler.startInput.Limit != 6 || crawler.startInput.Depth != 1 {
		t.Fatalf("expected onboarding crawl scope 6/1, got %d/%d", crawler.startInput.Limit, crawler.startInput.Depth)
	}
	if !reflect.DeepEqual(crawler.startInput.Formats, []string{"markdown"}) {
		t.Fatalf("expected markdown format, got %#v", crawler.startInput.Formats)
	}
	if !reflect.DeepEqual(crawler.startInput.CrawlPurposes, []string{"search", "ai-input"}) {
		t.Fatalf("expected conservative crawl purposes, got %#v", crawler.startInput.CrawlPurposes)
	}
	if len(crawler.startInput.Options.IncludePatterns) == 0 {
		t.Fatal("expected homepage and about include patterns")
	}
	if preview.BrandName != "Acme" {
		t.Fatalf("expected brand name Acme, got %q", preview.BrandName)
	}
	if preview.BrandShortDescription == "" || preview.BrandDescription == "" {
		t.Fatalf("expected descriptions to be inferred, got %#v", preview)
	}
	if preview.Industry != "SaaS / logiciel" {
		t.Fatalf("expected SaaS industry, got %q", preview.Industry)
	}
	if len(preview.KeyFeatures) == 0 {
		t.Fatalf("expected key features, got %#v", preview.KeyFeatures)
	}
	if len(preview.Prompts) == 0 {
		t.Fatalf("expected prompts, got %#v", preview.Prompts)
	}
}

func TestPreviewOnboardingBrandProfileFallsBackWhenCrawlerIsUnavailable(t *testing.T) {
	svc, err := NewServiceWithDependencies(context.Background(), Dependencies{})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	preview, err := svc.PreviewOnboardingBrandProfile(context.Background(), OnboardingBrandProfileInput{
		WebsiteURL: "example.com",
		BrandName:  "",
	})
	if err != nil {
		t.Fatalf("preview onboarding brand profile: %v", err)
	}

	if preview.BrandName != "Example" {
		t.Fatalf("expected inferred brand name from url, got %q", preview.BrandName)
	}
	if preview.Status != "fallback" {
		t.Fatalf("expected fallback status, got %q", preview.Status)
	}
	if len(preview.Prompts) == 0 {
		t.Fatal("expected fallback prompts")
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

func TestGetContentOptimizerCrawlCanSkipAnalysisForDiscovery(t *testing.T) {
	ctx := context.Background()
	crawler := &recordingContentCrawler{
		result: ContentOptimizerCrawlResult{
			ID:       "crawl-123",
			Status:   "completed",
			Total:    1,
			Finished: 1,
			Records: []ContentOptimizerCrawlRecord{{
				URL:        "https://example.com/docs",
				Status:     "completed",
				HTTPStatus: 200,
				Title:      "Docs",
				Markdown:   "# Docs\nShort page.",
			}},
		},
	}
	analyzer := &recordingContentIssueAnalyzer{
		issues: []ContentOptimizerIssue{{
			ID:      "ai-issue",
			FixType: "ai_issue",
		}},
	}
	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		ContentCrawler:       crawler,
		ContentIssueAnalyzer: analyzer,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	result, err := svc.GetContentOptimizerCrawl(ctx, "project-1", 42, "crawl-123", ContentOptimizerCrawlResultInput{
		Limit:        1000,
		SkipAnalysis: true,
	})
	if err != nil {
		t.Fatalf("get content optimizer crawl: %v", err)
	}

	if len(result.Records) != 1 {
		t.Fatalf("expected discovered record, got %#v", result.Records)
	}
	if len(result.Records[0].Issues) != 0 {
		t.Fatalf("expected discovery to skip issues, got %#v", result.Records[0].Issues)
	}
	if analyzer.input.ProjectID != "" {
		t.Fatalf("expected AI analyzer to be skipped, got %#v", analyzer.input)
	}
	_, err = svc.GetLatestContentOptimizerCrawl(ctx, "project-1", 42)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected discovery result not to be saved as latest analysis, got %v", err)
	}
}

func TestAnalyzeSelectedContentOptimizerRecordsUsesExistingRecordsWithoutCrawler(t *testing.T) {
	ctx := context.Background()
	crawler := &recordingContentCrawler{}
	verifier := &recordingProjectAccessVerifier{}
	analyzer := &recordingContentIssueAnalyzer{
		issues: []ContentOptimizerIssue{{
			ID:             "ai-issue",
			Category:       "geo",
			Severity:       "high",
			Title:          "Intentions manquantes",
			Description:    "Le contenu ne couvre pas assez les intentions.",
			Recommendation: "Ajouter des réponses directes.",
			FixType:        "ai_add_intent_coverage",
		}},
	}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		ProjectVerifier:      verifier,
		ContentCrawler:       crawler,
		ContentIssueAnalyzer: analyzer,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	result, err := svc.AnalyzeSelectedContentOptimizerRecords(ctx, "project-1", 42, []ContentOptimizerCrawlRecord{
		{
			URL:        " https://example.com/pricing ",
			Status:     "completed",
			HTTPStatus: 200,
			Title:      "Pricing",
			Markdown:   "# Pricing\n\nPlans for teams.",
		},
		{
			URL:        "https://example.com/docs",
			Status:     "completed",
			HTTPStatus: 200,
			Title:      "Docs",
			Markdown:   "# Docs\n\nHow to use the product.",
		},
	})
	if err != nil {
		t.Fatalf("analyze selected records: %v", err)
	}

	if verifier.projectID != "project-1" || verifier.organizationID != 42 {
		t.Fatalf("expected project access check for project-1/42, got %q/%d", verifier.projectID, verifier.organizationID)
	}
	if crawler.startInput.URL != "" || crawler.resultJobID != "" {
		t.Fatalf("expected no crawler call, got start=%#v resultJobID=%q", crawler.startInput, crawler.resultJobID)
	}
	if result.Status != "completed" || result.Total != 2 || result.Finished != 2 {
		t.Fatalf("unexpected result summary: %#v", result)
	}
	if len(result.Records) != 2 {
		t.Fatalf("expected two analyzed records, got %d", len(result.Records))
	}
	if result.Records[0].URL != "https://example.com/pricing" {
		t.Fatalf("expected trimmed URL, got %q", result.Records[0].URL)
	}
	if !hasContentOptimizerIssueFixType(result.Records[0].Issues, "ai_add_intent_coverage") {
		t.Fatalf("expected AI issue on first selected record, got %#v", result.Records[0].Issues)
	}

	latest, err := svc.GetLatestContentOptimizerCrawl(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get latest analyzed selection: %v", err)
	}
	if latest.JobID != result.ID {
		t.Fatalf("expected latest selected analysis id %q, got %q", result.ID, latest.JobID)
	}
}

func TestGetContentOptimizerCrawlReplacesLatestWithFreshSelectedResult(t *testing.T) {
	ctx := context.Background()
	crawler := &recordingContentCrawler{
		job: ContentOptimizerCrawlJob{ID: "crawl-selected", Status: "running"},
	}
	svc, err := NewServiceWithDependencies(ctx, Dependencies{ContentCrawler: crawler})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	if err := svc.saveLatestContentOptimizerCrawl(ctx, "project-1", 42, "crawl-initial", ContentOptimizerCrawlResult{
		ID:       "crawl-initial",
		Status:   "completed",
		Total:    2,
		Finished: 2,
		Records: []ContentOptimizerCrawlRecord{
			{
				URL:    "https://example.com/pricing",
				Status: "completed",
				Title:  "Pricing old",
				Issues: []ContentOptimizerIssue{{
					ID:          "pricing-old-issue",
					Severity:    "medium",
					Title:       "Old pricing issue",
					Description: "The old pricing page issue should be replaced.",
					FixType:     "add_schema_markup",
				}},
			},
			{
				URL:    "https://example.com/docs",
				Status: "completed",
				Title:  "Docs",
				Issues: []ContentOptimizerIssue{{
					ID:          "docs-issue",
					Severity:    "high",
					Title:       "Docs issue",
					Description: "The docs page was not selected in the next crawl.",
					FixType:     "expand_content",
				}},
			},
		},
	}); err != nil {
		t.Fatalf("seed latest crawl: %v", err)
	}

	job, err := svc.StartContentOptimizerCrawl(ctx, "project-1", 42, ContentOptimizerCrawlStartInput{
		URL:   "https://example.com",
		Limit: 1,
		Options: ContentOptimizerCrawlOptions{
			IncludePatterns: []string{"https://example.com/pricing"},
		},
	})
	if err != nil {
		t.Fatalf("start selected crawl: %v", err)
	}

	crawler.result = ContentOptimizerCrawlResult{
		ID:       job.ID,
		Status:   "completed",
		Total:    1,
		Finished: 1,
		Records: []ContentOptimizerCrawlRecord{{
			URL:    "https://example.com/pricing",
			Status: "completed",
			Title:  "Pricing new",
			Issues: []ContentOptimizerIssue{{
				ID:          "pricing-new-issue",
				Severity:    "low",
				Title:       "New pricing issue",
				Description: "The selected pricing page issue should be refreshed.",
				FixType:     "add_faq",
			}},
		}},
	}
	if _, err := svc.GetContentOptimizerCrawl(ctx, "project-1", 42, job.ID, ContentOptimizerCrawlResultInput{Limit: 1000}); err != nil {
		t.Fatalf("get selected crawl: %v", err)
	}

	latest, err := svc.GetLatestContentOptimizerCrawl(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get latest crawl: %v", err)
	}
	if len(latest.Result.Records) != 1 {
		t.Fatalf("expected latest crawl to contain only fresh selected result, got %#v", latest.Result.Records)
	}
	if latest.Result.Records[0].URL != "https://example.com/pricing" {
		t.Fatalf("expected selected page only, got %#v", latest.Result.Records)
	}
	if latest.Result.Records[0].Title != "Pricing new" {
		t.Fatalf("expected selected page to be refreshed, got %#v", latest.Result.Records[0])
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

func TestGetContentOptimizerCrawlReportsDetailedSEOAndGEOIssues(t *testing.T) {
	ctx := context.Background()
	crawler := &recordingContentCrawler{
		result: ContentOptimizerCrawlResult{
			ID:       "crawl-123",
			Status:   "completed",
			Total:    1,
			Finished: 1,
			Records: []ContentOptimizerCrawlRecord{{
				URL:        "https://example.com/pricing",
				Status:     "completed",
				HTTPStatus: 200,
				Title:      "Pricing",
				Markdown: strings.Join([]string{
					"# Pricing",
					"Buy now. Best platform. Contact us.",
					"Features. Powerful. Fast. Simple.",
				}, "\n"),
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

	issues := result.Records[0].Issues
	expectedFixTypes := []string{
		"add_meta_description",
		"improve_h1",
		"add_internal_links",
		"add_schema_markup",
		"add_faq",
		"add_direct_answer",
		"add_evidence",
		"add_entity_context",
		"clarify_offer",
		"add_audience_use_cases",
		"add_comparison_context",
		"add_freshness_signal",
		"create_blog",
	}
	for _, fixType := range expectedFixTypes {
		if !hasContentOptimizerIssueFixType(issues, fixType) {
			t.Fatalf("expected issue %q, got %#v", fixType, issues)
		}
	}
}

func TestGetContentOptimizerCrawlEnrichesIssuesWithAIAnalyzer(t *testing.T) {
	ctx := context.Background()
	crawler := &recordingContentCrawler{
		result: ContentOptimizerCrawlResult{
			ID:       "crawl-123",
			Status:   "completed",
			Total:    1,
			Finished: 1,
			Records: []ContentOptimizerCrawlRecord{{
				URL:        "https://example.com/pricing",
				Status:     "completed",
				HTTPStatus: 200,
				Title:      "Pricing",
				Markdown:   "# Pricing\nPricing details for teams.",
			}},
		},
	}
	analyzer := &recordingContentIssueAnalyzer{
		issues: []ContentOptimizerIssue{{
			ID:             "ai-pricing-intent-gap",
			Category:       "geo",
			Severity:       "high",
			Title:          "Intent utilisateur incomplet",
			Description:    "La page ne traite pas les objections d'achat principales.",
			Recommendation: "Ajouter une section comparaison prix, objections et criteres de decision.",
			FixType:        "ai_add_intent_coverage",
		}},
	}
	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		ContentCrawler:       crawler,
		ContentIssueAnalyzer: analyzer,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	result, err := svc.GetContentOptimizerCrawl(ctx, "project-1", 42, "crawl-123", ContentOptimizerCrawlResultInput{})
	if err != nil {
		t.Fatalf("get content optimizer crawl: %v", err)
	}

	if analyzer.input.ProjectID != "project-1" || analyzer.input.OrganizationID != 42 {
		t.Fatalf("expected project scope to be passed to analyzer, got %#v", analyzer.input)
	}
	if analyzer.input.Record.URL != "https://example.com/pricing" {
		t.Fatalf("expected crawled record to be passed to analyzer, got %#v", analyzer.input.Record)
	}
	if len(analyzer.input.DeterministicIssues) == 0 {
		t.Fatalf("expected deterministic issues to be passed to analyzer")
	}
	if !hasContentOptimizerIssueFixType(result.Records[0].Issues, "ai_add_intent_coverage") {
		t.Fatalf("expected AI issue to be merged, got %#v", result.Records[0].Issues)
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
