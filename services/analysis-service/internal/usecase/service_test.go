package usecase

import (
	"context"
	"encoding/json"
	"testing"
	"time"
)

type mutableAnalysisStore struct {
	payload []byte
}

type staticProjectCompetitorsProvider struct {
	competitors []string
}

func (p staticProjectCompetitorsProvider) ListProjectCompetitors(_ context.Context, _ string, _ int64) ([]string, error) {
	return append([]string(nil), p.competitors...), nil
}

type staticProjectModelsProvider struct {
	modelIDs []string
}

func (p staticProjectModelsProvider) ListProjectEnabledModels(_ context.Context, _ string, _ int64) ([]string, error) {
	return append([]string(nil), p.modelIDs...), nil
}

func (s *mutableAnalysisStore) Load(_ context.Context) ([]byte, bool, error) {
	if s.payload == nil {
		return nil, false, nil
	}
	return append([]byte(nil), s.payload...), true, nil
}

func (s *mutableAnalysisStore) Save(_ context.Context, payload []byte) error {
	s.payload = append([]byte(nil), payload...)
	return nil
}

func TestStartAnalysisCreatesRun(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	result, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "prompt-1", Text: "Alternative Notion 2026"},
			{ID: "prompt-2", Text: "Comparer Acme vs HubSpot"},
		},
		ModelIDs: []string{"gpt-4o-mini", "sonar"},
		RunType:  "manual",
	})
	if err != nil {
		t.Fatalf("start analysis: %v", err)
	}
	if len(result.PromptRuns) != 2 {
		t.Fatalf("expected 2 prompt runs, got %d", len(result.PromptRuns))
	}
	if result.AnalysisRun.Status != "running" {
		t.Fatalf("expected running status, got %q", result.AnalysisRun.Status)
	}
	if result.AnalysisRun.ExpectedResponses != 4 {
		t.Fatalf("expected 4 expected responses, got %d", result.AnalysisRun.ExpectedResponses)
	}
}

func TestRunCompletionAndDeduplication(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	started, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "prompt-1", Text: "Quel CRM pour PME ?"},
		},
		ModelIDs: []string{"gpt-4o-mini", "gemini-2.0-flash"},
		RunType:  "manual",
	})
	if err != nil {
		t.Fatalf("start analysis: %v", err)
	}

	promptRun := started.PromptRuns[0]
	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          started.AnalysisRun.ID,
		PromptRunID:    promptRun.ID,
		ModelID:        "gpt-4o-mini",
		RawResponse:    "Acme est excellent https://acme.com/pricing",
		BrandMentioned: true,
		BrandPosition:  "top",
		CitationFound:  true,
		CitedURLs:      []string{"https://acme.com/pricing"},
		Sentiment:      "positive",
	}); err != nil {
		t.Fatalf("record response #1: %v", err)
	}

	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          started.AnalysisRun.ID,
		PromptRunID:    promptRun.ID,
		ModelID:        "gpt-4o-mini",
		RawResponse:    "Acme reste recommande https://acme.com/features",
		BrandMentioned: true,
		BrandPosition:  "top",
		CitationFound:  true,
		CitedURLs:      []string{"https://acme.com/features"},
		Sentiment:      "positive",
	}); err != nil {
		t.Fatalf("record response duplicate: %v", err)
	}

	details, err := svc.GetAnalysisRun(ctx, started.AnalysisRun.ID, 42)
	if err != nil {
		t.Fatalf("get analysis run after first model: %v", err)
	}
	if details.AnalysisRun.CompletedResponses != 1 {
		t.Fatalf("expected completed responses to stay at 1, got %d", details.AnalysisRun.CompletedResponses)
	}
	if details.AnalysisRun.Status != "running" {
		t.Fatalf("expected running status, got %q", details.AnalysisRun.Status)
	}

	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          started.AnalysisRun.ID,
		PromptRunID:    promptRun.ID,
		ModelID:        "gemini-2.0-flash",
		RawResponse:    "Acme est top https://acme.com",
		BrandMentioned: true,
		BrandPosition:  "top",
		CitationFound:  true,
		CitedURLs:      []string{"https://acme.com"},
		Sentiment:      "positive",
	}); err != nil {
		t.Fatalf("record response #2: %v", err)
	}

	details, err = svc.GetAnalysisRun(ctx, started.AnalysisRun.ID, 42)
	if err != nil {
		t.Fatalf("get analysis run after completion: %v", err)
	}
	if details.AnalysisRun.CompletedResponses != 2 {
		t.Fatalf("expected completed responses 2, got %d", details.AnalysisRun.CompletedResponses)
	}
	if details.AnalysisRun.Status != "completed" {
		t.Fatalf("expected completed status, got %q", details.AnalysisRun.Status)
	}
}

