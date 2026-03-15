package usecase

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
)

type perceptionScores struct {
	PositioningAccuracy int
	FactualAccuracy     int
	SentimentScore      int
}

func normalizeProjectReportTemplate(value, fallback string) string {
	return normalizeWhiteLabelTemplate(firstNonEmpty(value, fallback))
}

func normalizeProjectReportFrequency(value, fallback string) string {
	return normalizeWhiteLabelFrequency(firstNonEmpty(value, fallback))
}

func normalizeProjectReportLocale(value, fallback string) string {
	return normalizeWhiteLabelLocale(firstNonEmpty(value, fallback), "fr")
}

func normalizeProjectReportTimezone(value, fallback string) string {
	return firstNonEmpty(value, fallback, DefaultWhiteLabelTimezone)
}

func deriveProjectReportPeriodLabel(now time.Time, timezone string) string {
	location, err := time.LoadLocation(strings.TrimSpace(timezone))
	if err != nil {
		location = time.UTC
	}
	return now.In(location).Format("02 Jan 2006")
}

func deriveProjectReportPeriodKey(now time.Time, timezone, frequency string) string {
	location, err := time.LoadLocation(strings.TrimSpace(timezone))
	if err != nil {
		location = time.UTC
	}
	localNow := now.In(location)

	switch normalizeProjectReportFrequency(frequency, WhiteLabelFrequencyMonthly) {
	case WhiteLabelFrequencyWeekly:
		year, week := localNow.ISOWeek()
		return fmt.Sprintf("%04d-W%02d", year, week)
	case WhiteLabelFrequencyQuarterly:
		quarter := ((int(localNow.Month()) - 1) / 3) + 1
		return fmt.Sprintf("%04d-Q%d", localNow.Year(), quarter)
	default:
		return localNow.Format("2006-01")
	}
}

func deriveProjectReportTitle(project Project, template, periodLabel string) string {
	brand := extractProjectBrandName(project)
	switch template {
	case WhiteLabelTemplateBoard:
		return fmt.Sprintf("%s board report · %s", brand, periodLabel)
	case WhiteLabelTemplatePerformance:
		return fmt.Sprintf("%s performance digest · %s", brand, periodLabel)
	default:
		return fmt.Sprintf("%s executive report · %s", brand, periodLabel)
	}
}

func deriveProjectReportSummary(project Project, analytics ProjectReportAnalyticsData) string {
	visibilityScore, completedResponses, expectedResponses := extractDashboardMetrics(analytics.Dashboard)
	scores := extractPerceptionScores(analytics.Perception)
	brandName := extractProjectBrandName(project)

	return fmt.Sprintf(
		"%s reached %d/100 visibility with %d/%d completed responses. Positioning accuracy is %d%%, factual accuracy is %d%% and sentiment score is %d%%.",
		brandName,
		visibilityScore,
		completedResponses,
		expectedResponses,
		scores.PositioningAccuracy,
		scores.FactualAccuracy,
		scores.SentimentScore,
	)
}

func extractDashboardMetrics(dashboard map[string]any) (int, int, int) {
	visibilityScore := getAnyInt(dashboard, "visibilityScore")
	latestRun := getAnyMap(dashboard, "latestRun")
	completedResponses := getAnyInt(latestRun, "completedResponses")
	expectedResponses := getAnyInt(latestRun, "expectedResponses")
	return visibilityScore, completedResponses, expectedResponses
}

func extractPerceptionScores(perception map[string]any) perceptionScores {
	scores := getAnyMap(perception, "scores")
	return perceptionScores{
		PositioningAccuracy: getAnyInt(scores, "positioningAccuracy"),
		FactualAccuracy:     getAnyInt(scores, "factualAccuracy"),
		SentimentScore:      getAnyInt(scores, "sentimentScore"),
	}
}

func extractBrandName(report ProjectReport) string {
	if name := getAnyString(getAnyMap(report.Analytics.Perception, "brandCanon"), "brandName"); name != "" {
		return name
	}
	if name := strings.TrimSpace(report.WhiteLabel.Branding.PlatformName); name != "" {
		return name
	}
	return "Client report"
}

func extractProjectBrandName(project Project) string {
	if name := strings.TrimSpace(project.BrandName); name != "" {
		return name
	}
	if name := strings.TrimSpace(project.Name); name != "" {
		return name
	}
	return "Client report"
}

func sortedProjectReportIDs(items map[string]*ProjectReport) []string {
	ids := make([]string, 0, len(items))
	for id := range items {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool {
		left := items[ids[i]]
		right := items[ids[j]]
		if left == nil || right == nil {
			return ids[i] < ids[j]
		}
		if left.GeneratedAt.Equal(right.GeneratedAt) {
			return left.ID < right.ID
		}
		return left.GeneratedAt.Before(right.GeneratedAt)
	})
	return ids
}

func getAnyMap(source map[string]any, key string) map[string]any {
	if source == nil {
		return map[string]any{}
	}
	value, ok := source[key]
	if !ok {
		return map[string]any{}
	}
	out, ok := value.(map[string]any)
	if ok {
		return out
	}
	return map[string]any{}
}

func getAnyString(source map[string]any, key string) string {
	if source == nil {
		return ""
	}
	value, ok := source[key]
	if !ok {
		return ""
	}
	text, ok := value.(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(text)
}

func getAnyInt(source map[string]any, key string) int {
	if source == nil {
		return 0
	}
	value, ok := source[key]
	if !ok {
		return 0
	}
	switch typed := value.(type) {
	case int:
		return typed
	case int32:
		return int(typed)
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(typed))
		if err == nil {
			return parsed
		}
	}
	return 0
}
