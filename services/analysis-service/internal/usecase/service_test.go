package usecase

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
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

type staticBillingQuotaProvider struct {
	monthlyQuota int
}

func (p staticBillingQuotaProvider) GetMonthlyQuota(_ context.Context, _ int64) (int, bool, error) {
	if p.monthlyQuota <= 0 {
		return 0, false, nil
	}
	return p.monthlyQuota, true, nil
}

type staticBillingEntitlementsProvider struct {
	plan          string
	monthlyQuota  int
	allowAIBriefs bool
}

func (p staticBillingEntitlementsProvider) GetMonthlyQuota(_ context.Context, _ int64) (int, bool, error) {
	if p.monthlyQuota <= 0 {
		return 0, false, nil
	}
	return p.monthlyQuota, true, nil
}

func (p staticBillingEntitlementsProvider) GetOrganizationEntitlements(_ context.Context, _ int64) (BillingEntitlements, bool, error) {
	return BillingEntitlements{
		Plan:          p.plan,
		MonthlyQuota:  p.monthlyQuota,
		AllowAIBriefs: p.allowAIBriefs,
	}, true, nil
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
	if matched := regexp.MustCompile(`^run_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`).MatchString(result.AnalysisRun.ID); !matched {
		t.Fatalf("expected UUID-like run id, got %q", result.AnalysisRun.ID)
	}
	if matched := regexp.MustCompile(`^prun_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`).MatchString(result.PromptRuns[0].ID); !matched {
		t.Fatalf("expected UUID-like prompt run id, got %q", result.PromptRuns[0].ID)
	}
}

func TestListMissingAnalysisPromptIDsReturnsOnlyIncompletePerceptionPrompts(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	result, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "prompt-1", Text: "Describe Acme positioning", Kind: promptKindPerception},
			{ID: "prompt-2", Text: "Who is Acme for?", Kind: promptKindPerception},
			{ID: "prompt-3", Text: "Compare Acme with competitors", Kind: promptKindPerception},
		},
		ModelIDs: []string{"model-1"},
		RunType:  promptKindPerception,
	})
	if err != nil {
		t.Fatalf("start analysis: %v", err)
	}
	for _, promptRun := range result.PromptRuns[:2] {
		if err := svc.RecordResponse(ctx, ResponseInput{
			RunID:          result.AnalysisRun.ID,
			PromptRunID:    promptRun.ID,
			ModelID:        "model-1",
			RawResponse:    "Acme response",
			BrandMentioned: true,
			Sentiment:      "positive",
		}); err != nil {
			t.Fatalf("record response: %v", err)
		}
	}
	if _, err := svc.FailAnalysisRun(ctx, result.AnalysisRun.ID, 42); err != nil {
		t.Fatalf("fail analysis run: %v", err)
	}

	missing, err := svc.ListMissingAnalysisPromptIDs(
		ctx,
		"project-1",
		42,
		[]string{"prompt-1", "prompt-2", "prompt-3"},
		[]string{"model-1"},
		promptKindPerception,
	)
	if err != nil {
		t.Fatalf("list missing prompts: %v", err)
	}
	if len(missing) != 1 || missing[0] != "prompt-3" {
		t.Fatalf("expected only prompt-3 missing, got %#v", missing)
	}
}

func TestListAnalysisRunsMarksStalledRunningRunsFailed(t *testing.T) {
	svc := NewService()
	ctx := context.Background()
	startedAt := time.Date(2026, 6, 19, 10, 0, 0, 0, time.UTC)
	svc.now = func() time.Time { return startedAt }

	result, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "prompt-1", Text: "Describe Acme", Kind: promptKindPerception},
		},
		ModelIDs: []string{"model-1"},
		RunType:  promptKindPerception,
	})
	if err != nil {
		t.Fatalf("start analysis: %v", err)
	}

	svc.now = func() time.Time { return startedAt.Add(analysisRunStalledAfter + time.Minute) }
	runs, err := svc.ListAnalysisRuns(ctx, "project-1", 42, 5)
	if err != nil {
		t.Fatalf("list analysis runs: %v", err)
	}
	if len(runs) == 0 {
		t.Fatalf("expected analysis run")
	}
	if runs[0].ID != result.AnalysisRun.ID {
		t.Fatalf("expected run %q, got %q", result.AnalysisRun.ID, runs[0].ID)
	}
	if runs[0].Status != "failed" {
		t.Fatalf("expected stalled run to be failed, got %q", runs[0].Status)
	}
}

func TestStartAnalysisReusesFreshPerceptionRunForAWeek(t *testing.T) {
	svc := NewService()
	ctx := context.Background()
	now := time.Date(2026, time.May, 19, 9, 0, 0, 0, time.UTC)
	svc.now = func() time.Time { return now }

	first, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "perception-1", Text: "What is Acme?", Kind: "perception"},
		},
		ModelIDs: []string{"gpt-4o-mini"},
		RunType:  promptKindPerception,
	})
	if err != nil {
		t.Fatalf("start perception: %v", err)
	}

	now = now.AddDate(0, 0, 1)
	second, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "perception-2", Text: "Who is Acme for?", Kind: "perception"},
		},
		ModelIDs: []string{"sonar"},
		RunType:  promptKindPerception,
	})
	if err != nil {
		t.Fatalf("reuse perception: %v", err)
	}
	if second.AnalysisRun.ID != first.AnalysisRun.ID {
		t.Fatalf("expected fresh perception run %s to be reused, got %s", first.AnalysisRun.ID, second.AnalysisRun.ID)
	}

	now = now.AddDate(0, 0, 8)
	third, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "perception-3", Text: "How does Acme compare?", Kind: "perception"},
		},
		ModelIDs: []string{"gpt-4o-mini"},
		RunType:  promptKindPerception,
	})
	if err != nil {
		t.Fatalf("new weekly perception: %v", err)
	}
	if third.AnalysisRun.ID == first.AnalysisRun.ID {
		t.Fatalf("expected perception run older than a week not to be reused")
	}
}