func TestDashboardVisibilityScore(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	started, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "prompt-1", Text: "Quel CRM pour PME ?"},
		},
		ModelIDs: []string{"gpt-4o-mini"},
		RunType:  "manual",
	})
	if err != nil {
		t.Fatalf("start analysis: %v", err)
	}

	for _, promptRun := range started.PromptRuns {
		if err := svc.RecordResponse(ctx, ResponseInput{
			RunID:          started.AnalysisRun.ID,
			PromptRunID:    promptRun.ID,
			ModelID:        "gpt-4o-mini",
			RawResponse:    "Acme est excellent https://acme.com/pricing",
			BrandMentioned: true,
			BrandPosition:  "top",
			CitationFound:  true,
			CitedURLs:      []string{"https://acme.com/pricing"},
			Sentiment:      "positive",
		}); err != nil {
			t.Fatalf("record response: %v", err)
		}
	}

	dashboard, err := svc.GetDashboard(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get dashboard: %v", err)
	}
	if !dashboard.HasData {
		t.Fatalf("expected dashboard to have data")
	}
	if dashboard.VisibilityScore <= 0 {
		t.Fatalf("expected positive visibility score, got %d", dashboard.VisibilityScore)
	}
}

func TestGetDashboardAggregatesAllProjectRuns(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	first, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "prompt-1", Text: "Compare Nike and Puma"},
		},
		ModelIDs: []string{"gpt-4o-mini"},
		RunType:  "manual",
	})
	if err != nil {
		t.Fatalf("start first analysis: %v", err)
	}

	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          first.AnalysisRun.ID,
		PromptRunID:    first.PromptRuns[0].ID,
		ModelID:        "gpt-4o-mini",
		RawResponse:    "Nike leads Puma with citations",
		BrandMentioned: true,
		BrandPosition:  "top",
		CitationFound:  true,
		CitedURLs:      []string{"https://nike.com/innovation"},
		Sentiment:      "positive",
	}); err != nil {
		t.Fatalf("record first response: %v", err)
	}

	second, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "prompt-2", Text: "Compare Nike and Adidas"},
		},
		ModelIDs: []string{"gpt-4o-mini"},
		RunType:  "manual",
	})
	if err != nil {
		t.Fatalf("start second analysis: %v", err)
	}

	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          second.AnalysisRun.ID,
		PromptRunID:    second.PromptRuns[0].ID,
		ModelID:        "gpt-4o-mini",
		RawResponse:    "Nike is mentioned without source",
		BrandMentioned: true,
		BrandPosition:  "mid",
		CitationFound:  false,
		CitedURLs:      nil,
		Sentiment:      "neutral",
	}); err != nil {
		t.Fatalf("record second response: %v", err)
	}

	dashboard, err := svc.GetDashboard(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get dashboard: %v", err)
	}

	if dashboard.LatestRun == nil || dashboard.LatestRun.ID != second.AnalysisRun.ID {
		t.Fatalf("expected latest run %s, got %+v", second.AnalysisRun.ID, dashboard.LatestRun)
	}
	if len(dashboard.PromptRuns) != 2 {
		t.Fatalf("expected 2 prompt runs, got %d", len(dashboard.PromptRuns))
	}
	if len(dashboard.Responses) != 2 {
		t.Fatalf("expected 2 responses, got %d", len(dashboard.Responses))
	}
	if dashboard.Responses[0].RunID != first.AnalysisRun.ID {
		t.Fatalf("expected first response from first run, got %s", dashboard.Responses[0].RunID)
	}
	if dashboard.Responses[1].RunID != second.AnalysisRun.ID {
		t.Fatalf("expected second response from second run, got %s", dashboard.Responses[1].RunID)
	}
	if dashboard.VisibilityScore <= 0 || dashboard.VisibilityScore >= 100 {
		t.Fatalf("expected aggregated visibility score between 1 and 99, got %d", dashboard.VisibilityScore)
	}
}

