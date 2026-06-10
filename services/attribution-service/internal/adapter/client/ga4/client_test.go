package ga4

import (
	"strings"
	"testing"
	"time"

	"github.com/bastiencouder/microservices-go/services/attribution-service/internal/usecase"
)

func TestClassifyTrafficEngineRecognizesGenerativeSources(t *testing.T) {
	tests := []struct {
		source string
		want   string
	}{
		{source: "chat.openai.com", want: "ChatGPT"},
		{source: "https://gemini.google.com/app", want: "Gemini"},
		{source: "chat.deepseek.com", want: "DeepSeek"},
		{source: "copilot.microsoft.com", want: "Microsoft Copilot"},
		{source: "anthropic.com", want: "Claude"},
		{source: "https://chat.qwen.ai/c/abc", want: "Qwen"},
		{source: "z.ai", want: "Z.ai"},
		{source: "poe.com", want: "Poe"},
		{source: "kimi.moonshot.cn", want: "Kimi"},
		{source: "meta.ai", want: "Meta AI"},
	}

	for _, tt := range tests {
		got, ok := classifyTrafficEngine(tt.source)
		if !ok {
			t.Fatalf("expected %q to be classified as traffic", tt.source)
		}
		if got != tt.want {
			t.Fatalf("expected %q for %q, got %q", tt.want, tt.source, got)
		}
	}
}

func TestClientKeepsFakeTrafficFallbackDisabledByDefault(t *testing.T) {
	client := NewClient()
	if client.fakeTrafficEnabled {
		t.Fatalf("expected fake traffic fallback to be disabled by default")
	}

	client.SetFakeTrafficEnabled(true)

	if !client.fakeTrafficEnabled {
		t.Fatalf("expected fake traffic fallback to be enabled when explicitly requested")
	}
}

func TestBuildTrafficDimensionFilterIncludesTrafficAndPublicPageFilters(t *testing.T) {
	filter := buildTrafficDimensionFilter(usecase.TrafficFilters{})
	root, ok := filter["andGroup"].(map[string]any)
	if !ok {
		t.Fatalf("expected root andGroup, got %#v", filter)
	}
	expressions, ok := root["expressions"].([]map[string]any)
	if !ok {
		t.Fatalf("expected expressions, got %#v", root["expressions"])
	}
	if len(expressions) != 2 {
		t.Fatalf("expected traffic and public page filters, got %#v", expressions)
	}

	rawTraffic := expressions[0]["orGroup"].(map[string]any)["expressions"].([]map[string]any)
	var hasSessionSource bool
	var hasPageReferrer bool
	for _, expression := range rawTraffic {
		filterNode := expression["filter"].(map[string]any)
		switch filterNode["fieldName"] {
		case "sessionSource":
			hasSessionSource = true
		case "pageReferrer":
			hasPageReferrer = true
		}
	}
	if !hasSessionSource {
		t.Fatalf("expected sessionSource filter, got %#v", rawTraffic)
	}
	if hasPageReferrer {
		t.Fatalf("expected traffic filter to align with GA4 channel group and ignore pageReferrer, got %#v", rawTraffic)
	}

	notExpression, ok := expressions[1]["notExpression"].(map[string]any)
	if !ok {
		t.Fatalf("expected private pages to be excluded with a notExpression, got %#v", expressions[1])
	}
	filterNode := notExpression["filter"].(map[string]any)
	if filterNode["fieldName"] != "pagePath" {
		t.Fatalf("expected pagePath private-page filter, got %#v", filterNode)
	}
	stringFilter := filterNode["stringFilter"].(map[string]any)
	if stringFilter["matchType"] != "BEGINS_WITH" || stringFilter["value"] != "/admin" {
		t.Fatalf("expected /admin prefix exclusion, got %#v", stringFilter)
	}
}