func TestStartAnalysisForceCreatesNewPerceptionRun(t *testing.T) {
	svc := NewService()
	ctx := context.Background()
	now := time.Date(2026, time.May, 19, 9, 0, 0, 0, time.UTC)
	svc.now = func() time.Time { return now }

	first, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "perception-1", Text: "What is Acme?", Kind: "perception"},
		},
		ModelIDs:         []string{"gpt-4o-mini"},
		RequestedCredits: 30,
		RunType:          "manual",
	})
	if err != nil {
		t.Fatalf("start perception: %v", err)
	}
	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          first.AnalysisRun.ID,
		PromptRunID:    first.PromptRuns[0].ID,
		ModelID:        "gpt-4o-mini",
		RawResponse:    "Acme is a strong option.",
		BrandMentioned: true,
		Sentiment:      "positive",
	}); err != nil {
		t.Fatalf("record first perception response: %v", err)
	}

	forced, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "perception-2", Text: "Who is Acme for?", Kind: "perception"},
		},
		ModelIDs:         []string{"gpt-4o-mini"},
		RequestedCredits: 30,
		RunType:          "manual",
		Force:            true,
	})
	if err != nil {
		t.Fatalf("force perception: %v", err)
	}
	if forced.AnalysisRun.ID == first.AnalysisRun.ID {
		t.Fatalf("expected force perception to create a new run")
	}
	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          forced.AnalysisRun.ID,
		PromptRunID:    forced.PromptRuns[0].ID,
		ModelID:        "gpt-4o-mini",
		RawResponse:    "Acme serves marketing teams.",
		BrandMentioned: true,
		Sentiment:      "positive",
	}); err != nil {
		t.Fatalf("record forced perception response: %v", err)
	}
	if used := svc.currentMonthlyCreditUsageLocked(42, now); used != 60 {
		t.Fatalf("expected forced perception to consume credits again, got %d", used)
	}
}

func TestStartAnalysisDoesNotConsumeCreditsUntilResponsesSucceed(t *testing.T) {
	svc := NewService()
	ctx := context.Background()
	now := time.Date(2026, time.May, 19, 9, 0, 0, 0, time.UTC)
	svc.now = func() time.Time { return now }

	started, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID:     42,
		CreatedBy:          7,
		ProjectID:          "project-1",
		PromptTexts:        []PromptText{{ID: "prompt-1", Text: "What is Acme?"}},
		ModelIDs:           []string{"gpt-4o-mini", "claude-sonnet"},
		ModelCreditCostSum: 2,
		RunType:            "manual",
	})
	if err != nil {
		t.Fatalf("start analysis: %v", err)
	}
	if used := svc.currentMonthlyCreditUsageLocked(42, now); used != 0 {
		t.Fatalf("expected failed/pending analysis to consume 0 credits, got %d", used)
	}
	if reserved := svc.currentMonthlyReservedCreditUsageLocked(42, now); reserved != 2 {
		t.Fatalf("expected running analysis to reserve 2 credits, got %d", reserved)
	}

	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          started.AnalysisRun.ID,
		PromptRunID:    started.PromptRuns[0].ID,
		ModelID:        "gpt-4o-mini",
		RawResponse:    "Acme is mentioned.",
		BrandMentioned: true,
		Sentiment:      "positive",
	}); err != nil {
		t.Fatalf("record successful response: %v", err)
	}
	if used := svc.currentMonthlyCreditUsageLocked(42, now); used != 1 {
		t.Fatalf("expected one successful response to consume 1 credit, got %d", used)
	}
}

func TestStartAnalysisRejectsWhenMonthlyQuotaIsReached(t *testing.T) {
	ctx := context.Background()
	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		BillingQuota: staticBillingQuotaProvider{monthlyQuota: 2},
	})
	if err != nil {
		t.Fatalf("new service with dependencies: %v", err)
	}
	svc.now = func() time.Time {
		return time.Date(2026, time.April, 15, 10, 0, 0, 0, time.UTC)
	}

	for index := 0; index < 2; index++ {
		if _, err := svc.StartAnalysis(ctx, StartAnalysisInput{
			OrganizationID: 42,
			CreatedBy:      7,
			ProjectID:      "project-1",
			PromptTexts: []PromptText{
				{ID: "prompt-1", Text: "Quel CRM choisir ?"},
			},
			ModelIDs: []string{"gpt-4o-mini"},
			RunType:  "manual",
		}); err != nil {
			t.Fatalf("seed run %d: %v", index+1, err)
		}
	}

	_, err = svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "prompt-2", Text: "Comparer Acme et HubSpot"},
		},
		ModelIDs: []string{"gpt-4o-mini"},
		RunType:  "manual",
	})
	if err == nil {
		t.Fatal("expected quota error, got nil")
	}
	if !errors.Is(err, ErrQuotaExceeded) {
		t.Fatalf("expected ErrQuotaExceeded, got %v", err)
	}
}

func TestStartAnalysisConsumesCreditsFromModelCreditCostSum(t *testing.T) {
	ctx := context.Background()
	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		BillingQuota: staticBillingQuotaProvider{monthlyQuota: 3},
	})
	if err != nil {
		t.Fatalf("new service with dependencies: %v", err)
	}
	svc.now = func() time.Time {
		return time.Date(2026, time.April, 15, 10, 0, 0, 0, time.UTC)
	}

	_, err = svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID:     42,
		CreatedBy:          7,
		ProjectID:          "project-1",
		PromptTexts:        []PromptText{{ID: "prompt-1", Text: "Quel CRM choisir ?"}},
		ModelIDs:           []string{"claude-opus-4-5"},
		ModelCreditCostSum: 2,
		RunType:            "manual",
	})
	if err != nil {
		t.Fatalf("start first credit run: %v", err)
	}

	_, err = svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID:     42,
		CreatedBy:          7,
		ProjectID:          "project-1",
		PromptTexts:        []PromptText{{ID: "prompt-2", Text: "Comparer Acme et HubSpot"}},
		ModelIDs:           []string{"claude-opus-4-5"},
		ModelCreditCostSum: 2,
		RunType:            "manual",
	})
	if err == nil {
		t.Fatal("expected quota error, got nil")
	}
	if !errors.Is(err, ErrQuotaExceeded) {
		t.Fatalf("expected ErrQuotaExceeded, got %v", err)
	}
}