func TestUpdateBrandCanonPersistsAndNormalizesLists(t *testing.T) {
	store := &mutableAnalysisStore{}
	ctx := context.Background()

	svc, err := NewServiceWithDependencies(ctx, Dependencies{Store: store})
	if err != nil {
		t.Fatalf("new service with store: %v", err)
	}

	brandName := " Acme "
	category := " CRM "
	positioning := " CRM simple pour PME "
	audience := []string{"PME", " PME ", "", "Direction commerciale"}
	useCases := []string{"Prospection", "prospection", "Pilotage"}
	features := []string{"Automatisation", "automatisation", "Reporting"}
	pricing := map[string]any{"plan": "pro", "amount": 49}

	updated, err := svc.UpdateBrandCanon(ctx, "project-1", 42, UpdateBrandCanonInput{
		BrandName:   &brandName,
		Category:    &category,
		Positioning: &positioning,
		Audience:    &audience,
		UseCases:    &useCases,
		Features:    &features,
		Pricing:     &pricing,
	})
	if err != nil {
		t.Fatalf("update brand canon: %v", err)
	}

	if updated.BrandName != "Acme" {
		t.Fatalf("expected trimmed brand name, got %q", updated.BrandName)
	}
	if updated.Category != "CRM" {
		t.Fatalf("expected trimmed category, got %q", updated.Category)
	}
	if len(updated.Audience) != 2 {
		t.Fatalf("expected 2 normalized audience items, got %v", updated.Audience)
	}
	if len(updated.UseCases) != 2 {
		t.Fatalf("expected 2 normalized use cases, got %v", updated.UseCases)
	}
	if len(updated.Features) != 2 {
		t.Fatalf("expected 2 normalized features, got %v", updated.Features)
	}

	reloaded, err := NewServiceWithDependencies(ctx, Dependencies{Store: store})
	if err != nil {
		t.Fatalf("reload service with store: %v", err)
	}

	canon, err := reloaded.GetBrandCanon(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get brand canon after reload: %v", err)
	}
	if canon.BrandName != "Acme" {
		t.Fatalf("expected persisted brand name, got %q", canon.BrandName)
	}
	if got := canon.Pricing["plan"]; got != "pro" {
		t.Fatalf("expected persisted pricing plan, got %#v", got)
	}
}

func TestGetPerceptionIncludesBrandCanon(t *testing.T) {
	ctx := context.Background()
	svc := NewService()

	brandName := "Acme"
	category := "CRM"
	positioning := "CRM pour PME"
	audience := []string{"PME"}
	useCases := []string{"Prospection"}
	features := []string{"Automatisation"}

	if _, err := svc.UpdateBrandCanon(ctx, "project-1", 42, UpdateBrandCanonInput{
		BrandName:   &brandName,
		Category:    &category,
		Positioning: &positioning,
		Audience:    &audience,
		UseCases:    &useCases,
		Features:    &features,
	}); err != nil {
		t.Fatalf("seed brand canon: %v", err)
	}

	perception, err := svc.GetPerception(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get perception: %v", err)
	}
	if perception.BrandCanon.BrandName != "Acme" {
		t.Fatalf("expected brand canon in perception response, got %+v", perception.BrandCanon)
	}
	if len(perception.BrandCanon.Audience) != 1 || perception.BrandCanon.Audience[0] != "PME" {
		t.Fatalf("expected audience in perception response, got %+v", perception.BrandCanon.Audience)
	}
}

