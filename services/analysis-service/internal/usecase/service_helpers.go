package usecase

import (
	"fmt"
	"math"
	"sort"
	"strings"
)

func (s *Service) promptRunsForRunLocked(runID string) []PromptRun {
	ids := s.promptRunsByRun[runID]
	out := make([]PromptRun, 0, len(ids))
	for _, id := range ids {
		if item, ok := s.promptRuns[id]; ok {
			out = append(out, copyPromptRun(item))
		}
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].CreatedAt.Before(out[j].CreatedAt)
	})
	return out
}

func (s *Service) promptRunsForProjectLocked(projectID string) []PromptRun {
	runIDs := s.runsByProject[projectID]
	if len(runIDs) == 0 {
		return []PromptRun{}
	}

	out := make([]PromptRun, 0)
	for _, runID := range runIDs {
		ids := s.promptRunsByRun[runID]
		for _, id := range ids {
			if item, ok := s.promptRuns[id]; ok {
				out = append(out, copyPromptRun(item))
			}
		}
	}

	sort.Slice(out, func(i, j int) bool {
		return out[i].CreatedAt.Before(out[j].CreatedAt)
	})
	return out
}

func (s *Service) responsesForRunLocked(runID string) []AIResponse {
	ids := s.responsesByRun[runID]
	out := make([]AIResponse, 0, len(ids))
	for _, id := range ids {
		if item, ok := s.responses[id]; ok {
			out = append(out, copyResponse(item))
		}
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].CreatedAt.Before(out[j].CreatedAt)
	})
	return out
}

func (s *Service) responsesForProjectLocked(projectID string) []AIResponse {
	runIDs := s.runsByProject[projectID]
	if len(runIDs) == 0 {
		return []AIResponse{}
	}

	out := make([]AIResponse, 0)
	for _, runID := range runIDs {
		ids := s.responsesByRun[runID]
		for _, id := range ids {
			if item, ok := s.responses[id]; ok {
				out = append(out, copyResponse(item))
			}
		}
	}

	sort.Slice(out, func(i, j int) bool {
		return out[i].CreatedAt.Before(out[j].CreatedAt)
	})
	return out
}

func (s *Service) calculateVisibilityScoreLocked(runID string) int {
	responses := s.responsesForRunLocked(runID)
	return calculateVisibilityScoreFromResponses(responses)
}

func calculateVisibilityScoreFromResponses(responses []AIResponse) int {
	if len(responses) == 0 {
		return 0
	}

	total := float64(len(responses))
	mentions := 0
	citations := 0
	topPositions := 0
	for _, response := range responses {
		if response.BrandMentioned {
			mentions++
		}
		if response.CitationFound {
			citations++
		}
		if response.BrandPosition == "top" {
			topPositions++
		}
	}

	score := (float64(mentions)/total)*0.5 + (float64(citations)/total)*0.3 + (float64(topPositions)/total)*0.2
	return clampToPercent(score * 100)
}

func normalizeBrandPosition(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "top", "mid", "bottom":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "unknown"
	}
}

func normalizeSentiment(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "positive", "negative":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "neutral"
	}
}

func clampToPercent(value float64) int {
	if value < 0 {
		return 0
	}
	if value > 100 {
		return 100
	}
	return int(math.Round(value))
}

func filterResponsesByModelIDs(responses []AIResponse, modelIDs []string) []AIResponse {
	if len(responses) == 0 {
		return []AIResponse{}
	}
	if len(modelIDs) == 0 {
		return []AIResponse{}
	}

	allowed := make(map[string]struct{}, len(modelIDs))
	for _, modelID := range modelIDs {
		trimmed := strings.TrimSpace(modelID)
		if trimmed == "" {
			continue
		}
		allowed[trimmed] = struct{}{}
	}
	if len(allowed) == 0 {
		return []AIResponse{}
	}

	filtered := make([]AIResponse, 0, len(responses))
	for _, response := range responses {
		if _, ok := allowed[strings.TrimSpace(response.ModelID)]; !ok {
			continue
		}
		filtered = append(filtered, response)
	}

	return filtered
}

func removeID(items []string, target string) []string {
	if len(items) == 0 {
		return items
	}
	out := make([]string, 0, len(items))
	for _, item := range items {
		if item == target {
			continue
		}
		out = append(out, item)
	}
	return out
}