func TestStartAnalysisAllowsIdempotentReplayEvenWhenQuotaIsReached(t *testing.T) {
	ctx := context.Background()
	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		BillingQuota: staticBillingQuotaProvider{monthlyQuota: 1},
	})
	if err != nil {
		t.Fatalf("new service with dependencies: %v", err)
	}
	svc.now = func() time.Time {
		return time.Date(2026, time.April, 15, 10, 0, 0, 0, time.UTC)
	}

	first, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		RequestID:      "manual:project-1:prompt-1:gpt-4o-mini:2026-04-15T10:00:00Z",
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "prompt-1", Text: "Quel CRM choisir ?"},
		},
		ModelIDs: []string{"gpt-4o-mini"},
		RunType:  "manual",
	})
	if err != nil {
		t.Fatalf("start analysis: %v", err)
	}

	replayed, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		RequestID:      "manual:project-1:prompt-1:gpt-4o-mini:2026-04-15T10:00:00Z",
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "prompt-1", Text: "Quel CRM choisir ?"},
		},
		ModelIDs: []string{"gpt-4o-mini"},
		RunType:  "manual",
	})
	if err != nil {
		t.Fatalf("replay analysis: %v", err)
	}
	if replayed.AnalysisRun.ID != first.AnalysisRun.ID {
		t.Fatalf("expected replayed run id %s, got %s", first.AnalysisRun.ID, replayed.AnalysisRun.ID)
	}
}

func TestStartAnalysisQuotaResetsOnNextMonth(t *testing.T) {
	ctx := context.Background()
	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		BillingQuota: staticBillingQuotaProvider{monthlyQuota: 1},
	})
	if err != nil {
		t.Fatalf("new service with dependencies: %v", err)
	}

	currentTime := time.Date(2026, time.April, 30, 23, 0, 0, 0, time.UTC)
	svc.now = func() time.Time {
		return currentTime
	}

	if _, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "prompt-1", Text: "Quel CRM choisir ?"},
		},
		ModelIDs: []string{"gpt-4o-mini"},
		RunType:  "manual",
	}); err != nil {
		t.Fatalf("start first month run: %v", err)
	}

	currentTime = time.Date(2026, time.May, 1, 0, 5, 0, 0, time.UTC)
	if _, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "prompt-2", Text: "Comparer Acme et HubSpot"},
		},
		ModelIDs: []string{"gpt-4o-mini"},
		RunType:  "scheduled",
	}); err != nil {
		t.Fatalf("start next month run: %v", err)
	}
}

func TestGetPromptQuotaUsageReturnsCurrentMonthUsageAndQuota(t *testing.T) {
	ctx := context.Background()
	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		BillingQuota: staticBillingQuotaProvider{monthlyQuota: 3},
	})
	if err != nil {
		t.Fatalf("new service with dependencies: %v", err)
	}

	currentTime := time.Date(2026, time.April, 15, 10, 0, 0, 0, time.UTC)
	svc.now = func() time.Time {
		return currentTime
	}

	for index := 0; index < 2; index++ {
		started, err := svc.StartAnalysis(ctx, StartAnalysisInput{
			OrganizationID: 42,
			CreatedBy:      7,
			ProjectID:      "project-1",
			PromptTexts: []PromptText{
				{ID: "prompt-1", Text: "Quel CRM choisir ?"},
			},
			ModelIDs: []string{"gpt-4o-mini"},
			RunType:  "manual",
		})
		if err != nil {
			t.Fatalf("seed current month run %d: %v", index+1, err)
		}
		if err := svc.RecordResponse(ctx, ResponseInput{
			RunID:          started.AnalysisRun.ID,
			PromptRunID:    started.PromptRuns[0].ID,
			ModelID:        "gpt-4o-mini",
			RawResponse:    "Acme is mentioned.",
			BrandMentioned: true,
			Sentiment:      "positive",
		}); err != nil {
			t.Fatalf("record current month response %d: %v", index+1, err)
		}
	}

	currentTime = time.Date(2026, time.March, 31, 23, 0, 0, 0, time.UTC)
	if _, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "prompt-2", Text: "Comparer Acme et HubSpot"},
		},
		ModelIDs: []string{"gpt-4o-mini"},
		RunType:  "scheduled",
	}); err != nil {
		t.Fatalf("seed previous month run: %v", err)
	}

	currentTime = time.Date(2026, time.April, 15, 10, 5, 0, 0, time.UTC)
	usage, err := svc.GetPromptQuotaUsage(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get prompt quota usage: %v", err)
	}

	if !usage.HasQuota {
		t.Fatal("expected quota to be available")
	}
	if usage.MonthlyQuota != 3 {
		t.Fatalf("expected monthly quota 3, got %d", usage.MonthlyQuota)
	}
	if usage.UsedPrompts != 2 {
		t.Fatalf("expected used prompts 2, got %d", usage.UsedPrompts)
	}
	if usage.RemainingPrompts != 1 {
		t.Fatalf("expected remaining prompts 1, got %d", usage.RemainingPrompts)
	}
	if usage.IsLimitReached {
		t.Fatal("expected limit not reached")
	}
	if usage.CurrentMonth != "2026-04" {
		t.Fatalf("expected current month 2026-04, got %q", usage.CurrentMonth)
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

func TestGetDashboardExcludesPerceptionRuns(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	monitoring, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "monitoring-1", Text: "Best CRM for small teams", Kind: promptKindMonitoring},
		},
		ModelIDs: []string{"gpt-4o-mini"},
		RunType:  "manual",
	})
	if err != nil {
		t.Fatalf("start monitoring: %v", err)
	}
	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          monitoring.AnalysisRun.ID,
		PromptRunID:    monitoring.PromptRuns[0].ID,
		ModelID:        "gpt-4o-mini",
		RawResponse:    "Acme is mentioned for small teams",
		BrandMentioned: true,
		BrandPosition:  "top",
		Sentiment:      "positive",
	}); err != nil {
		t.Fatalf("record monitoring response: %v", err)
	}

	perception, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "perception-1", Text: "What is Acme?", Kind: promptKindPerception},
		},
		ModelIDs: []string{"gpt-4o-mini"},
		RunType:  promptKindPerception,
	})
	if err != nil {
		t.Fatalf("start perception: %v", err)
	}
	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          perception.AnalysisRun.ID,
		PromptRunID:    perception.PromptRuns[0].ID,
		ModelID:        "gpt-4o-mini",
		RawResponse:    "Acme has a clear positioning",
		BrandMentioned: true,
		BrandPosition:  "top",
		Sentiment:      "positive",
	}); err != nil {
		t.Fatalf("record perception response: %v", err)
	}

	dashboard, err := svc.GetDashboard(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get dashboard: %v", err)
	}
	if dashboard.LatestRun == nil || dashboard.LatestRun.ID != monitoring.AnalysisRun.ID {
		t.Fatalf("expected latest monitoring run %q, got %+v", monitoring.AnalysisRun.ID, dashboard.LatestRun)
	}
	if len(dashboard.PromptRuns) != 1 || dashboard.PromptRuns[0].Kind != promptKindMonitoring {
		t.Fatalf("expected only monitoring prompt runs, got %+v", dashboard.PromptRuns)
	}
	if len(dashboard.Responses) != 1 {
		t.Fatalf("expected only monitoring responses, got %+v", dashboard.Responses)
	}
	if dashboard.Responses[0].RunID != monitoring.AnalysisRun.ID {
		t.Fatalf("expected monitoring response, got %+v", dashboard.Responses[0])
	}
}