func TestGetPerceptionDerivesRadarAndTopErrorsFromResponses(t *testing.T) {
	ctx := context.Background()
	svc := NewService()

	brandName := "Acme"
	category := "CRM"
	positioning := "CRM simple pour PME de services"
	useCases := []string{"Prospection", "Suivi commercial"}
	features := []string{"Automatisation", "Reporting"}

	if _, err := svc.UpdateBrandCanon(ctx, "project-1", 42, UpdateBrandCanonInput{
		BrandName:   &brandName,
		Category:    &category,
		Positioning: &positioning,
		UseCases:    &useCases,
		Features:    &features,
	}); err != nil {
		t.Fatalf("seed brand canon: %v", err)
	}

	started, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "prompt-1", Text: "Quel CRM pour PME ?"},
		},
		ModelIDs: []string{"gpt-4o-mini", "sonar"},
		RunType:  "manual",
	})
	if err != nil {
		t.Fatalf("start analysis: %v", err)
	}

	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          started.AnalysisRun.ID,
		PromptRunID:    started.PromptRuns[0].ID,
		ModelID:        "gpt-4o-mini",
		RawResponse:    "Acme est un CRM simple pour PME avec automatisation et reporting. Source: https://acme.com/crm",
		BrandMentioned: true,
		BrandPosition:  "top",
		CitationFound:  true,
		CitedURLs:      []string{"https://acme.com/crm"},
		Sentiment:      "positive",
	}); err != nil {
		t.Fatalf("record first response: %v", err)
	}

	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          started.AnalysisRun.ID,
		PromptRunID:    started.PromptRuns[0].ID,
		ModelID:        "sonar",
		RawResponse:    "Acme existe pour les PME, mais la reponse reste vague et sans source claire.",
		BrandMentioned: true,
		BrandPosition:  "mid",
		CitationFound:  false,
		CitedURLs:      nil,
		Sentiment:      "neutral",
	}); err != nil {
		t.Fatalf("record second response: %v", err)
	}

	perception, err := svc.GetPerception(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get perception: %v", err)
	}

	payload, err := json.Marshal(perception)
	if err != nil {
		t.Fatalf("marshal perception: %v", err)
	}

	var decoded map[string]any
	if err := json.Unmarshal(payload, &decoded); err != nil {
		t.Fatalf("decode perception json: %v", err)
	}

	radar, ok := decoded["radar"].([]any)
	if !ok || len(radar) == 0 {
		t.Fatalf("expected non-empty radar payload, got %#v", decoded["radar"])
	}

	topErrors, ok := decoded["topErrors"].([]any)
	if !ok || len(topErrors) == 0 {
		t.Fatalf("expected non-empty top errors payload, got %#v", decoded["topErrors"])
	}

	metadata, ok := decoded["metadata"].(map[string]any)
	if !ok {
		t.Fatalf("expected metadata map, got %#v", decoded["metadata"])
	}
	if metadata["latestRunId"] != started.AnalysisRun.ID {
		t.Fatalf("expected latestRunId %s, got %#v", started.AnalysisRun.ID, metadata["latestRunId"])
	}

	models, ok := metadata["models"].([]any)
	if !ok || len(models) != 2 {
		t.Fatalf("expected 2 models in metadata, got %#v", metadata["models"])
	}
	if metadata["responses"] != float64(2) {
		t.Fatalf("expected metadata responses 2, got %#v", metadata["responses"])
	}
}

func TestGetPerceptionUsesProjectCompetitorsForCompetitiveAxis(t *testing.T) {
	ctx := context.Background()
	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		ProjectCompetitors: staticProjectCompetitorsProvider{competitors: []string{"HubSpot", "Salesforce"}},
	})
	if err != nil {
		t.Fatalf("new service with dependencies: %v", err)
	}

	brandName := "Acme"
	category := "CRM"
	positioning := "CRM simple pour PME"
	useCases := []string{"Prospection"}
	features := []string{"Automatisation", "Reporting"}

	if _, err := svc.UpdateBrandCanon(ctx, "project-1", 42, UpdateBrandCanonInput{
		BrandName:   &brandName,
		Category:    &category,
		Positioning: &positioning,
		UseCases:    &useCases,
		Features:    &features,
	}); err != nil {
		t.Fatalf("seed brand canon: %v", err)
	}

	started, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "prompt-1", Text: "Quel CRM pour PME ?"},
		},
		ModelIDs: []string{"gpt-4o-mini"},
		RunType:  "manual",
	})
	if err != nil {
		t.Fatalf("start analysis: %v", err)
	}

	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          started.AnalysisRun.ID,
		PromptRunID:    started.PromptRuns[0].ID,
		ModelID:        "gpt-4o-mini",
		RawResponse:    "HubSpot reste la meilleure option pour les PME. Acme est un CRM avec automatisation et reporting, mais reste derriere HubSpot. Source: https://acme.com/crm",
		BrandMentioned: true,
		BrandPosition:  "top",
		CitationFound:  true,
		CitedURLs:      []string{"https://acme.com/crm"},
		Sentiment:      "positive",
	}); err != nil {
		t.Fatalf("record response: %v", err)
	}

	perception, err := svc.GetPerception(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get perception: %v", err)
	}

	var competitorsScore int
	for _, point := range perception.Radar {
		if point.Axis == "competitors" {
			competitorsScore = point.Score
			break
		}
	}

	if competitorsScore == 0 {
		t.Fatalf("expected competitors score to be present, got %#v", perception.Radar)
	}
	if competitorsScore >= 60 {
		t.Fatalf("expected competitors score below 60 when a real competitor dominates the answer, got %d", competitorsScore)
	}

	foundCompetitiveGap := false
	for _, item := range perception.TopErrors {
		if item.Type == "competitive_gap" {
			foundCompetitiveGap = true
			break
		}
	}
	if !foundCompetitiveGap {
		t.Fatalf("expected competitive_gap to be surfaced, got %#v", perception.TopErrors)
	}
}