func (s *Service) nextID(prefix string) string {
	s.seq++
	return fmt.Sprintf("%s-%d", prefix, s.seq)
}

func copyAnalysisRun(run *AnalysisRun) AnalysisRun {
	if run == nil {
		return AnalysisRun{}
	}
	return *run
}

func copyPromptRun(run *PromptRun) PromptRun {
	if run == nil {
		return PromptRun{}
	}
	return *run
}

func copyResponse(response *AIResponse) AIResponse {
	if response == nil {
		return AIResponse{}
	}
	out := *response
	out.CitedURLs = append([]string(nil), response.CitedURLs...)
	return out
}

func copyAlert(alert *Alert) Alert {
	if alert == nil {
		return Alert{}
	}
	return *alert
}

func copyBrandCanon(canon *BrandCanon) BrandCanon {
	if canon == nil {
		return BrandCanon{}
	}
	out := *canon
	out.Audience = append([]string(nil), canon.Audience...)
	out.UseCases = append([]string(nil), canon.UseCases...)
	out.Features = append([]string(nil), canon.Features...)
	if canon.Pricing != nil {
		out.Pricing = make(map[string]any, len(canon.Pricing))
		for key, value := range canon.Pricing {
			out.Pricing[key] = value
		}
	}
	return out
}

func copyContentOptimizerCrawlResult(result ContentOptimizerCrawlResult) ContentOptimizerCrawlResult {
	out := result
	out.Records = append([]ContentOptimizerCrawlRecord(nil), result.Records...)
	return out
}

func copyContentOptimizerCrawlSnapshot(snapshot *ContentOptimizerCrawlSnapshot) ContentOptimizerCrawlSnapshot {
	if snapshot == nil {
		return ContentOptimizerCrawlSnapshot{}
	}
	out := *snapshot
	out.Result = copyContentOptimizerCrawlResult(snapshot.Result)
	return out
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func nonNilRunMap(input map[string]*AnalysisRun) map[string]*AnalysisRun {
	if input == nil {
		return make(map[string]*AnalysisRun)
	}
	return input
}

func nonNilPromptRunMap(input map[string]*PromptRun) map[string]*PromptRun {
	if input == nil {
		return make(map[string]*PromptRun)
	}
	return input
}

func nonNilResponseMap(input map[string]*AIResponse) map[string]*AIResponse {
	if input == nil {
		return make(map[string]*AIResponse)
	}
	return input
}

func nonNilAlertMap(input map[string]*Alert) map[string]*Alert {
	if input == nil {
		return make(map[string]*Alert)
	}
	return input
}

func nonNilBrandCanonMap(input map[string]*BrandCanon) map[string]*BrandCanon {
	if input == nil {
		return make(map[string]*BrandCanon)
	}
	out := make(map[string]*BrandCanon, len(input))
	for key, value := range input {
		clone := copyBrandCanon(value)
		out[key] = &clone
	}
	return out
}

func nonNilContentOptimizerCrawlMap(input map[string]*ContentOptimizerCrawlSnapshot) map[string]*ContentOptimizerCrawlSnapshot {
	if input == nil {
		return make(map[string]*ContentOptimizerCrawlSnapshot)
	}
	out := make(map[string]*ContentOptimizerCrawlSnapshot, len(input))
	for key, value := range input {
		clone := copyContentOptimizerCrawlSnapshot(value)
		out[key] = &clone
	}
	return out
}

func nonNilSliceMap(input map[string][]string) map[string][]string {
	if input == nil {
		return make(map[string][]string)
	}
	out := make(map[string][]string, len(input))
	for key, values := range input {
		out[key] = append([]string(nil), values...)
	}
	return out
}

func nonNilIndexMap(input map[string]map[string]string) map[string]map[string]string {
	if input == nil {
		return make(map[string]map[string]string)
	}
	out := make(map[string]map[string]string, len(input))
	for runID, entries := range input {
		copied := make(map[string]string, len(entries))
		for key, value := range entries {
			copied[key] = value
		}
		out[runID] = copied
	}
	return out
}

func nonNilRunByRequestMap(input map[string]string) map[string]string {
	if input == nil {
		return make(map[string]string)
	}
	out := make(map[string]string, len(input))
	for key, value := range input {
		out[key] = value
	}
	return out
}