func TestDeleteResponseSoftDeletesAndFiltersDashboardAndPerception(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	monitoring, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "monitoring-1", Text: "Best CRM for small teams", Kind: promptKindMonitoring},
		},
		ModelIDs: []string{"gpt-4o-mini"},
		RunType:  "manual",
	})
	if err != nil {
		t.Fatalf("start monitoring: %v", err)
	}
	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          monitoring.AnalysisRun.ID,
		PromptRunID:    monitoring.PromptRuns[0].ID,
		ModelID:        "gpt-4o-mini",
		RawResponse:    "Acme is mentioned",
		BrandMentioned: true,
		BrandPosition:  "top",
		Sentiment:      "positive",
	}); err != nil {
		t.Fatalf("record monitoring response: %v", err)
	}

	dashboard, err := svc.GetDashboard(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get dashboard: %v", err)
	}
	if len(dashboard.Responses) != 1 {
		t.Fatalf("expected response before delete, got %+v", dashboard.Responses)
	}
	responseID := dashboard.Responses[0].ID

	if err := svc.DeleteResponse(ctx, responseID, 42); err != nil {
		t.Fatalf("delete response: %v", err)
	}
	if stored := svc.responses[responseID]; stored == nil || stored.DeletedAt == nil {
		t.Fatalf("expected response to stay stored with deletedAt, got %+v", stored)
	}

	dashboard, err = svc.GetDashboard(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get dashboard after delete: %v", err)
	}
	if len(dashboard.Responses) != 0 {
		t.Fatalf("expected deleted response to be filtered from dashboard, got %+v", dashboard.Responses)
	}

	perception, err := svc.GetPerception(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get perception after delete: %v", err)
	}
	if len(perception.Responses) != 0 {
		t.Fatalf("expected deleted response to be filtered from perception, got %+v", perception.Responses)
	}
}

func TestListAnalysisRunsDerivesPerceptionRunTypeFromPromptKind(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	started, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "perception-1", Text: "What is Acme?", Kind: promptKindPerception},
		},
		ModelIDs: []string{"gpt-4o-mini"},
		RunType:  "manual",
	})
	if err != nil {
		t.Fatalf("start perception-like manual run: %v", err)
	}

	runs, err := svc.ListAnalysisRuns(ctx, "project-1", 42, 10)
	if err != nil {
		t.Fatalf("list analysis runs: %v", err)
	}
	if len(runs) == 0 || runs[0].ID != started.AnalysisRun.ID {
		t.Fatalf("expected listed run %q, got %+v", started.AnalysisRun.ID, runs)
	}
	if runs[0].RunType != promptKindPerception {
		t.Fatalf("expected perception run type to be derived from prompt kind, got %q", runs[0].RunType)
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

	updated, err := svc.UpdateBrandCanon(ctx, "project-1", 42, UpdateBrandCanonInput{
		BrandName:   &brandName,
		Category:    &category,
		Positioning: &positioning,
		Audience:    &audience,
		UseCases:    &useCases,
		Features:    &features,
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

func TestGetPerceptionDoesNotScoreWhenBrandCanonIsMissing(t *testing.T) {
	ctx := context.Background()
	svc := NewService()

	started, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "perception-1", Text: "What is Acme?", Kind: "perception"},
		},
		ModelIDs: []string{"gpt-4o-mini"},
		RunType:  promptKindPerception,
	})
	if err != nil {
		t.Fatalf("start perception: %v", err)
	}

	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          started.AnalysisRun.ID,
		PromptRunID:    started.PromptRuns[0].ID,
		ModelID:        "gpt-4o-mini",
		RawResponse:    "Acme is a strong option with positive sentiment and a citation. Source: https://example.com/acme",
		BrandMentioned: true,
		BrandPosition:  "top",
		CitationFound:  true,
		CitedURLs:      []string{"https://example.com/acme"},
		Sentiment:      "positive",
	}); err != nil {
		t.Fatalf("record perception response: %v", err)
	}

	perception, err := svc.GetPerception(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get perception: %v", err)
	}
	if perception.Scores.PositioningAccuracy != 0 ||
		perception.Scores.FactualAccuracy != 0 {
		t.Fatalf("expected missing brand canon to keep context-dependent scores empty, got %+v", perception.Scores)
	}
	if perception.Scores.SentimentScore != 100 {
		t.Fatalf("expected missing brand canon to keep sentiment measurable, got %+v", perception.Scores)
	}
	if len(perception.Responses) != 1 {
		t.Fatalf("expected perception response to stay visible, got %+v", perception.Responses)
	}
	if perception.Responses[0].Metrics == nil {
		t.Fatalf("expected response metrics")
	}
	if perception.Responses[0].Metrics.Positioning != 0 ||
		perception.Responses[0].Metrics.Factual != 0 ||
		perception.Responses[0].Metrics.UseCases != 0 ||
		perception.Responses[0].Metrics.Features != 0 ||
		perception.Responses[0].Metrics.Competitors != 0 {
		t.Fatalf("expected only sentiment to be measurable, got %+v", perception.Responses[0].Metrics)
	}
	if perception.Responses[0].Metrics.Sentiment != 100 {
		t.Fatalf("expected positive sentiment score 100, got %+v", perception.Responses[0].Metrics)
	}
	if perception.Metadata["sourceMode"] != "brand_context_missing" {
		t.Fatalf("expected brand_context_missing source mode, got %#v", perception.Metadata["sourceMode"])
	}
}