func TestGetPerceptionFiltersResponsesToCurrentProjectModels(t *testing.T) {
	ctx := context.Background()
	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		ProjectModels: staticProjectModelsProvider{modelIDs: []string{"gpt-4o-mini"}},
	})
	if err != nil {
		t.Fatalf("new service with dependencies: %v", err)
	}

	brandName := "Acme"
	category := "CRM"
	positioning := "CRM simple pour PME"
	useCases := []string{"Prospection"}
	features := []string{"Automatisation"}

	if _, err := svc.UpdateBrandCanon(ctx, "project-1", 42, UpdateBrandCanonInput{
		BrandName:   &brandName,
		Category:    &category,
		Positioning: &positioning,
		UseCases:    &useCases,
		Features:    &features,
	}); err != nil {
		t.Fatalf("seed brand canon: %v", err)
	}

	started, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "prompt-1", Text: "Quel CRM pour PME ?"},
		},
		ModelIDs: []string{"gpt-4o-mini", "sonar"},
		RunType:  "manual",
	})
	if err != nil {
		t.Fatalf("start analysis: %v", err)
	}

	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          started.AnalysisRun.ID,
		PromptRunID:    started.PromptRuns[0].ID,
		ModelID:        "gpt-4o-mini",
		RawResponse:    "Acme est un CRM simple pour PME avec automatisation. Source: https://acme.com/crm",
		BrandMentioned: true,
		BrandPosition:  "top",
		CitationFound:  true,
		CitedURLs:      []string{"https://acme.com/crm"},
		Sentiment:      "positive",
	}); err != nil {
		t.Fatalf("record enabled model response: %v", err)
	}

	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          started.AnalysisRun.ID,
		PromptRunID:    started.PromptRuns[0].ID,
		ModelID:        "sonar",
		RawResponse:    "Acme est rarement recommandee et reste derriere HubSpot.",
		BrandMentioned: true,
		BrandPosition:  "bottom",
		CitationFound:  false,
		CitedURLs:      nil,
		Sentiment:      "negative",
	}); err != nil {
		t.Fatalf("record disabled model response: %v", err)
	}

	perception, err := svc.GetPerception(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get perception: %v", err)
	}

	if perception.Scores.SentimentScore != 100 {
		t.Fatalf("expected only the enabled project model to contribute to sentiment score, got %d", perception.Scores.SentimentScore)
	}
	if got := perception.Metadata["responses"]; got != 1 {
		t.Fatalf("expected 1 filtered response, got %#v", got)
	}
	if got := perception.Metadata["projectModels"]; got == nil {
		t.Fatalf("expected projectModels metadata to be populated")
	}
	models, ok := perception.Metadata["models"].([]string)
	if !ok || len(models) != 1 || models[0] != "gpt-4o-mini" {
		t.Fatalf("expected filtered metadata models to only include gpt-4o-mini, got %#v", perception.Metadata["models"])
	}
}

