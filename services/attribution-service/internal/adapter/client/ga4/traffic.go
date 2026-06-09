package ga4

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/attribution-service/internal/usecase"
)

var trafficSourceEngines = map[string]string{
	"chat.openai.com":         "ChatGPT",
	"chatgpt.com":             "ChatGPT",
	"openai.com":              "ChatGPT",
	"chat-gpt.org":            "ChatGPT",
	"gemini.google.com":       "Gemini",
	"bard.google.com":         "Gemini",
	"perplexity.ai":           "Perplexity",
	"copilot.microsoft.com":   "Microsoft Copilot",
	"edgeservices.bing.com":   "Microsoft Copilot",
	"edgepilot.microsoft.com": "Microsoft Copilot",
	"claude.ai":               "Claude",
	"anthropic.com":           "Claude",
	"grok.x.ai":               "Grok",
	"x.ai":                    "Grok",
	"chat.deepseek.com":       "DeepSeek",
	"deepseek.com":            "DeepSeek",
	"you.com":                 "You.com",
	"phind.com":               "Phind",
	"chat.mistral.ai":         "Mistral",
	"mistral.ai":              "Mistral",
	"qwen.ai":                 "Qwen",
	"chat.qwen.ai":            "Qwen",
	"tongyi.aliyun.com":       "Qwen",
	"alibaba.com":             "Qwen",
	"z.ai":                    "Z.ai",
	"chat.z.ai":               "Z.ai",
	"poe.com":                 "Poe",
	"kimi.com":                "Kimi",
	"kimi.moonshot.cn":        "Kimi",
	"moonshot.ai":             "Kimi",
	"doubao.com":              "Doubao",
	"meta.ai":                 "Meta AI",
	"llama.meta.com":          "Meta AI",
	"nimble.ai":               "Nimble",
	"iask.ai":                 "iAsk",
	"writesonic.com":          "Writesonic",
	"copy.ai":                 "Copy.ai",
}

type trafficDetectionPattern struct {
	pattern string
	engine  string
}

var trafficDetectionPatterns = []trafficDetectionPattern{
	{pattern: "openai", engine: "ChatGPT"},
	{pattern: "chatgpt", engine: "ChatGPT"},
	{pattern: "chat-gpt", engine: "ChatGPT"},
	{pattern: "perplexity", engine: "Perplexity"},
	{pattern: "gemini", engine: "Gemini"},
	{pattern: "bard", engine: "Gemini"},
	{pattern: "copilot.microsoft", engine: "Microsoft Copilot"},
	{pattern: "edgeservices", engine: "Microsoft Copilot"},
	{pattern: "edgepilot", engine: "Microsoft Copilot"},
	{pattern: "claude", engine: "Claude"},
	{pattern: "anthropic", engine: "Claude"},
	{pattern: "grok", engine: "Grok"},
	{pattern: "deepseek", engine: "DeepSeek"},
	{pattern: "qwen", engine: "Qwen"},
	{pattern: "alibaba", engine: "Qwen"},
	{pattern: "z.ai", engine: "Z.ai"},
	{pattern: "you.com", engine: "You.com"},
	{pattern: "phind", engine: "Phind"},
	{pattern: "mistral", engine: "Mistral"},
	{pattern: "poe", engine: "Poe"},
	{pattern: "kimi", engine: "Kimi"},
	{pattern: "moonshot", engine: "Kimi"},
	{pattern: "doubao", engine: "Doubao"},
	{pattern: "meta.ai", engine: "Meta AI"},
	{pattern: "llama", engine: "Meta AI"},
	{pattern: "nimble.ai", engine: "Nimble"},
	{pattern: "iask.ai", engine: "iAsk"},
	{pattern: "writesonic.com", engine: "Writesonic"},
	{pattern: "copy.ai", engine: "Copy.ai"},
}

var aiTrafficRegexFragments = []string{
	"chatgpt",
	"perplexity",
	"claude\\.ai",
	"copilot\\.microsoft\\.com",
	"copilot",
	"openai",
	"openai\\.com",
	"gemini\\.google\\.com",
	"edgeservices",
	"edgepilot",
	"nimble\\.ai",
	"iask\\.ai",
	"writesonic\\.com",
	"copy\\.ai",
	"chat-gpt\\.org",
	"anthropic",
	"bard",
	"grok",
	"deepseek",
	"mistral",
	"qwen",
	"alibaba",
	"z\\.ai",
	"you\\.com",
	"phind",
	"poe",
	"kimi",
	"moonshot",
	"doubao",
	"meta\\.ai",
	"llama",
}

var privatePagePathPrefixes = []string{"/admin"}

type ga4RunReportResponse struct {
	Rows          []ga4RunReportRow `json:"rows"`
	PropertyQuota *ga4PropertyQuota `json:"propertyQuota"`
}

type ga4RunReportRow struct {
	DimensionValues []ga4Value `json:"dimensionValues"`
	MetricValues    []ga4Value `json:"metricValues"`
}

type ga4Value struct {
	Value string `json:"value"`
}

type ga4PropertyQuota struct {
	TokensPerDay                  ga4QuotaStatus `json:"tokensPerDay"`
	ServerErrorsPerProjectPerHour ga4QuotaStatus `json:"serverErrorsPerProjectPerHour"`
}