func TestGetPerceptionWithDashboardDoesNotUseMonitoringResponses(t *testing.T) {
	ctx := context.Background()
	svc := NewService()

	brandName := "Acme"
	category := "CRM"
	positioning := "CRM simple pour PME"
	if _, err := svc.UpdateBrandCanon(ctx, "project-1", 42, UpdateBrandCanonInput{
		BrandName:   &brandName,
		Category:    &category,
		Positioning: &positioning,
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
		RawResponse:    "Acme est cite avec une source.",
		BrandMentioned: true,
		BrandPosition:  "top",
		CitationFound:  true,
		CitedURLs:      []string{"https://acme.test"},
		Sentiment:      "positive",
	}); err != nil {
		t.Fatalf("record response: %v", err)
	}

	perception, err := svc.GetPerceptionWithDashboard(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get perception with dashboard: %v", err)
	}

	if len(perception.Dashboard.Responses) != 1 {
		t.Fatalf("expected bundled dashboard responses, got %+v", perception.Dashboard.Responses)
	}
	if len(perception.Responses) != 0 {
		t.Fatalf("expected perception responses to ignore monitoring data, got %+v", perception.Responses)
	}
	if got := perception.Metadata["responses"]; got != 0 {
		t.Fatalf("expected perception metadata to stay empty, got %#v", got)
	}
	if got := perception.Metadata["sourceMode"]; got != "perception_empty" {
		t.Fatalf("expected perception_empty source mode, got %#v", got)
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
			{ID: "prompt-1", Text: "Quel CRM pour PME ?", Kind: promptKindPerception},
		},
		ModelIDs: []string{"gpt-4o-mini", "sonar"},
		RunType:  promptKindPerception,
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
	responses, ok := decoded["responses"].([]any)
	if !ok || len(responses) != 2 {
		t.Fatalf("expected serialized perception responses, got %#v", decoded["responses"])
	}
}

func TestGetPerceptionUsesBackendPositioningTopErrorTitle(t *testing.T) {
	ctx := context.Background()
	svc := NewService()

	brandName := "Acme"
	category := "CRM"
	positioning := "CRM simple pour PME de services"

	if _, err := svc.UpdateBrandCanon(ctx, "project-1", 42, UpdateBrandCanonInput{
		BrandName:   &brandName,
		Category:    &category,
		Positioning: &positioning,
	}); err != nil {
		t.Fatalf("seed brand canon: %v", err)
	}

	started, err := svc.StartAnalysis(ctx, StartAnalysisInput{
		OrganizationID: 42,
		CreatedBy:      7,
		ProjectID:      "project-1",
		PromptTexts: []PromptText{
			{ID: "prompt-1", Text: "Quel CRM pour PME ?", Kind: promptKindPerception},
		},
		ModelIDs: []string{"sonar"},
		RunType:  promptKindPerception,
	})
	if err != nil {
		t.Fatalf("start analysis: %v", err)
	}

	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          started.AnalysisRun.ID,
		PromptRunID:    started.PromptRuns[0].ID,
		ModelID:        "sonar",
		RawResponse:    "La reponse recommande une solution generique sans citer Acme ni son positionnement.",
		BrandMentioned: false,
		BrandPosition:  "",
		CitationFound:  false,
		Sentiment:      "positive",
	}); err != nil {
		t.Fatalf("record response: %v", err)
	}

	perception, err := svc.GetPerception(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get perception: %v", err)
	}

	for _, item := range perception.TopErrors {
		if item.Type == "positioning_gap" {
			if item.Title != "Le positionnement est encore mal cite" {
				t.Fatalf("expected backend positioning title, got %q", item.Title)
			}
			return
		}
	}

	t.Fatalf("expected positioning top error, got %+v", perception.TopErrors)
}