func TestBuildTrafficDimensionFilterUsesAITrafficRegexOnSessionSourceMedium(t *testing.T) {
	filter := buildTrafficDimensionFilter(usecase.TrafficFilters{})
	root, ok := filter["andGroup"].(map[string]any)
	if !ok {
		t.Fatalf("expected root andGroup, got %#v", filter)
	}
	expressions, ok := root["expressions"].([]map[string]any)
	if !ok {
		t.Fatalf("expected expressions, got %#v", root["expressions"])
	}

	trafficExpressions := expressions[0]["orGroup"].(map[string]any)["expressions"].([]map[string]any)
	var sessionSourceMediumFilter map[string]any
	for _, expression := range trafficExpressions {
		filterNode := expression["filter"].(map[string]any)
		if filterNode["fieldName"] == "sessionSourceMedium" {
			sessionSourceMediumFilter = filterNode["stringFilter"].(map[string]any)
			break
		}
	}
	if sessionSourceMediumFilter == nil {
		t.Fatalf("expected AI traffic regex on sessionSourceMedium, got %#v", trafficExpressions)
	}
	if sessionSourceMediumFilter["matchType"] != "FULL_REGEXP" || sessionSourceMediumFilter["caseSensitive"] != false {
		t.Fatalf("expected case-insensitive full regexp filter, got %#v", sessionSourceMediumFilter)
	}
	regex := sessionSourceMediumFilter["value"].(string)
	for _, expected := range []string{
		"(?i)",
		"perplexity",
		"claude\\.ai",
		"gemini\\.google\\.com",
		"copy\\.ai",
		"chat-gpt\\.org",
		"qwen",
		"z\\.ai",
		"poe",
	} {
		if !strings.Contains(regex, expected) {
			t.Fatalf("expected AI traffic regex to include %q, got %q", expected, regex)
		}
	}
}

func TestTrafficRequestsUseKeyEventsMetric(t *testing.T) {
	from := time.Date(2026, 3, 29, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 4, 28, 0, 0, 0, 0, time.UTC)

	requests := []map[string]any{
		buildTrafficSourceRequest(from, to, usecase.TrafficFilters{}),
		buildTrafficTopPagesRequest(from, to, usecase.TrafficFilters{}),
		buildTrafficTimeseriesRequest(from, to, usecase.TrafficFilters{}),
	}

	for _, request := range requests {
		metrics, ok := request["metrics"].([]map[string]string)
		if !ok {
			t.Fatalf("expected metrics in request, got %#v", request["metrics"])
		}
		var hasKeyEvents bool
		for _, metric := range metrics {
			if metric["name"] == "conversions" {
				t.Fatalf("expected GA4 keyEvents metric instead of deprecated conversions: %#v", metrics)
			}
			if metric["name"] == "keyEvents" {
				hasKeyEvents = true
			}
		}
		if !hasKeyEvents {
			t.Fatalf("expected keyEvents metric, got %#v", metrics)
		}
	}
}

func TestBuildTrafficDimensionFilterAddsBackendSearchAndEngineFilters(t *testing.T) {
	filter := buildTrafficDimensionFilter(usecase.TrafficFilters{
		Search: "pricing",
		Engine: "ChatGPT",
	})
	root, ok := filter["andGroup"].(map[string]any)
	if !ok {
		t.Fatalf("expected root andGroup, got %#v", filter)
	}
	expressions, ok := root["expressions"].([]map[string]any)
	if !ok {
		t.Fatalf("expected expressions, got %#v", root["expressions"])
	}
	if len(expressions) != 3 {
		t.Fatalf("expected traffic, public page, and search filters, got %#v", expressions)
	}

	trafficExpressions := expressions[0]["orGroup"].(map[string]any)["expressions"].([]map[string]any)
	for _, expression := range trafficExpressions {
		filterNode := expression["filter"].(map[string]any)
		stringFilter := filterNode["stringFilter"].(map[string]any)
		if !strings.Contains(strings.ToLower(stringFilter["value"].(string)), "chatgpt") &&
			!strings.Contains(strings.ToLower(stringFilter["value"].(string)), "openai") {
			t.Fatalf("expected ChatGPT-only traffic filter, got %#v", trafficExpressions)
		}
	}

	searchExpressions := expressions[2]["orGroup"].(map[string]any)["expressions"].([]map[string]any)
	var hasPagePath bool
	for _, expression := range searchExpressions {
		filterNode := expression["filter"].(map[string]any)
		if filterNode["fieldName"] == "pagePath" {
			hasPagePath = true
		}
		stringFilter := filterNode["stringFilter"].(map[string]any)
		if stringFilter["value"] != "pricing" {
			t.Fatalf("expected search value to be propagated, got %#v", stringFilter)
		}
	}
	if !hasPagePath {
		t.Fatalf("expected search filter to include pagePath, got %#v", searchExpressions)
	}
}