func TestAlertsReadAll(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	_, err := svc.CreateAlert(ctx, "project-1", 42, CreateAlertInput{
		AlertType:   "pricing_hallucination",
		Severity:    "high",
		Title:       "Pricing incoherent",
		Description: "Des reponses surestiment les prix",
	})
	if err != nil {
		t.Fatalf("create alert: %v", err)
	}

	if err := svc.MarkAllAlertsRead(ctx, "project-1", 42); err != nil {
		t.Fatalf("mark all alerts read: %v", err)
	}

	alerts, err := svc.ListAlerts(ctx, "project-1", 42, true)
	if err != nil {
		t.Fatalf("list alerts: %v", err)
	}
	if len(alerts) != 0 {
		t.Fatalf("expected 0 unread alerts, got %d", len(alerts))
	}
}

func TestGetDashboardReloadsStateFromStore(t *testing.T) {
	ctx := context.Background()
	store := &mutableAnalysisStore{}

	initialPayload, err := json.Marshal(persistedState{
		Runs:               map[string]*AnalysisRun{},
		RunsByProject:      map[string][]string{},
		PromptRuns:         map[string]*PromptRun{},
		PromptRunsByRun:    map[string][]string{},
		Responses:          map[string]*AIResponse{},
		ResponsesByRun:     map[string][]string{},
		ResponseIndexByRun: map[string]map[string]string{},
		RunByRequest:       map[string]string{},
		Alerts:             map[string]*Alert{},
		AlertsByProject:    map[string][]string{},
	})
	if err != nil {
		t.Fatalf("marshal initial state: %v", err)
	}
	store.payload = initialPayload

	svc, err := NewServiceWithDependencies(ctx, Dependencies{Store: store})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	now := time.Date(2026, 3, 7, 20, 0, 0, 0, time.UTC)
	updatedPayload, err := json.Marshal(persistedState{
		Seq: 1,
		Runs: map[string]*AnalysisRun{
			"seed-run-01": {
				ID:                 "seed-run-01",
				ProjectID:          "seed-demo-project",
				OrganizationID:     1,
				CreatedBy:          1,
				RunType:            "manual",
				Status:             "completed",
				PromptsCount:       1,
				ModelsCount:        1,
				ExpectedResponses:  1,
				CompletedResponses: 1,
				VisibilityScore:    88,
				CreatedAt:          now,
				UpdatedAt:          now,
			},
		},
		RunsByProject: map[string][]string{
			"seed-demo-project": {"seed-run-01"},
		},
		PromptRuns: map[string]*PromptRun{
			"seed-prun-01": {
				ID:         "seed-prun-01",
				RunID:      "seed-run-01",
				PromptID:   "seed-prompt-01",
				PromptText: "Quel CRM pour PME ?",
				CreatedAt:  now,
			},
		},
		PromptRunsByRun: map[string][]string{
			"seed-run-01": {"seed-prun-01"},
		},
		Responses: map[string]*AIResponse{
			"seed-resp-01": {
				ID:             "seed-resp-01",
				RunID:          "seed-run-01",
				PromptRunID:    "seed-prun-01",
				ModelID:        "gpt-4o",
				RawResponse:    "Seed Demo Project est pertinent.",
				BrandMentioned: true,
				BrandPosition:  "top",
				CitationFound:  true,
				CitedURLs:      []string{"https://seed-demo.local"},
				Sentiment:      "positive",
				CreatedAt:      now,
			},
		},
		ResponsesByRun: map[string][]string{
			"seed-run-01": {"seed-resp-01"},
		},
		ResponseIndexByRun: map[string]map[string]string{
			"seed-run-01": {"seed-prun-01|gpt-4o": "seed-resp-01"},
		},
		RunByRequest:    map[string]string{},
		Alerts:          map[string]*Alert{},
		AlertsByProject: map[string][]string{},
	})
	if err != nil {
		t.Fatalf("marshal updated state: %v", err)
	}
	store.payload = updatedPayload

	dashboard, err := svc.GetDashboard(ctx, "seed-demo-project", 1)
	if err != nil {
		t.Fatalf("get dashboard: %v", err)
	}
	if !dashboard.HasData {
		t.Fatalf("expected dashboard to have data after store update")
	}
	if dashboard.LatestRun == nil || dashboard.LatestRun.ID != "seed-run-01" {
		t.Fatalf("expected latest run seed-run-01, got %+v", dashboard.LatestRun)
	}
	if len(dashboard.Responses) != 1 {
		t.Fatalf("expected 1 response, got %d", len(dashboard.Responses))
	}
}
