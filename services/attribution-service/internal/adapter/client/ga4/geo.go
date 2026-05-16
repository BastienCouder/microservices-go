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

var geoSourceEngines = map[string]string{
	"chat.openai.com":       "ChatGPT",
	"chatgpt.com":           "ChatGPT",
	"gemini.google.com":     "Gemini",
	"bard.google.com":       "Gemini",
	"perplexity.ai":         "Perplexity",
	"copilot.microsoft.com": "Microsoft Copilot",
	"claude.ai":             "Claude",
	"anthropic.com":         "Claude",
	"grok.x.ai":             "Grok",
	"chat.deepseek.com":     "DeepSeek",
	"you.com":               "You.com",
	"phind.com":             "Phind",
	"chat.mistral.ai":       "Mistral",
}

var geoDetectionPatterns = []struct {
	pattern string
	engine  string
}{
	{pattern: "openai", engine: "ChatGPT"},
	{pattern: "chatgpt", engine: "ChatGPT"},
	{pattern: "perplexity", engine: "Perplexity"},
	{pattern: "gemini", engine: "Gemini"},
	{pattern: "bard", engine: "Gemini"},
	{pattern: "copilot.microsoft", engine: "Microsoft Copilot"},
	{pattern: "claude", engine: "Claude"},
	{pattern: "anthropic", engine: "Claude"},
	{pattern: "grok", engine: "Grok"},
	{pattern: "deepseek", engine: "DeepSeek"},
	{pattern: "you.com", engine: "You.com"},
	{pattern: "phind", engine: "Phind"},
	{pattern: "mistral", engine: "Mistral"},
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

func (c *Client) GetGeoTrafficReport(
	ctx context.Context,
	project usecase.ProjectMetadata,
	from,
	to time.Time,
	filters usecase.GeoTrafficFilters,
) (usecase.GeoTrafficReport, error) {
	propertyID := strings.TrimSpace(project.GA4.PropertyID)
	if propertyID == "" {
		return usecase.GeoTrafficReport{}, fmt.Errorf("ga4 property id is required")
	}

	accessToken, err := c.getProjectAccessToken(ctx, project)
	if err != nil {
		return usecase.GeoTrafficReport{}, err
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
		return usecase.GeoTrafficReport{}, err
	}
	sourceResponse, err := c.runReport(ctx, accessToken, propertyID, buildGeoSourceRequest(from, to, filters))
	if err != nil {
		return usecase.GeoTrafficReport{}, err
	}
	pageResponse, err := c.runReport(ctx, accessToken, propertyID, buildGeoTopPagesRequest(from, to, filters))
	if err != nil {
		return usecase.GeoTrafficReport{}, err
	}
	timeseriesResponse, err := c.runReport(ctx, accessToken, propertyID, buildGeoTimeseriesRequest(from, to, filters))
	if err != nil {
		return usecase.GeoTrafficReport{}, err
	}

	bySource := parseGeoSourceRows(sourceResponse.Rows)
	topPages := parseGeoTopPageRows(pageResponse.Rows)
	timeseries := parseGeoTimeseriesRows(timeseriesResponse.Rows)
	summary := buildGeoTrafficSummary(parseFirstMetricInt(totalResponse.Rows), bySource)

	report := usecase.GeoTrafficReport{
		ProjectID:  strings.TrimSpace(project.ID),
		PropertyID: propertyID,
		DataSource: usecase.GeoTrafficDataSourceGA4,
		DateRange: usecase.GeoTrafficDateRange{
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
	if c.fakeTrafficEnabled && shouldUseFakeGeoTrafficReport(report) {
		log.Printf(
			"ga4 traffic api returned no GEO rows; using fake traffic data project=%s property=%s",
			strings.TrimSpace(project.ID),
			propertyID,
		)
		report = buildFakeGeoTrafficReport(report, from, to)
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

func buildGeoSourceRequest(from, to time.Time, filters usecase.GeoTrafficFilters) map[string]any {
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
		"dimensionFilter": buildGeoDimensionFilter(filters),
		"orderBys": []map[string]any{
			{"metric": map[string]string{"metricName": "sessions"}, "desc": true},
		},
		"limit":               "1000",
		"returnPropertyQuota": true,
	}
}

func buildGeoTopPagesRequest(from, to time.Time, filters usecase.GeoTrafficFilters) map[string]any {
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
		"dimensionFilter": buildGeoDimensionFilter(filters),
		"orderBys": []map[string]any{
			{"metric": map[string]string{"metricName": "sessions"}, "desc": true},
		},
		"limit": "50",
	}
}

func buildGeoTimeseriesRequest(from, to time.Time, filters usecase.GeoTrafficFilters) map[string]any {
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
		"dimensionFilter": buildGeoDimensionFilter(filters),
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

func buildGeoDimensionFilter(filters usecase.GeoTrafficFilters) map[string]any {
	expressions := []map[string]any{
		buildGeoOnlyDimensionFilter(filters.Engine),
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

func buildGeoOnlyDimensionFilter(engineFilter string) map[string]any {
	patterns := geoDetectionPatterns
	if strings.TrimSpace(engineFilter) != "" && strings.TrimSpace(engineFilter) != "all" {
		patterns = geoDetectionPatternsForEngine(engineFilter)
		if len(patterns) == 0 {
			patterns = geoDetectionPatterns
		}
	}
	expressions := make([]map[string]any, 0, len(patterns)*2)
	for _, item := range patterns {
		for _, fieldName := range []string{"sessionSource", "pageReferrer"} {
			expressions = append(expressions, map[string]any{
				"filter": map[string]any{
					"fieldName": fieldName,
					"stringFilter": map[string]any{
						"matchType":     "CONTAINS",
						"value":         item.pattern,
						"caseSensitive": false,
					},
				},
			})
		}
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

func geoDetectionPatternsForEngine(engineFilter string) []struct {
	pattern string
	engine  string
} {
	normalized := strings.ToLower(strings.TrimSpace(engineFilter))
	out := make([]struct {
		pattern string
		engine  string
	}, 0)
	for _, item := range geoDetectionPatterns {
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

func classifyGeoEngine(source string) (string, bool) {
	normalized := normalizeGeoSource(source)
	if normalized == "" {
		return "", false
	}
	if engine, ok := geoSourceEngines[normalized]; ok {
		return engine, true
	}
	for _, item := range geoDetectionPatterns {
		if strings.Contains(normalized, item.pattern) {
			return item.engine, true
		}
	}
	return "", false
}

func normalizeGeoSource(source string) string {
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

func geoSourceFromRow(row ga4RunReportRow, sourceIndex, mediumIndex, sourceMediumIndex, referrerIndex int) (string, string, string, string, bool) {
	source := dimensionValue(row, sourceIndex)
	if engine, ok := classifyGeoEngine(source); ok {
		medium := dimensionValue(row, mediumIndex)
		sourceMedium := dimensionValue(row, sourceMediumIndex)
		if sourceMedium == "" && source != "" && medium != "" {
			sourceMedium = source + " / " + medium
		}
		return source, medium, sourceMedium, engine, true
	}

	referrer := dimensionValue(row, referrerIndex)
	engine, ok := classifyGeoEngine(referrer)
	if !ok {
		return "", "", "", "", false
	}
	referrerSource := normalizeGeoSource(referrer)
	if referrerSource == "" {
		referrerSource = strings.TrimSpace(referrer)
	}
	return referrerSource, "referral", referrerSource + " / referral", engine, true
}

func parseGeoSourceRows(rows []ga4RunReportRow) []usecase.GeoTrafficSource {
	bySource := make(map[string]*usecase.GeoTrafficSource)
	for _, row := range rows {
		source, medium, sourceMedium, engine, ok := geoSourceFromRow(row, 0, 1, 2, 3)
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
			current = &usecase.GeoTrafficSource{
				Source:       source,
				Medium:       medium,
				SourceMedium: sourceMedium,
				Engine:       engine,
			}
			bySource[key] = current
		}
		mergeGeoSourceMetrics(
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
	out := make([]usecase.GeoTrafficSource, 0, len(bySource))
	total := int64(0)
	for _, item := range bySource {
		finalizeGeoSourceRates(item)
		out = append(out, *item)
		total += item.Sessions
	}
	for i := range out {
		out[i].ShareOfGeoSessions = round2(percentFloat(out[i].Sessions, total))
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Sessions == out[j].Sessions {
			return out[i].Source < out[j].Source
		}
		return out[i].Sessions > out[j].Sessions
	})
	return out
}

func mergeGeoSourceMetrics(
	current *usecase.GeoTrafficSource,
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

func finalizeGeoSourceRates(source *usecase.GeoTrafficSource) {
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

func parseGeoTopPageRows(rows []ga4RunReportRow) []usecase.GeoTrafficPage {
	byPage := make(map[string]*usecase.GeoTrafficPage)
	for _, row := range rows {
		source, _, _, engine, ok := geoSourceFromRow(row, 2, -1, -1, 3)
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
			current = &usecase.GeoTrafficPage{
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
	out := make([]usecase.GeoTrafficPage, 0, len(byPage))
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

func parseGeoTimeseriesRows(rows []ga4RunReportRow) []usecase.GeoTrafficDailyPoint {
	byDate := make(map[string]*usecase.GeoTrafficDailyPoint)
	for _, row := range rows {
		date := formatGA4Date(dimensionValue(row, 0))
		if date == "" {
			continue
		}
		_, _, _, _, ok := geoSourceFromRow(row, 1, -1, -1, 2)
		if !ok {
			continue
		}
		current := byDate[date]
		if current == nil {
			current = &usecase.GeoTrafficDailyPoint{Date: date}
			byDate[date] = current
		}
		current.Sessions += metricInt(row, 0)
		current.EngagedSessions += metricInt(row, 1)
		current.Conversions = round2(current.Conversions + metricFloat(row, 2))
	}
	out := make([]usecase.GeoTrafficDailyPoint, 0, len(byDate))
	for _, item := range byDate {
		out = append(out, *item)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].Date < out[j].Date
	})
	return out
}

func buildGeoTrafficSummary(totalSessions int64, sources []usecase.GeoTrafficSource) usecase.GeoTrafficSummary {
	var geoSessions int64
	var engagedSessions int64
	var pageViews int64
	var conversions float64
	var weightedDuration float64
	var weightedBounce float64
	byEngine := make(map[string]int64)

	for _, source := range sources {
		geoSessions += source.Sessions
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
	if geoSessions > 0 {
		avgDuration = weightedDuration / float64(geoSessions)
		bounceRate = weightedBounce / float64(geoSessions)
	}

	return usecase.GeoTrafficSummary{
		TotalGeoSessions:     geoSessions,
		TotalSessions:        totalSessions,
		GeoShareOfTotal:      round2(percentFloat(geoSessions, totalSessions)),
		GeoEngagedSessions:   engagedSessions,
		GeoEngagementRate:    round2(percentFloat(engagedSessions, geoSessions)),
		GeoAvgSessionSeconds: round2(avgDuration),
		GeoBounceRate:        round2(bounceRate),
		GeoConversions:       round2(conversions),
		GeoConversionRate:    round2(percentFloatFloat(conversions, geoSessions)),
		GeoPageViews:         pageViews,
		TopEngine:            topEngine,
	}
}

func convertPropertyQuota(quota *ga4PropertyQuota) *usecase.GeoPropertyQuota {
	if quota == nil {
		return nil
	}
	return &usecase.GeoPropertyQuota{
		TokensPerDay: usecase.GeoQuotaStatus{
			Consumed:  quota.TokensPerDay.Consumed,
			Remaining: quota.TokensPerDay.Remaining,
		},
		ServerErrorsPerProjectPerHour: usecase.GeoQuotaStatus{
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
	ProjectID                string                         `json:"projectId"`
	PropertyID               string                         `json:"propertyId"`
	DateRange                ga4TrafficLogDateRange         `json:"dateRange"`
	Filters                  ga4TrafficLogFilters           `json:"filters,omitempty"`
	RawRows                  map[string]int                 `json:"rawRows"`
	RawTotalRowsPreview      []ga4TrafficLogRawRow          `json:"rawTotalRowsPreview"`
	RawSourceRowsPreview     []ga4TrafficLogRawRow          `json:"rawSourceRowsPreview"`
	RawTopPageRowsPreview    []ga4TrafficLogRawRow          `json:"rawTopPageRowsPreview"`
	RawTimeseriesRowsPreview []ga4TrafficLogRawRow          `json:"rawTimeseriesRowsPreview"`
	Summary                  usecase.GeoTrafficSummary      `json:"summary"`
	BySourcePreview          []usecase.GeoTrafficSource     `json:"bySourcePreview"`
	TopPagesPreview          []usecase.GeoTrafficPage       `json:"topPagesPreview"`
	TimeseriesCount          int                            `json:"timeseriesCount"`
	TimeseriesHead           []usecase.GeoTrafficDailyPoint `json:"timeseriesHead"`
}

func logGA4TrafficAPIData(
	project usecase.ProjectMetadata,
	from,
	to time.Time,
	filters usecase.GeoTrafficFilters,
	totalResponse,
	sourceResponse,
	pageResponse,
	timeseriesResponse ga4RunReportResponse,
	report usecase.GeoTrafficReport,
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
	filters usecase.GeoTrafficFilters,
	totalResponse,
	sourceResponse,
	pageResponse,
	timeseriesResponse ga4RunReportResponse,
	report usecase.GeoTrafficReport,
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
		BySourcePreview:          firstGeoSources(report.BySource, 5),
		TopPagesPreview:          firstGeoPages(report.TopPages, 5),
		TimeseriesCount:          len(report.Timeseries),
		TimeseriesHead:           firstGeoDailyPoints(report.Timeseries, 5),
	}
}

func shouldUseFakeGeoTrafficReport(report usecase.GeoTrafficReport) bool {
	return len(report.BySource) == 0 && len(report.TopPages) == 0 && len(report.Timeseries) == 0
}

func buildFakeGeoTrafficReport(base usecase.GeoTrafficReport, from, to time.Time) usecase.GeoTrafficReport {
	report := base
	report.DataSource = usecase.GeoTrafficDataSourceFake
	if report.DateRange.StartDate == "" {
		report.DateRange.StartDate = from.UTC().Format("2006-01-02")
	}
	if report.DateRange.EndDate == "" {
		report.DateRange.EndDate = to.UTC().Format("2006-01-02")
	}
	if strings.TrimSpace(report.GeneratedAt) == "" {
		report.GeneratedAt = time.Now().UTC().Format(time.RFC3339)
	}

	report.BySource = []usecase.GeoTrafficSource{
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
	}
	geoSessions := int64(0)
	for _, source := range report.BySource {
		geoSessions += source.Sessions
	}
	for i := range report.BySource {
		report.BySource[i].ShareOfGeoSessions = round2(percentFloat(report.BySource[i].Sessions, geoSessions))
	}

	totalSessions := report.Summary.TotalSessions
	if totalSessions < geoSessions {
		totalSessions = geoSessions * 8
	}
	report.Summary = buildGeoTrafficSummary(totalSessions, report.BySource)
	report.TopPages = []usecase.GeoTrafficPage{
		{Path: "/", Title: "Home", Source: "chatgpt.com", Engine: "ChatGPT", Sessions: 38, EngagedSessions: 31, EngagementRate: 81.58, Conversions: 4, PageViews: 97},
		{Path: "/pricing", Title: "Pricing", Source: "perplexity.ai", Engine: "Perplexity", Sessions: 24, EngagedSessions: 19, EngagementRate: 79.17, Conversions: 3, PageViews: 58},
		{Path: "/blog/ai-search", Title: "AI Search Guide", Source: "chatgpt.com", Engine: "ChatGPT", Sessions: 21, EngagedSessions: 16, EngagementRate: 76.19, Conversions: 1, PageViews: 49},
		{Path: "/features", Title: "Features", Source: "gemini.google.com", Engine: "Gemini", Sessions: 17, EngagedSessions: 12, EngagementRate: 70.59, Conversions: 1, PageViews: 40},
		{Path: "/contact", Title: "Contact", Source: "claude.ai", Engine: "Claude", Sessions: 11, EngagedSessions: 9, EngagementRate: 81.82, Conversions: 2, PageViews: 24},
	}
	report.Timeseries = buildFakeGeoTimeseries(from, to)
	return report
}

func buildFakeGeoTimeseries(from, to time.Time) []usecase.GeoTrafficDailyPoint {
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
	out := make([]usecase.GeoTrafficDailyPoint, 0, points)
	for i := 0; i < points; i++ {
		day := from.AddDate(0, 0, i*step)
		if day.After(to) || i == points-1 {
			day = to
		}
		sessions := int64(7 + ((i * 5) % 19))
		engaged := int64(math.Round(float64(sessions) * 0.76))
		out = append(out, usecase.GeoTrafficDailyPoint{
			Date:            day.Format("2006-01-02"),
			Sessions:        sessions,
			EngagedSessions: engaged,
			Conversions:     round2(float64((i%4)+1) * 0.45),
		})
	}
	return out
}

func firstGeoSources(items []usecase.GeoTrafficSource, limit int) []usecase.GeoTrafficSource {
	if len(items) <= limit {
		return items
	}
	return items[:limit]
}

func firstGeoPages(items []usecase.GeoTrafficPage, limit int) []usecase.GeoTrafficPage {
	if len(items) <= limit {
		return items
	}
	return items[:limit]
}

func firstGeoDailyPoints(items []usecase.GeoTrafficDailyPoint, limit int) []usecase.GeoTrafficDailyPoint {
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