func TestParseTrafficSourceRowsIgnoresPageReferrerOnlyTraffic(t *testing.T) {
	rows := []ga4RunReportRow{
		{
			DimensionValues: []ga4Value{
				{Value: "(direct)"},
				{Value: "(none)"},
				{Value: "(direct) / (none)"},
				{Value: "https://chatgpt.com/share/abc"},
			},
			MetricValues: []ga4Value{
				{Value: "1"},
				{Value: "0"},
				{Value: "0"},
				{Value: "1"},
				{Value: "0"},
				{Value: "0"},
				{Value: "2"},
			},
		},
	}

	sources := parseTrafficSourceRows(rows)

	if len(sources) != 0 {
		t.Fatalf("expected pageReferrer-only ChatGPT row to be ignored for GA4 channel alignment, got %+v", sources)
	}
}

func TestParseTrafficSourceRowsAggregatesSameChatGPTSource(t *testing.T) {
	rows := []ga4RunReportRow{
		{
			DimensionValues: []ga4Value{
				{Value: "chatgpt.com"},
				{Value: "referral"},
				{Value: "chatgpt.com / referral"},
				{Value: ""},
			},
			MetricValues: []ga4Value{
				{Value: "1"},
				{Value: "0"},
				{Value: "0"},
				{Value: "1"},
				{Value: "0"},
				{Value: "0"},
				{Value: "2"},
			},
		},
		{
			DimensionValues: []ga4Value{
				{Value: "(direct)"},
				{Value: "(none)"},
				{Value: "(direct) / (none)"},
				{Value: "https://chatgpt.com/share/abc"},
			},
			MetricValues: []ga4Value{
				{Value: "1"},
				{Value: "1"},
				{Value: "1"},
				{Value: "0"},
				{Value: "160"},
				{Value: "0"},
				{Value: "3"},
			},
		},
	}

	sources := parseTrafficSourceRows(rows)

	if len(sources) != 1 {
		t.Fatalf("expected duplicate ChatGPT rows to be aggregated, got %+v", sources)
	}
	got := sources[0]
	if got.Source != "chatgpt.com" || got.Engine != "ChatGPT" {
		t.Fatalf("expected normalized ChatGPT source, got %+v", got)
	}
	if got.Sessions != 1 || got.EngagedSessions != 0 || got.PageViews != 2 {
		t.Fatalf("expected only session-source AI metrics, got %+v", got)
	}
	if got.EngagementRate != 0 || got.BounceRate != 100 || got.AvgSessionSeconds != 0 {
		t.Fatalf("expected rates from session-source AI row only, got %+v", got)
	}
	if got.ShareOfTrafficSessions != 100 {
		t.Fatalf("expected source share to be recomputed, got %+v", got)
	}
}

func TestParseTrafficTopPageRowsAggregatesSamePageAndSource(t *testing.T) {
	rows := []ga4RunReportRow{
		{
			DimensionValues: []ga4Value{
				{Value: "/"},
				{Value: "Home"},
				{Value: "chatgpt.com"},
				{Value: ""},
			},
			MetricValues: []ga4Value{
				{Value: "1"},
				{Value: "0"},
				{Value: "0"},
				{Value: "2"},
			},
		},
		{
			DimensionValues: []ga4Value{
				{Value: "/"},
				{Value: "Home"},
				{Value: "(direct)"},
				{Value: "https://chatgpt.com/share/abc"},
			},
			MetricValues: []ga4Value{
				{Value: "1"},
				{Value: "1"},
				{Value: "0"},
				{Value: "3"},
			},
		},
	}

	pages := parseTrafficTopPageRows(rows)

	if len(pages) != 1 {
		t.Fatalf("expected duplicate page/source rows to be aggregated, got %+v", pages)
	}
	got := pages[0]
	if got.Path != "/" || got.Source != "chatgpt.com" || got.Engine != "ChatGPT" {
		t.Fatalf("expected normalized page source, got %+v", got)
	}
	if got.Sessions != 1 || got.EngagedSessions != 0 || got.PageViews != 2 || got.EngagementRate != 0 {
		t.Fatalf("expected page metrics from session-source AI row only, got %+v", got)
	}
}