func TestGetPerceptionReturnsReplacementTopErrors(t *testing.T) {
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
			{ID: "prompt-1", Text: "Quel CRM pour PME ?", Kind: promptKindPerception},
		},
		ModelIDs: []string{"sonar"},
		RunType:  promptKindPerception,
	})
	if err != nil {
		t.Fatalf("start analysis: %v", err)
	}

	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          started.AnalysisRun.ID,
		PromptRunID:    started.PromptRuns[0].ID,
		ModelID:        "sonar",
		RawResponse:    "Reponse generique sans source, sans Acme, sans use case, sans fonctionnalite et avec un concurrent devant.",
		BrandMentioned: false,
		BrandPosition:  "bottom",
		CitationFound:  false,
		Sentiment:      "negative",
	}); err != nil {
		t.Fatalf("record response: %v", err)
	}

	perception, err := svc.GetPerception(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get perception: %v", err)
	}
	if len(perception.TopErrors) < 4 {
		t.Fatalf("expected replacement top errors beyond the first three, got %+v", perception.TopErrors)
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
			{ID: "prompt-1", Text: "Quel CRM pour PME ?", Kind: promptKindPerception},
		},
		ModelIDs: []string{"gpt-4o-mini"},
		RunType:  promptKindPerception,
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
			{ID: "prompt-1", Text: "Quel CRM pour PME ?", Kind: promptKindPerception},
		},
		ModelIDs: []string{"gpt-4o-mini", "sonar"},
		RunType:  promptKindPerception,
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
	if len(perception.Responses) != 1 || perception.Responses[0].ModelID != "gpt-4o-mini" {
		t.Fatalf("expected only filtered perception responses to be returned, got %+v", perception.Responses)
	}
}

func TestGetOptimizationErrorsGroupsPerceptionAndCrawlerErrors(t *testing.T) {
	ctx := context.Background()
	svc := NewService()

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
			{ID: "prompt-1", Text: "Quel CRM pour PME ?", Kind: promptKindPerception},
		},
		ModelIDs: []string{"gpt-4o-mini"},
		RunType:  promptKindPerception,
	})
	if err != nil {
		t.Fatalf("start analysis: %v", err)
	}

	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          started.AnalysisRun.ID,
		PromptRunID:    started.PromptRuns[0].ID,
		ModelID:        "gpt-4o-mini",
		RawResponse:    "Acme est parfois cite mais sans preuve claire.",
		BrandMentioned: true,
		BrandPosition:  "bottom",
		CitationFound:  false,
		Sentiment:      "negative",
	}); err != nil {
		t.Fatalf("record response: %v", err)
	}
	if err := svc.saveLatestContentOptimizerCrawl(ctx, "project-1", 42, "crawl-1", ContentOptimizerCrawlResult{
		ID:     "crawl-1",
		Status: "completed",
		Total:  1,
		Records: []ContentOptimizerCrawlRecord{{
			URL:        "https://example.com/pricing",
			Status:     "completed",
			HTTPStatus: 200,
			Title:      "Pricing",
			Issues: []ContentOptimizerIssue{{
				ID:             "example-com-pricing-missing_schema_markup",
				Category:       "geo",
				Severity:       "medium",
				Title:          "Schema markup absent",
				Description:    "Aucune donnee structuree exploitable n'a ete detectee.",
				Recommendation: "Ajouter un JSON-LD WebPage et FAQPage.",
				FixType:        "add_schema_markup",
			}},
		}},
	}); err != nil {
		t.Fatalf("seed content optimizer crawl: %v", err)
	}

	board, err := svc.GetOptimizationErrors(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get optimization errors: %v", err)
	}

	if len(board.Columns) != 3 {
		t.Fatalf("expected 3 severity columns, got %d", len(board.Columns))
	}
	if board.Columns[0].Severity != "high" || board.Columns[1].Severity != "medium" || board.Columns[2].Severity != "low" {
		t.Fatalf("expected high, medium, low column order, got %#v", board.Columns)
	}

	var hasPerceptionError, hasCrawlerError, hasSeededCrawlerError bool
	var hasCrawlerResource bool
	for _, item := range board.Errors {
		switch item.Source {
		case "perception":
			hasPerceptionError = true
		case "crawler":
			hasCrawlerError = true
			if item.ID == "crawler:example-com-pricing-missing_schema_markup" {
				hasSeededCrawlerError = true
				if item.Resource == "https://example.com/pricing" {
					hasCrawlerResource = true
				}
				if item.FixType != "schema_update" {
					t.Fatalf("expected crawler schema issue to map to schema_update, got %q", item.FixType)
				}
			}
		}
		if item.FixType == "" || item.OptimizePriority == "" {
			t.Fatalf("expected optimization item to carry card-compatible fields, got %#v", item)
		}
	}
	if !hasPerceptionError || !hasCrawlerError {
		t.Fatalf("expected perception and crawler errors, got %#v", board.Errors)
	}
	if !hasSeededCrawlerError {
		t.Fatalf("expected seeded crawler error to keep a stable id, got %#v", board.Errors)
	}
	if !hasCrawlerResource {
		t.Fatalf("expected seeded crawler error to expose its page resource, got %#v", board.Errors)
	}
	if board.Metadata["totalErrors"] != len(board.Errors) {
		t.Fatalf("expected metadata totalErrors to match errors length, got %#v for %d errors", board.Metadata["totalErrors"], len(board.Errors))
	}
	if got, ok := board.Metadata["monitoringDerivedErrors"].(int); !ok || got != 0 {
		t.Fatalf("expected derived monitoring errors to be excluded, got %#v", board.Metadata["monitoringDerivedErrors"])
	}
	if got, ok := board.Metadata["monitoringErrors"].(int); !ok || got != 0 {
		t.Fatalf("expected monitoring errors metadata to stay at 0, got %#v", board.Metadata["monitoringErrors"])
	}
	if got, ok := board.Metadata["crawlerErrors"].(int); !ok || got < 1 {
		t.Fatalf("expected crawlerErrors metadata to include crawler items, got %#v", board.Metadata["crawlerErrors"])
	}
}