type ga4QuotaStatus struct {
	Consumed  int64 `json:"consumed"`
	Remaining int64 `json:"remaining"`
}

func (c *Client) GetTrafficReport(
	ctx context.Context,
	project usecase.ProjectMetadata,
	from,
	to time.Time,
	filters usecase.TrafficFilters,
) (usecase.TrafficReport, error) {
	propertyID := strings.TrimSpace(project.GA4.PropertyID)
	if propertyID == "" {
		return usecase.TrafficReport{}, fmt.Errorf("ga4 property id is required")
	}

	accessToken, err := c.getProjectAccessToken(ctx, project)
	if err != nil {
		return usecase.TrafficReport{}, err
	}

	from = from.UTC()
	to = to.UTC()
	filters.Search = strings.TrimSpace(filters.Search)
	filters.Engine = strings.TrimSpace(filters.Engine)
	log.Printf(
		"ga4 traffic api request project=%s property=%s from=%s to=%s search=%q engine=%q fakeFallback=%t",
		strings.TrimSpace(project.ID),
		propertyID,
		from.Format("2006-01-02"),
		to.Format("2006-01-02"),
		filters.Search,
		filters.Engine,
		c.fakeTrafficEnabled,
	)
	totalResponse, err := c.runReport(ctx, accessToken, propertyID, buildTotalTrafficRequest(from, to))
	if err != nil {
		return usecase.TrafficReport{}, err
	}
	sourceResponse, err := c.runReport(ctx, accessToken, propertyID, buildTrafficSourceRequest(from, to, filters))
	if err != nil {
		return usecase.TrafficReport{}, err
	}
	pageResponse, err := c.runReport(ctx, accessToken, propertyID, buildTrafficTopPagesRequest(from, to, filters))
	if err != nil {
		return usecase.TrafficReport{}, err
	}
	timeseriesResponse, err := c.runReport(ctx, accessToken, propertyID, buildTrafficTimeseriesRequest(from, to, filters))
	if err != nil {
		return usecase.TrafficReport{}, err
	}

	bySource := parseTrafficSourceRows(sourceResponse.Rows)
	topPages := parseTrafficTopPageRows(pageResponse.Rows)
	timeseries := parseTrafficTimeseriesRows(timeseriesResponse.Rows)
	summary := buildTrafficSummary(parseFirstMetricInt(totalResponse.Rows), bySource)

	report := usecase.TrafficReport{
		ProjectID:  strings.TrimSpace(project.ID),
		PropertyID: propertyID,
		DataSource: usecase.TrafficDataSourceGA4,
		DateRange: usecase.TrafficDateRange{
			StartDate: from.Format("2006-01-02"),
			EndDate:   to.Format("2006-01-02"),
		},
		GeneratedAt:   time.Now().UTC().Format(time.RFC3339),
		Summary:       summary,
		BySource:      bySource,
		TopPages:      topPages,
		Timeseries:    timeseries,
		PropertyQuota: convertPropertyQuota(sourceResponse.PropertyQuota),
	}
	logGA4TrafficAPIData(project, from, to, filters, totalResponse, sourceResponse, pageResponse, timeseriesResponse, report)
	if c.fakeTrafficEnabled && shouldUseFakeTrafficReport(report) {
		log.Printf(
			"ga4 traffic api returned no traffic rows; using fake traffic data project=%s property=%s",
			strings.TrimSpace(project.ID),
			propertyID,
		)
		report = buildFakeTrafficReport(report, from, to)
	}
	return report, nil
}

func (c *Client) runReport(ctx context.Context, accessToken, propertyID string, payload map[string]any) (ga4RunReportResponse, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return ga4RunReportResponse{}, fmt.Errorf("marshal ga4 runReport payload: %w", err)
	}

	endpoint := "https://analyticsdata.googleapis.com/v1beta/properties/" + url.PathEscape(propertyID) + ":runReport"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(string(body)))
	if err != nil {
		return ga4RunReportResponse{}, fmt.Errorf("create ga4 runReport request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return ga4RunReportResponse{}, fmt.Errorf("send ga4 runReport request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<10))
		message := strings.TrimSpace(string(raw))
		if message == "" {
			message = http.StatusText(resp.StatusCode)
		}
		return ga4RunReportResponse{}, fmt.Errorf("ga4 runReport error (%d): %s", resp.StatusCode, message)
	}

	var out ga4RunReportResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return ga4RunReportResponse{}, fmt.Errorf("decode ga4 runReport response: %w", err)
	}
	return out, nil
}

func buildTotalTrafficRequest(from, to time.Time) map[string]any {
	return map[string]any{
		"dateRanges": []map[string]string{dateRangePayload(from, to)},
		"metrics": []map[string]string{
			{"name": "sessions"},
		},
		"limit": "1",
	}
}

