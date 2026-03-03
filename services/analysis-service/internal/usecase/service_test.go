package usecase

import (
	"context"
	"testing"
)

func TestStartAnalysisCreatesRun(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	result, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		UserID:    "user-1",
		ProjectID: "project-1",
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
		UserID:    "user-1",
		ProjectID: "project-1",
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

	details, err := svc.GetAnalysisRun(ctx, started.AnalysisRun.ID, "user-1")
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

	details, err = svc.GetAnalysisRun(ctx, started.AnalysisRun.ID, "user-1")
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
		UserID:    "user-1",
		ProjectID: "project-1",
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

	dashboard, err := svc.GetDashboard(ctx, "project-1", "user-1")
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

func TestAlertsReadAll(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	_, err := svc.CreateAlert(ctx, "project-1", "user-1", CreateAlertInput{
		AlertType:   "pricing_hallucination",
		Severity:    "high",
		Title:       "Pricing incoherent",
		Description: "Des reponses surestiment les prix",
	})
	if err != nil {
		t.Fatalf("create alert: %v", err)
	}

	if err := svc.MarkAllAlertsRead(ctx, "project-1", "user-1"); err != nil {
		t.Fatalf("mark all alerts read: %v", err)
	}

	alerts, err := svc.ListAlerts(ctx, "project-1", "user-1", true)
	if err != nil {
		t.Fatalf("list alerts: %v", err)
	}
	if len(alerts) != 0 {
		t.Fatalf("expected 0 unread alerts, got %d", len(alerts))
	}
}