func TestGetOptimizationErrorsExcludesDerivedMonitoringDiagnostics(t *testing.T) {
	ctx := context.Background()
	svc := NewService()

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
			{ID: "prompt-1", Text: "Quel CRM pour PME ?", Kind: promptKindPerception},
		},
		ModelIDs: []string{"gpt-4o-mini", "sonar"},
		RunType:  promptKindPerception,
	})
	if err != nil {
		t.Fatalf("start analysis: %v", err)
	}

	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          started.AnalysisRun.ID,
		PromptRunID:    started.PromptRuns[0].ID,
		ModelID:        "gpt-4o-mini",
		RawResponse:    "Acme est a peine citee et sans source.",
		BrandMentioned: true,
		BrandPosition:  "bottom",
		CitationFound:  false,
		Sentiment:      "negative",
	}); err != nil {
		t.Fatalf("record first response: %v", err)
	}
	if err := svc.RecordResponse(ctx, ResponseInput{
		RunID:          started.AnalysisRun.ID,
		PromptRunID:    started.PromptRuns[0].ID,
		ModelID:        "sonar",
		RawResponse:    "La marque n'est pas recommandee dans cette reponse.",
		BrandMentioned: false,
		BrandPosition:  "unknown",
		CitationFound:  false,
		Sentiment:      "negative",
	}); err != nil {
		t.Fatalf("record second response: %v", err)
	}

	board, err := svc.GetOptimizationErrors(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("get optimization errors: %v", err)
	}

	for _, item := range board.Errors {
		if item.Source == "monitoring" && strings.HasPrefix(item.ID, "monitoring-derived:") {
			t.Fatalf("expected derived monitoring diagnostics to be excluded, got %#v", item)
		}
	}
	if got, ok := board.Metadata["monitoringDerivedErrors"].(int); !ok || got != 0 {
		t.Fatalf("expected monitoringDerivedErrors metadata to be zero, got %#v", board.Metadata["monitoringDerivedErrors"])
	}
}

func TestOptimizeActionsCanMoveFromProcessingToDone(t *testing.T) {
	svc := NewService()
	svc.optimizeActionBriefGenerator = &recordingOptimizeActionBriefGenerator{
		brief: "Objectif\nMettre a jour la page d'accueil avec une promesse claire.",
	}
	ctx := context.Background()

	created, err := svc.CreateOptimizeAction(ctx, "project-1", 42, CreateOptimizeActionInput{
		Priority:         "high",
		Type:             "website_copy",
		Title:            "Clarifier la promesse",
		Issue:            "Les IA ne rattachent pas la marque a la bonne categorie.",
		Impact:           "La recommandation devient moins fiable.",
		GeneratedContent: "Mettre a jour la page d'accueil avec une promesse claire.",
		Status:           "processing",
		SourceErrorID:    "perception:error-1",
		Metadata: map[string]any{
			"createdBy": "ai",
		},
	})
	if err != nil {
		t.Fatalf("create optimize action: %v", err)
	}
	if created.Status != "processing" {
		t.Fatalf("expected created action to be processing, got %q", created.Status)
	}
	if created.SourceErrorID != "perception:error-1" {
		t.Fatalf("expected source error id to be kept, got %q", created.SourceErrorID)
	}

	actions, err := svc.ListOptimizeActions(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("list optimize actions: %v", err)
	}
	if len(actions) != 1 || actions[0].ID != created.ID {
		t.Fatalf("expected created action in list, got %#v", actions)
	}

	done, err := svc.UpdateOptimizeActionStatus(ctx, "project-1", 42, created.ID, "done")
	if err != nil {
		t.Fatalf("mark optimize action done: %v", err)
	}
	if done.Status != "done" {
		t.Fatalf("expected done status, got %q", done.Status)
	}
}

type recordingOptimizeActionBriefGenerator struct {
	input OptimizeActionBriefInput
	brief string
	err   error
}

func (g *recordingOptimizeActionBriefGenerator) GenerateOptimizeActionBrief(_ context.Context, input OptimizeActionBriefInput) (string, error) {
	g.input = input
	return g.brief, g.err
}

func TestCreateOptimizeActionGeneratesBriefWhenProcessing(t *testing.T) {
	generator := &recordingOptimizeActionBriefGenerator{
		brief: "Objectif\nAmeliorer la reprise IA.\n\nBlocs prets a appliquer\n- FAQ: clarifier la categorie.",
	}
	svc := NewService()
	svc.optimizeActionBriefGenerator = generator
	ctx := context.Background()

	created, err := svc.CreateOptimizeAction(ctx, "project-1", 42, CreateOptimizeActionInput{
		Priority:         "high",
		Type:             "website_copy",
		Title:            "Clarifier la promesse",
		Issue:            "Les IA ne rattachent pas la marque a la bonne categorie.",
		Impact:           "La recommandation devient moins fiable.",
		GeneratedContent: "Mettre a jour la page d'accueil avec une promesse claire.",
		Status:           "processing",
		SourceErrorID:    "perception:error-1",
		Metadata: map[string]any{
			"source":           "perception",
			"detectedInModels": []any{"z-ai/glm-4.5-air:free", "openai/gpt-4o"},
		},
	})
	if err != nil {
		t.Fatalf("create optimize action: %v", err)
	}

	if created.GeneratedContent != generator.brief {
		t.Fatalf("expected generated brief content, got %q", created.GeneratedContent)
	}
	if created.Metadata["briefSource"] != "ai" {
		t.Fatalf("expected AI brief source metadata, got %#v", created.Metadata["briefSource"])
	}
	if generator.input.Source != "perception" {
		t.Fatalf("expected source forwarded to generator, got %q", generator.input.Source)
	}
	if len(generator.input.DetectedInModels) != 2 || generator.input.DetectedInModels[0] != "z-ai/glm-4.5-air:free" {
		t.Fatalf("expected detected models forwarded, got %#v", generator.input.DetectedInModels)
	}
}