func buildTrafficSourceRequest(from, to time.Time, filters usecase.TrafficFilters) map[string]any {
	return map[string]any{
		"dateRanges": []map[string]string{dateRangePayload(from, to)},
		"dimensions": []map[string]string{
			{"name": "sessionSource"},
			{"name": "sessionMedium"},
			{"name": "sessionSourceMedium"},
			{"name": "pageReferrer"},
		},
		"metrics": []map[string]string{
			{"name": "sessions"},
			{"name": "engagedSessions"},
			{"name": "engagementRate"},
			{"name": "bounceRate"},
			{"name": "averageSessionDuration"},
			{"name": "keyEvents"},
			{"name": "screenPageViews"},
		},
		"dimensionFilter": buildTrafficDimensionFilter(filters),
		"orderBys": []map[string]any{
			{"metric": map[string]string{"metricName": "sessions"}, "desc": true},
		},
		"limit":               "1000",
		"returnPropertyQuota": true,
	}
}

func buildTrafficTopPagesRequest(from, to time.Time, filters usecase.TrafficFilters) map[string]any {
	return map[string]any{
		"dateRanges": []map[string]string{dateRangePayload(from, to)},
		"dimensions": []map[string]string{
			{"name": "pagePath"},
			{"name": "pageTitle"},
			{"name": "sessionSource"},
			{"name": "pageReferrer"},
		},
		"metrics": []map[string]string{
			{"name": "sessions"},
			{"name": "engagedSessions"},
			{"name": "keyEvents"},
			{"name": "screenPageViews"},
		},
		"dimensionFilter": buildTrafficDimensionFilter(filters),
		"orderBys": []map[string]any{
			{"metric": map[string]string{"metricName": "sessions"}, "desc": true},
		},
		"limit": "50",
	}
}

func buildTrafficTimeseriesRequest(from, to time.Time, filters usecase.TrafficFilters) map[string]any {
	return map[string]any{
		"dateRanges": []map[string]string{dateRangePayload(from, to)},
		"dimensions": []map[string]string{
			{"name": "date"},
			{"name": "sessionSource"},
			{"name": "pageReferrer"},
		},
		"metrics": []map[string]string{
			{"name": "sessions"},
			{"name": "engagedSessions"},
			{"name": "keyEvents"},
		},
		"dimensionFilter": buildTrafficDimensionFilter(filters),
		"orderBys": []map[string]any{
			{"dimension": map[string]string{"dimensionName": "date"}},
		},
		"limit": "10000",
	}
}

func dateRangePayload(from, to time.Time) map[string]string {
	return map[string]string{
		"startDate": from.UTC().Format("2006-01-02"),
		"endDate":   to.UTC().Format("2006-01-02"),
	}
}

func buildTrafficDimensionFilter(filters usecase.TrafficFilters) map[string]any {
	expressions := []map[string]any{
		buildTrafficOnlyDimensionFilter(filters.Engine),
		buildPublicPageDimensionFilter(),
	}
	return map[string]any{
		"andGroup": map[string]any{
			"expressions": appendTrafficDimensionFilters(expressions, filters.Search),
		},
	}
}

func appendTrafficDimensionFilters(expressions []map[string]any, search string) []map[string]any {
	if strings.TrimSpace(search) != "" {
		expressions = append(expressions, buildSearchDimensionFilter(search))
	}
	return expressions
}

func buildTrafficOnlyDimensionFilter(engineFilter string) map[string]any {
	regex := buildAITrafficRegex(aiTrafficRegexFragments)
	if strings.TrimSpace(engineFilter) != "" && strings.TrimSpace(engineFilter) != "all" {
		patterns := trafficDetectionPatternsForEngine(engineFilter)
		if len(patterns) == 0 {
			regex = buildAITrafficRegex(aiTrafficRegexFragments)
		} else {
			regex = buildAITrafficRegex(trafficDetectionRegexFragments(patterns))
		}
	}
	fields := []string{"sessionSourceMedium", "sessionSource"}
	expressions := make([]map[string]any, 0, len(fields))
	for _, fieldName := range fields {
		expressions = append(expressions, map[string]any{
			"filter": map[string]any{
				"fieldName": fieldName,
				"stringFilter": map[string]any{
					"matchType":     "FULL_REGEXP",
					"value":         regex,
					"caseSensitive": false,
				},
			},
		})
	}
	return map[string]any{
		"orGroup": map[string]any{
			"expressions": expressions,
		},
	}
}

func buildPublicPageDimensionFilter() map[string]any {
	expressions := make([]map[string]any, 0, len(privatePagePathPrefixes))
	for _, prefix := range privatePagePathPrefixes {
		expressions = append(expressions, map[string]any{
			"filter": map[string]any{
				"fieldName": "pagePath",
				"stringFilter": map[string]any{
					"matchType":     "BEGINS_WITH",
					"value":         prefix,
					"caseSensitive": false,
				},
			},
		})
	}
	if len(expressions) == 1 {
		return map[string]any{"notExpression": expressions[0]}
	}
	return map[string]any{
		"notExpression": map[string]any{
			"orGroup": map[string]any{
				"expressions": expressions,
			},
		},
	}
}

func buildAITrafficRegex(fragments []string) string {
	parts := make([]string, 0, len(fragments))
	seen := make(map[string]struct{}, len(fragments))
	for _, fragment := range fragments {
		fragment = strings.TrimSpace(fragment)
		if fragment == "" {
			continue
		}
		if _, ok := seen[fragment]; ok {
			continue
		}
		seen[fragment] = struct{}{}
		parts = append(parts, ".*"+fragment+".*")
	}
	if len(parts) == 0 {
		parts = []string{".*chatgpt.*"}
	}
	return "(?i)(" + strings.Join(parts, "|") + ")"
}