func TestBuildGA4TrafficLogPreviewIncludesRawRowsAndFilters(t *testing.T) {
	from := time.Date(2026, 4, 28, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 4, 28, 23, 59, 59, 0, time.UTC)
	sourceResponse := ga4RunReportResponse{
		Rows: []ga4RunReportRow{
			{
				DimensionValues: []ga4Value{
					{Value: "chatgpt.com"},
					{Value: "referral"},
					{Value: "chatgpt.com / referral"},
				},
				MetricValues: []ga4Value{
					{Value: "1"},
					{Value: "0"},
					{Value: "0"},
					{Value: "1"},
					{Value: "0"},
					{Value: "0"},
					{Value: "2"},
				},
			},
		},
	}
	topPagesResponse := ga4RunReportResponse{
		Rows: []ga4RunReportRow{
			{
				DimensionValues: []ga4Value{
					{Value: "/pricing"},
					{Value: "Pricing"},
					{Value: "chatgpt.com"},
				},
				MetricValues: []ga4Value{
					{Value: "1"},
					{Value: "0"},
					{Value: "0"},
					{Value: "2"},
				},
			},
		},
	}
	timeseriesResponse := ga4RunReportResponse{
		Rows: []ga4RunReportRow{
			{
				DimensionValues: []ga4Value{
					{Value: "20260428"},
					{Value: "chatgpt.com"},
				},
				MetricValues: []ga4Value{
					{Value: "1"},
					{Value: "0"},
					{Value: "0"},
				},
			},
		},
	}

	preview := buildGA4TrafficLogPreview(
		usecase.ProjectMetadata{ID: "project-1"},
		from,
		to,
		usecase.TrafficFilters{Search: "chatgpt", Engine: "ChatGPT"},
		ga4RunReportResponse{Rows: []ga4RunReportRow{{MetricValues: []ga4Value{{Value: "8"}}}}},
		sourceResponse,
		topPagesResponse,
		timeseriesResponse,
		usecase.TrafficReport{PropertyID: "123456"},
	)

	if preview.DateRange.StartDate != "2026-04-28" || preview.DateRange.EndDate != "2026-04-28" {
		t.Fatalf("expected date range in log preview, got %+v", preview.DateRange)
	}
	if preview.Filters.Search != "chatgpt" || preview.Filters.Engine != "ChatGPT" {
		t.Fatalf("expected filters in log preview, got %+v", preview.Filters)
	}
	if len(preview.RawSourceRowsPreview) != 1 {
		t.Fatalf("expected raw source row preview, got %+v", preview.RawSourceRowsPreview)
	}
	row := preview.RawSourceRowsPreview[0]
	if row.Dimensions[0] != "chatgpt.com" || row.Dimensions[2] != "chatgpt.com / referral" {
		t.Fatalf("expected raw GA4 dimensions to be logged, got %+v", row.Dimensions)
	}
	if row.Metrics[0] != "1" || row.Metrics[6] != "2" {
		t.Fatalf("expected raw GA4 metrics to be logged, got %+v", row.Metrics)
	}
	if preview.RawTotalRowsPreview[0].Metrics[0] != "8" {
		t.Fatalf("expected raw total rows to be logged, got %+v", preview.RawTotalRowsPreview)
	}
	if preview.RawTopPageRowsPreview[0].Dimensions[0] != "/pricing" {
		t.Fatalf("expected raw top page rows to be logged, got %+v", preview.RawTopPageRowsPreview)
	}
	if preview.RawTimeseriesRowsPreview[0].Dimensions[0] != "20260428" {
		t.Fatalf("expected raw timeseries rows to be logged, got %+v", preview.RawTimeseriesRowsPreview)
	}
}

func TestBuildFakeTrafficReportFillsDashboardRows(t *testing.T) {
	from := time.Date(2026, 3, 29, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 4, 28, 0, 0, 0, 0, time.UTC)
	base := usecase.TrafficReport{
		ProjectID:  "nike",
		PropertyID: "379124317",
		DateRange: usecase.TrafficDateRange{
			StartDate: from.Format("2006-01-02"),
			EndDate:   to.Format("2006-01-02"),
		},
		Summary: usecase.TrafficSummary{TotalSessions: 1200},
	}

	report := buildFakeTrafficReport(base, from, to)

	if report.ProjectID != "nike" || report.PropertyID != "379124317" {
		t.Fatalf("expected project and property to be preserved, got %+v", report)
	}
	if report.DataSource != "fake" {
		t.Fatalf("expected fake data source, got %q", report.DataSource)
	}
	if report.Summary.TotalTrafficSessions <= 0 || report.Summary.TotalSessions < report.Summary.TotalTrafficSessions {
		t.Fatalf("expected coherent fake summary, got %+v", report.Summary)
	}
	if len(report.BySource) < 8 {
		t.Fatalf("expected multiple fake sources, got %+v", report.BySource)
	}
	if len(report.TopPages) == 0 {
		t.Fatalf("expected fake top pages")
	}
	if len(report.Timeseries) == 0 {
		t.Fatalf("expected fake timeseries")
	}
	if report.BySource[0].ShareOfTrafficSessions <= 0 {
		t.Fatalf("expected fake source shares, got %+v", report.BySource[0])
	}
}