func TestCreateOptimizeActionBriefConsumesCreditOnSuccess(t *testing.T) {
	generator := &recordingOptimizeActionBriefGenerator{brief: "Objectif\nCorriger la page."}
	svc := NewService()
	svc.now = func() time.Time { return time.Date(2026, 4, 15, 10, 0, 0, 0, time.UTC) }
	svc.optimizeActionBriefGenerator = generator
	svc.billingQuota = staticBillingQuotaProvider{monthlyQuota: 1}
	ctx := context.Background()

	created, err := svc.CreateOptimizeAction(ctx, "project-1", 42, CreateOptimizeActionInput{
		CreatedBy:        7,
		Priority:         "high",
		Type:             "website_copy",
		Title:            "Clarifier la promesse",
		Issue:            "Les IA ne rattachent pas la marque a la bonne categorie.",
		GeneratedContent: "Suggestion initiale.",
		Status:           "processing",
		SourceErrorID:    "perception:error-credit",
	})
	if err != nil {
		t.Fatalf("create optimize action: %v", err)
	}
	if created.GeneratedContent != generator.brief {
		t.Fatalf("expected generated brief content, got %q", created.GeneratedContent)
	}
	if used := svc.currentMonthlyCreditUsageLocked(42, svc.now().UTC()); used != 1 {
		t.Fatalf("expected generated brief to consume 1 credit, got %d", used)
	}
}

func TestCreateOptimizeActionBriefRequiresAdminPlanEntitlement(t *testing.T) {
	generator := &recordingOptimizeActionBriefGenerator{brief: "Objectif\nCorriger la page."}
	svc := NewService()
	svc.optimizeActionBriefGenerator = generator
	svc.billingQuota = staticBillingEntitlementsProvider{
		plan:          "starter",
		monthlyQuota:  100,
		allowAIBriefs: false,
	}
	ctx := context.Background()

	_, err := svc.CreateOptimizeAction(ctx, "project-1", 42, CreateOptimizeActionInput{
		CreatedBy:        7,
		Priority:         "high",
		Type:             "website_copy",
		Title:            "Clarifier la promesse",
		Issue:            "Les IA ne rattachent pas la marque a la bonne categorie.",
		GeneratedContent: "Suggestion initiale.",
		Status:           "processing",
		SourceErrorID:    "perception:error-plan",
	})
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected unauthorized error, got %v", err)
	}
	if generator.input.ProjectID != "" {
		t.Fatalf("expected generator not to be called, got input %#v", generator.input)
	}
}

func TestCreateOptimizeActionBriefUsesAdminPlanEntitlement(t *testing.T) {
	generator := &recordingOptimizeActionBriefGenerator{brief: "Objectif\nCorriger la page."}
	svc := NewService()
	svc.optimizeActionBriefGenerator = generator
	svc.billingQuota = staticBillingEntitlementsProvider{
		plan:          "starter",
		monthlyQuota:  100,
		allowAIBriefs: true,
	}
	ctx := context.Background()

	created, err := svc.CreateOptimizeAction(ctx, "project-1", 42, CreateOptimizeActionInput{
		CreatedBy:        7,
		Priority:         "high",
		Type:             "website_copy",
		Title:            "Clarifier la promesse",
		Issue:            "Les IA ne rattachent pas la marque a la bonne categorie.",
		GeneratedContent: "Suggestion initiale.",
		Status:           "processing",
		SourceErrorID:    "perception:error-plan-allowed",
	})
	if err != nil {
		t.Fatalf("create optimize action: %v", err)
	}
	if created.GeneratedContent != generator.brief {
		t.Fatalf("expected generated brief content, got %q", created.GeneratedContent)
	}
}

func TestCreateOptimizeActionFailsAndReleasesCreditWhenBriefGenerationFails(t *testing.T) {
	generator := &recordingOptimizeActionBriefGenerator{err: errors.New("provider unavailable")}
	svc := NewService()
	svc.now = func() time.Time { return time.Date(2026, 4, 15, 10, 0, 0, 0, time.UTC) }
	svc.optimizeActionBriefGenerator = generator
	svc.billingQuota = staticBillingQuotaProvider{monthlyQuota: 1}
	ctx := context.Background()

	_, err := svc.CreateOptimizeAction(ctx, "project-1", 42, CreateOptimizeActionInput{
		CreatedBy:        7,
		Priority:         "high",
		Type:             "website_copy",
		Title:            "Clarifier la promesse",
		Issue:            "Les IA ne rattachent pas la marque a la bonne categorie.",
		GeneratedContent: "Suggestion initiale.",
		Status:           "processing",
		SourceErrorID:    "perception:error-fallback",
	})
	if !errors.Is(err, ErrDependencyUnavailable) {
		t.Fatalf("expected dependency unavailable error, got %v", err)
	}
	if used := svc.currentMonthlyCreditUsageLocked(42, svc.now().UTC()); used != 0 {
		t.Fatalf("expected failed brief generation to consume 0 credits, got %d", used)
	}
	if reserved := svc.currentMonthlyReservedCreditUsageLocked(42, svc.now().UTC()); reserved != 0 {
		t.Fatalf("expected failed brief generation to release reservation, got %d", reserved)
	}
}

func TestOptimizeActionsCanBeDeleted(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	created, err := svc.CreateOptimizeAction(ctx, "project-1", 42, CreateOptimizeActionInput{
		Priority:         "medium",
		Type:             "website_copy",
		Title:            "Clarifier le positionnement",
		Issue:            "Les IA citent mal le positionnement.",
		GeneratedContent: "Mettre a jour la page de positionnement.",
		Status:           "draft",
		SourceErrorID:    "perception:positioning_gap",
	})
	if err != nil {
		t.Fatalf("create optimize action: %v", err)
	}

	if err := svc.DeleteOptimizeAction(ctx, "project-1", 42, created.ID); err != nil {
		t.Fatalf("delete optimize action: %v", err)
	}

	actions, err := svc.ListOptimizeActions(ctx, "project-1", 42)
	if err != nil {
		t.Fatalf("list optimize actions: %v", err)
	}
	if len(actions) != 0 {
		t.Fatalf("expected deleted action to disappear, got %#v", actions)
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
		RunByRequest: map[string]string{},
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