func trafficDetectionRegexFragments(patterns []trafficDetectionPattern) []string {
	fragments := make([]string, 0, len(patterns))
	for _, item := range patterns {
		fragments = append(fragments, regexpEscapeForGA4(item.pattern))
	}
	return fragments
}

func regexpEscapeForGA4(value string) string {
	replacer := strings.NewReplacer(
		`\`, `\\`,
		`.`, `\.`,
		`+`, `\+`,
		`*`, `\*`,
		`?`, `\?`,
		`(`, `\(`,
		`)`, `\)`,
		`[`, `\[`,
		`]`, `\]`,
		`{`, `\{`,
		`}`, `\}`,
		`^`, `\^`,
		`$`, `\$`,
		`|`, `\|`,
	)
	return replacer.Replace(value)
}

func trafficDetectionPatternsForEngine(engineFilter string) []trafficDetectionPattern {
	normalized := strings.ToLower(strings.TrimSpace(engineFilter))
	out := make([]trafficDetectionPattern, 0)
	for _, item := range trafficDetectionPatterns {
		if strings.ToLower(item.engine) == normalized {
			out = append(out, item)
		}
	}
	return out
}

func buildSearchDimensionFilter(search string) map[string]any {
	value := strings.TrimSpace(search)
	fields := []string{"sessionSource", "sessionMedium", "sessionSourceMedium", "pageReferrer", "pagePath", "pageTitle"}
	expressions := make([]map[string]any, 0, len(fields))
	for _, fieldName := range fields {
		expressions = append(expressions, map[string]any{
			"filter": map[string]any{
				"fieldName": fieldName,
				"stringFilter": map[string]any{
					"matchType":     "CONTAINS",
					"value":         value,
					"caseSensitive": false,
				},
			},
		})
	}
	return map[string]any{
		"orGroup": map[string]any{
			"expressions": expressions,
		},
	}
}

func classifyTrafficEngine(source string) (string, bool) {
	normalized := normalizeTrafficSource(source)
	if normalized == "" {
		return "", false
	}
	if engine, ok := trafficSourceEngines[normalized]; ok {
		return engine, true
	}
	for _, item := range trafficDetectionPatterns {
		if strings.Contains(normalized, item.pattern) {
			return item.engine, true
		}
	}
	return "", false
}

func normalizeTrafficSource(source string) string {
	normalized := strings.ToLower(strings.TrimSpace(source))
	if normalized == "" {
		return ""
	}
	if parsed, err := url.Parse(normalized); err == nil && parsed.Hostname() != "" {
		normalized = parsed.Hostname()
	}
	normalized = strings.TrimPrefix(normalized, "www.")
	normalized = strings.TrimSuffix(normalized, ".")
	return normalized
}

func trafficSourceFromRow(row ga4RunReportRow, sourceIndex, mediumIndex, sourceMediumIndex, _ int) (string, string, string, string, bool) {
	source := dimensionValue(row, sourceIndex)
	if engine, ok := classifyTrafficEngine(source); ok {
		medium := dimensionValue(row, mediumIndex)
		sourceMedium := dimensionValue(row, sourceMediumIndex)
		if sourceMedium == "" && source != "" && medium != "" {
			sourceMedium = source + " / " + medium
		}
		return source, medium, sourceMedium, engine, true
	}
	return "", "", "", "", false
}

func parseTrafficSourceRows(rows []ga4RunReportRow) []usecase.TrafficSource {
	bySource := make(map[string]*usecase.TrafficSource)
	for _, row := range rows {
		source, medium, sourceMedium, engine, ok := trafficSourceFromRow(row, 0, 1, 2, 3)
		if !ok {
			continue
		}
		sessions := metricInt(row, 0)
		if sessions <= 0 {
			continue
		}
		engagedSessions := metricInt(row, 1)
		engagementRate := rateMetricToPercent(metricFloat(row, 2), engagedSessions, sessions)
		bounceRate := rateMetricToPercent(metricFloat(row, 3), sessions-engagedSessions, sessions)
		key := strings.ToLower(strings.TrimSpace(source)) + "\x00" + strings.ToLower(strings.TrimSpace(medium)) + "\x00" + engine
		current := bySource[key]
		if current == nil {
			current = &usecase.TrafficSource{
				Source:       source,
				Medium:       medium,
				SourceMedium: sourceMedium,
				Engine:       engine,
			}
			bySource[key] = current
		}
		mergeTrafficSourceMetrics(
			current,
			sessions,
			engagedSessions,
			engagementRate,
			bounceRate,
			metricFloat(row, 4),
			metricFloat(row, 5),
			metricInt(row, 6),
		)
	}
	out := make([]usecase.TrafficSource, 0, len(bySource))
	total := int64(0)
	for _, item := range bySource {
		finalizeTrafficSourceRates(item)
		out = append(out, *item)
		total += item.Sessions
	}
	for i := range out {
		out[i].ShareOfTrafficSessions = round2(percentFloat(out[i].Sessions, total))
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Sessions == out[j].Sessions {
			return out[i].Source < out[j].Source
		}
		return out[i].Sessions > out[j].Sessions
	})
	return out
}

func mergeTrafficSourceMetrics(
	current *usecase.TrafficSource,
	sessions,
	engagedSessions int64,
	engagementRate,
	bounceRate,
	avgSessionSeconds,
	conversions float64,
	pageViews int64,
) {
	previousSessions := current.Sessions
	current.Sessions += sessions
	current.EngagedSessions += engagedSessions
	current.PageViews += pageViews
	current.Conversions = round2(current.Conversions + conversions)
	current.AvgSessionSeconds = weightedAverage(current.AvgSessionSeconds, previousSessions, avgSessionSeconds, sessions)
	current.EngagementRate = weightedAverage(current.EngagementRate, previousSessions, engagementRate, sessions)
	current.BounceRate = weightedAverage(current.BounceRate, previousSessions, bounceRate, sessions)
}

func finalizeTrafficSourceRates(source *usecase.TrafficSource) {
	source.AvgSessionSeconds = round2(source.AvgSessionSeconds)
	source.EngagementRate = round2(source.EngagementRate)
	source.BounceRate = round2(source.BounceRate)
}

func weightedAverage(current float64, currentWeight int64, next float64, nextWeight int64) float64 {
	totalWeight := currentWeight + nextWeight
	if totalWeight <= 0 {
		return 0
	}
	return ((current * float64(currentWeight)) + (next * float64(nextWeight))) / float64(totalWeight)
}

func parseTrafficTopPageRows(rows []ga4RunReportRow) []usecase.TrafficPage {
	byPage := make(map[string]*usecase.TrafficPage)
	for _, row := range rows {
		source, _, _, engine, ok := trafficSourceFromRow(row, 2, -1, -1, 3)
		if !ok {
			continue
		}
		sessions := metricInt(row, 0)
		if sessions <= 0 {
			continue
		}
		engagedSessions := metricInt(row, 1)
		path := dimensionValue(row, 0)
		title := dimensionValue(row, 1)
		key := path + "\x00" + strings.ToLower(strings.TrimSpace(source)) + "\x00" + engine
		current := byPage[key]
		if current == nil {
			current = &usecase.TrafficPage{
				Path:   path,
				Title:  title,
				Source: source,
				Engine: engine,
			}
			byPage[key] = current
		}
		if current.Title == "" && title != "" {
			current.Title = title
		}
		current.Sessions += sessions
		current.EngagedSessions += engagedSessions
		current.Conversions = round2(current.Conversions + metricFloat(row, 2))
		current.PageViews += metricInt(row, 3)
	}
	out := make([]usecase.TrafficPage, 0, len(byPage))
	for _, page := range byPage {
		page.EngagementRate = round2(percentFloat(page.EngagedSessions, page.Sessions))
		out = append(out, *page)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Sessions == out[j].Sessions {
			if out[i].Path == out[j].Path {
				return out[i].Source < out[j].Source
			}
			return out[i].Path < out[j].Path
		}
		return out[i].Sessions > out[j].Sessions
	})
	return out
}

func parseTrafficTimeseriesRows(rows []ga4RunReportRow) []usecase.TrafficDailyPoint {
	byDate := make(map[string]*usecase.TrafficDailyPoint)
	for _, row := range rows {
		date := formatGA4Date(dimensionValue(row, 0))
		if date == "" {
			continue
		}
		_, _, _, _, ok := trafficSourceFromRow(row, 1, -1, -1, 2)
		if !ok {
			continue
		}
		current := byDate[date]
		if current == nil {
			current = &usecase.TrafficDailyPoint{Date: date}
			byDate[date] = current
		}
		current.Sessions += metricInt(row, 0)
		current.EngagedSessions += metricInt(row, 1)
		current.Conversions = round2(current.Conversions + metricFloat(row, 2))
	}
	out := make([]usecase.TrafficDailyPoint, 0, len(byDate))
	for _, item := range byDate {
		out = append(out, *item)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].Date < out[j].Date
	})
	return out
}

func buildTrafficSummary(totalSessions int64, sources []usecase.TrafficSource) usecase.TrafficSummary {
	var trafficSessions int64
	var engagedSessions int64
	var pageViews int64
	var conversions float64
	var weightedDuration float64
	var weightedBounce float64
	byEngine := make(map[string]int64)

	for _, source := range sources {
		trafficSessions += source.Sessions
		engagedSessions += source.EngagedSessions
		pageViews += source.PageViews
		conversions += source.Conversions
		weightedDuration += source.AvgSessionSeconds * float64(source.Sessions)
		weightedBounce += source.BounceRate * float64(source.Sessions)
		byEngine[source.Engine] += source.Sessions
	}

	topEngine := ""
	var topEngineSessions int64
	for engine, sessions := range byEngine {
		if sessions > topEngineSessions || (sessions == topEngineSessions && engine < topEngine) {
			topEngine = engine
			topEngineSessions = sessions
		}
	}

	avgDuration := 0.0
	bounceRate := 0.0
	if trafficSessions > 0 {
		avgDuration = weightedDuration / float64(trafficSessions)
		bounceRate = weightedBounce / float64(trafficSessions)
	}

	return usecase.TrafficSummary{
		TotalTrafficSessions:     trafficSessions,
		TotalSessions:            totalSessions,
		TrafficShareOfTotal:      round2(percentFloat(trafficSessions, totalSessions)),
		TrafficEngagedSessions:   engagedSessions,
		TrafficEngagementRate:    round2(percentFloat(engagedSessions, trafficSessions)),
		TrafficAvgSessionSeconds: round2(avgDuration),
		TrafficBounceRate:        round2(bounceRate),
		TrafficConversions:       round2(conversions),
		TrafficConversionRate:    round2(percentFloatFloat(conversions, trafficSessions)),
		TrafficPageViews:         pageViews,
		TopEngine:                topEngine,
	}
}

func convertPropertyQuota(quota *ga4PropertyQuota) *usecase.TrafficPropertyQuota {
	if quota == nil {
		return nil
	}
	return &usecase.TrafficPropertyQuota{
		TokensPerDay: usecase.TrafficQuotaStatus{
			Consumed:  quota.TokensPerDay.Consumed,
			Remaining: quota.TokensPerDay.Remaining,
		},
		ServerErrorsPerProjectPerHour: usecase.TrafficQuotaStatus{
			Consumed:  quota.ServerErrorsPerProjectPerHour.Consumed,
			Remaining: quota.ServerErrorsPerProjectPerHour.Remaining,
		},
	}
}

type ga4TrafficLogDateRange struct {
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
}

type ga4TrafficLogFilters struct {
	Search string `json:"search,omitempty"`
	Engine string `json:"engine,omitempty"`
}

type ga4TrafficLogRawRow struct {
	Dimensions []string `json:"dimensions"`
	Metrics    []string `json:"metrics"`
}

type ga4TrafficLogPreview struct {
	ProjectID                string                      `json:"projectId"`
	PropertyID               string                      `json:"propertyId"`
	DateRange                ga4TrafficLogDateRange      `json:"dateRange"`
	Filters                  ga4TrafficLogFilters        `json:"filters,omitempty"`
	RawRows                  map[string]int              `json:"rawRows"`
	RawTotalRowsPreview      []ga4TrafficLogRawRow       `json:"rawTotalRowsPreview"`
	RawSourceRowsPreview     []ga4TrafficLogRawRow       `json:"rawSourceRowsPreview"`
	RawTopPageRowsPreview    []ga4TrafficLogRawRow       `json:"rawTopPageRowsPreview"`
	RawTimeseriesRowsPreview []ga4TrafficLogRawRow       `json:"rawTimeseriesRowsPreview"`
	Summary                  usecase.TrafficSummary      `json:"summary"`
	BySourcePreview          []usecase.TrafficSource     `json:"bySourcePreview"`
	TopPagesPreview          []usecase.TrafficPage       `json:"topPagesPreview"`
	TimeseriesCount          int                         `json:"timeseriesCount"`
	TimeseriesHead           []usecase.TrafficDailyPoint `json:"timeseriesHead"`
}

func logGA4TrafficAPIData(
	project usecase.ProjectMetadata,
	from,
	to time.Time,
	filters usecase.TrafficFilters,
	totalResponse,
	sourceResponse,
	pageResponse,
	timeseriesResponse ga4RunReportResponse,
	report usecase.TrafficReport,
) {
	preview := buildGA4TrafficLogPreview(
		project,
		from,
		to,
		filters,
		totalResponse,
		sourceResponse,
		pageResponse,
		timeseriesResponse,
		report,
	)
	raw, err := json.Marshal(preview)
	if err != nil {
		log.Printf("ga4 traffic api data project=%s property=%s marshal_error=%v", preview.ProjectID, preview.PropertyID, err)
		return
	}
	log.Printf("ga4 traffic api data %s", string(raw))
}

func buildGA4TrafficLogPreview(
	project usecase.ProjectMetadata,
	from,
	to time.Time,
	filters usecase.TrafficFilters,
	totalResponse,
	sourceResponse,
	pageResponse,
	timeseriesResponse ga4RunReportResponse,
	report usecase.TrafficReport,
) ga4TrafficLogPreview {
	return ga4TrafficLogPreview{
		ProjectID:  strings.TrimSpace(project.ID),
		PropertyID: report.PropertyID,
		DateRange: ga4TrafficLogDateRange{
			StartDate: from.UTC().Format("2006-01-02"),
			EndDate:   to.UTC().Format("2006-01-02"),
		},
		Filters: ga4TrafficLogFilters{
			Search: strings.TrimSpace(filters.Search),
			Engine: strings.TrimSpace(filters.Engine),
		},
		RawRows: map[string]int{
			"total":      len(totalResponse.Rows),
			"sources":    len(sourceResponse.Rows),
			"topPages":   len(pageResponse.Rows),
			"timeseries": len(timeseriesResponse.Rows),
		},
		RawTotalRowsPreview:      firstGA4RawRows(totalResponse.Rows, 10),
		RawSourceRowsPreview:     firstGA4RawRows(sourceResponse.Rows, 10),
		RawTopPageRowsPreview:    firstGA4RawRows(pageResponse.Rows, 10),
		RawTimeseriesRowsPreview: firstGA4RawRows(timeseriesResponse.Rows, 10),
		Summary:                  report.Summary,
		BySourcePreview:          firstTrafficSources(report.BySource, 5),
		TopPagesPreview:          firstTrafficPages(report.TopPages, 5),
		TimeseriesCount:          len(report.Timeseries),
		TimeseriesHead:           firstTrafficDailyPoints(report.Timeseries, 5),
	}
}

func shouldUseFakeTrafficReport(report usecase.TrafficReport) bool {
	return len(report.BySource) == 0 && len(report.TopPages) == 0 && len(report.Timeseries) == 0
}

func buildFakeTrafficReport(base usecase.TrafficReport, from, to time.Time) usecase.TrafficReport {
	report := base
	report.DataSource = usecase.TrafficDataSourceFake
	if report.DateRange.StartDate == "" {
		report.DateRange.StartDate = from.UTC().Format("2006-01-02")
	}
	if report.DateRange.EndDate == "" {
		report.DateRange.EndDate = to.UTC().Format("2006-01-02")
	}
	if strings.TrimSpace(report.GeneratedAt) == "" {
		report.GeneratedAt = time.Now().UTC().Format(time.RFC3339)
	}

	report.BySource = []usecase.TrafficSource{
		{
			Source:            "chatgpt.com",
			Medium:            "referral",
			SourceMedium:      "chatgpt.com / referral",
			Engine:            "ChatGPT",
			Sessions:          86,
			EngagedSessions:   67,
			EngagementRate:    77.91,
			BounceRate:        22.09,
			AvgSessionSeconds: 94,
			Conversions:       7,
			PageViews:         214,
		},
		{
			Source:            "perplexity.ai",
			Medium:            "referral",
			SourceMedium:      "perplexity.ai / referral",
			Engine:            "Perplexity",
			Sessions:          42,
			EngagedSessions:   33,
			EngagementRate:    78.57,
			BounceRate:        21.43,
			AvgSessionSeconds: 88,
			Conversions:       3,
			PageViews:         108,
		},
		{
			Source:            "gemini.google.com",
			Medium:            "referral",
			SourceMedium:      "gemini.google.com / referral",
			Engine:            "Gemini",
			Sessions:          25,
			EngagedSessions:   18,
			EngagementRate:    72,
			BounceRate:        28,
			AvgSessionSeconds: 71,
			Conversions:       1,
			PageViews:         61,
		},
		{
			Source:            "claude.ai",
			Medium:            "referral",
			SourceMedium:      "claude.ai / referral",
			Engine:            "Claude",
			Sessions:          18,
			EngagedSessions:   15,
			EngagementRate:    83.33,
			BounceRate:        16.67,
			AvgSessionSeconds: 103,
			Conversions:       2,
			PageViews:         44,
		},
		{
			Source:            "copilot.microsoft.com",
			Medium:            "referral",
			SourceMedium:      "copilot.microsoft.com / referral",
			Engine:            "Microsoft Copilot",
			Sessions:          12,
			EngagedSessions:   9,
			EngagementRate:    75,
			BounceRate:        25,
			AvgSessionSeconds: 64,
			Conversions:       1,
			PageViews:         29,
		},
		{
			Source:            "chat.qwen.ai",
			Medium:            "referral",
			SourceMedium:      "chat.qwen.ai / referral",
			Engine:            "Qwen",
			Sessions:          9,
			EngagedSessions:   7,
			EngagementRate:    77.78,
			BounceRate:        22.22,
			AvgSessionSeconds: 69,
			Conversions:       1,
			PageViews:         21,
		},
		{
			Source:            "z.ai",
			Medium:            "referral",
			SourceMedium:      "z.ai / referral",
			Engine:            "Z.ai",
			Sessions:          7,
			EngagedSessions:   5,
			EngagementRate:    71.43,
			BounceRate:        28.57,
			AvgSessionSeconds: 58,
			Conversions:       0,
			PageViews:         16,
		},
		{
			Source:            "poe.com",
			Medium:            "referral",
			SourceMedium:      "poe.com / referral",
			Engine:            "Poe",
			Sessions:          6,
			EngagedSessions:   5,
			EngagementRate:    83.33,
			BounceRate:        16.67,
			AvgSessionSeconds: 74,
			Conversions:       0,
			PageViews:         13,
		},
	}
	trafficSessions := int64(0)
	for _, source := range report.BySource {
		trafficSessions += source.Sessions
	}
	for i := range report.BySource {
		report.BySource[i].ShareOfTrafficSessions = round2(percentFloat(report.BySource[i].Sessions, trafficSessions))
	}

	totalSessions := report.Summary.TotalSessions
	if totalSessions < trafficSessions {
		totalSessions = trafficSessions * 8
	}
	report.Summary = buildTrafficSummary(totalSessions, report.BySource)
	report.TopPages = []usecase.TrafficPage{
		{Path: "/", Title: "Home", Source: "chatgpt.com", Engine: "ChatGPT", Sessions: 38, EngagedSessions: 31, EngagementRate: 81.58, Conversions: 4, PageViews: 97},
		{Path: "/pricing", Title: "Pricing", Source: "perplexity.ai", Engine: "Perplexity", Sessions: 24, EngagedSessions: 19, EngagementRate: 79.17, Conversions: 3, PageViews: 58},
		{Path: "/blog/ai-search", Title: "AI Search Guide", Source: "chatgpt.com", Engine: "ChatGPT", Sessions: 21, EngagedSessions: 16, EngagementRate: 76.19, Conversions: 1, PageViews: 49},
		{Path: "/features", Title: "Features", Source: "gemini.google.com", Engine: "Gemini", Sessions: 17, EngagedSessions: 12, EngagementRate: 70.59, Conversions: 1, PageViews: 40},
		{Path: "/contact", Title: "Contact", Source: "claude.ai", Engine: "Claude", Sessions: 11, EngagedSessions: 9, EngagementRate: 81.82, Conversions: 2, PageViews: 24},
	}
	report.Timeseries = buildFakeTrafficTimeseries(from, to)
	return report
}

func buildFakeTrafficTimeseries(from, to time.Time) []usecase.TrafficDailyPoint {
	from = from.UTC()
	to = to.UTC()
	if from.IsZero() || to.IsZero() || to.Before(from) {
		to = time.Now().UTC()
		from = to.AddDate(0, 0, -13)
	}
	days := int(to.Sub(from).Hours()/24) + 1
	if days < 1 {
		days = 1
	}
	points := days
	if points > 14 {
		points = 14
	}
	step := 1
	if points > 1 {
		step = int(math.Max(1, math.Floor(float64(days-1)/float64(points-1))))
	}
	out := make([]usecase.TrafficDailyPoint, 0, points)
	for i := 0; i < points; i++ {
		day := from.AddDate(0, 0, i*step)
		if day.After(to) || i == points-1 {
			day = to
		}
		sessions := int64(7 + ((i * 5) % 19))
		engaged := int64(math.Round(float64(sessions) * 0.76))
		out = append(out, usecase.TrafficDailyPoint{
			Date:            day.Format("2006-01-02"),
			Sessions:        sessions,
			EngagedSessions: engaged,
			Conversions:     round2(float64((i%4)+1) * 0.45),
		})
	}
	return out
}

func firstTrafficSources(items []usecase.TrafficSource, limit int) []usecase.TrafficSource {
	if len(items) <= limit {
		return items
	}
	return items[:limit]
}

func firstTrafficPages(items []usecase.TrafficPage, limit int) []usecase.TrafficPage {
	if len(items) <= limit {
		return items
	}
	return items[:limit]
}

func firstTrafficDailyPoints(items []usecase.TrafficDailyPoint, limit int) []usecase.TrafficDailyPoint {
	if len(items) <= limit {
		return items
	}
	return items[:limit]
}

func firstGA4RawRows(rows []ga4RunReportRow, limit int) []ga4TrafficLogRawRow {
	if limit <= 0 || len(rows) == 0 {
		return nil
	}
	if len(rows) < limit {
		limit = len(rows)
	}
	out := make([]ga4TrafficLogRawRow, 0, limit)
	for _, row := range rows[:limit] {
		dimensions := make([]string, 0, len(row.DimensionValues))
		for _, value := range row.DimensionValues {
			dimensions = append(dimensions, strings.TrimSpace(value.Value))
		}
		metrics := make([]string, 0, len(row.MetricValues))
		for _, value := range row.MetricValues {
			metrics = append(metrics, strings.TrimSpace(value.Value))
		}
		out = append(out, ga4TrafficLogRawRow{
			Dimensions: dimensions,
			Metrics:    metrics,
		})
	}
	return out
}

func parseFirstMetricInt(rows []ga4RunReportRow) int64 {
	if len(rows) == 0 {
		return 0
	}
	return metricInt(rows[0], 0)
}

func dimensionValue(row ga4RunReportRow, index int) string {
	if index < 0 || index >= len(row.DimensionValues) {
		return ""
	}
	return strings.TrimSpace(row.DimensionValues[index].Value)
}

func metricFloat(row ga4RunReportRow, index int) float64 {
	if index < 0 || index >= len(row.MetricValues) {
		return 0
	}
	value, err := strconv.ParseFloat(strings.TrimSpace(row.MetricValues[index].Value), 64)
	if err != nil || math.IsNaN(value) || math.IsInf(value, 0) {
		return 0
	}
	return value
}

func metricInt(row ga4RunReportRow, index int) int64 {
	return int64(math.Round(metricFloat(row, index)))
}

func rateMetricToPercent(metricValue float64, numerator, denominator int64) float64 {
	if metricValue > 0 {
		if metricValue <= 1 {
			return metricValue * 100
		}
		return metricValue
	}
	return percentFloat(numerator, denominator)
}

func percentFloat(numerator, denominator int64) float64 {
	if denominator <= 0 {
		return 0
	}
	return float64(numerator) / float64(denominator) * 100
}

func percentFloatFloat(numerator float64, denominator int64) float64 {
	if denominator <= 0 {
		return 0
	}
	return numerator / float64(denominator) * 100
}

func round2(value float64) float64 {
	return math.Round(value*100) / 100
}

func formatGA4Date(value string) string {
	value = strings.TrimSpace(value)
	if len(value) != 8 {
		return value
	}
	parsed, err := time.Parse("20060102", value)
	if err != nil {
		return ""
	}
	return parsed.Format("2006-01-02")
}
