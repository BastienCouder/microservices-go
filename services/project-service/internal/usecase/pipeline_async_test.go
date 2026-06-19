package usecase

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"
)

type analysisClientSpy struct {
	startCalls           int
	recordCalls          int
	failCalls            int
	cancelCheckCalls     int
	cancelledAfterChecks int
	lastStartReq         AnalysisStartRequest
	recordedCalls        []AnalysisRecordResponseInput
	missingPromptIDs     []string
	onStart              func()
}

func (s *analysisClientSpy) StartAnalysis(_ context.Context, req AnalysisStartRequest) (AnalysisStartResponse, error) {
	s.startCalls++
	s.lastStartReq = req
	if s.onStart != nil {
		s.onStart()
	}
	promptRuns := make([]AnalysisPromptRun, 0, len(req.PromptTexts))
	for _, prompt := range req.PromptTexts {
		promptRuns = append(promptRuns, AnalysisPromptRun{
			ID:         prompt.ID + "-run",
			PromptID:   prompt.ID,
			PromptText: prompt.Text,
		})
	}
	return AnalysisStartResponse{
		RunID:      "run-1",
		PromptRuns: promptRuns,
	}, nil
}

func (s *analysisClientSpy) RecordResponse(_ context.Context, _ string, input AnalysisRecordResponseInput) error {
	s.recordCalls++
	s.recordedCalls = append(s.recordedCalls, input)
	return nil
}

func (s *analysisClientSpy) IsAnalysisRunCancelled(_ context.Context, _ string, _ int64) (bool, error) {
	s.cancelCheckCalls++
	return s.cancelledAfterChecks > 0 && s.cancelCheckCalls >= s.cancelledAfterChecks, nil
}

func (s *analysisClientSpy) FailAnalysisRun(_ context.Context, _ string, _ int64) error {
	s.failCalls++
	return nil
}

func (s *analysisClientSpy) ListMissingAnalysisPromptIDs(_ context.Context, _ string, _ int64, promptIDs []string, _ []string, _ string) ([]string, error) {
	if s.missingPromptIDs != nil {
		return append([]string(nil), s.missingPromptIDs...), nil
	}
	return append([]string(nil), promptIDs...), nil
}

type iaClientSpy struct {
	execCalls  int
	execInputs []IAExecutePromptInput
	err        error
}

func (s *iaClientSpy) ExecutePrompt(_ context.Context, input IAExecutePromptInput) (IAExecutePromptResult, error) {
	s.execCalls++
	s.execInputs = append(s.execInputs, input)
	if s.err != nil {
		return IAExecutePromptResult{}, s.err
	}
	var result IAExecutePromptResult
	result.RawResponse = "ok"
	result.Analysis.BrandMentioned = true
	result.Analysis.BrandPosition = "top"
	result.Analysis.CitationFound = true
	result.Analysis.CitedURLs = []string{"https://example.com"}
	result.Analysis.Sentiment = "positive"
	return result, nil
}

type contextAwareIAClientSpy struct {
	execCalls int
}

func (s *contextAwareIAClientSpy) ExecutePrompt(ctx context.Context, _ IAExecutePromptInput) (IAExecutePromptResult, error) {
	s.execCalls++
	if err := ctx.Err(); err != nil {
		return IAExecutePromptResult{}, err
	}
	var result IAExecutePromptResult
	result.RawResponse = "ok"
	result.Analysis.BrandMentioned = true
	result.Analysis.BrandPosition = "top"
	result.Analysis.Sentiment = "positive"
	return result, nil
}

func (s *contextAwareIAClientSpy) ListModels(_ context.Context, onlyActive bool) ([]AIModel, error) {
	return (&iaClientSpy{}).ListModels(context.Background(), onlyActive)
}

func waitForCondition(t *testing.T, condition func() bool) {
	t.Helper()
	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) {
		if condition() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	if !condition() {
		t.Fatalf("condition was not met before deadline")
	}
}

func (s *iaClientSpy) ListModels(_ context.Context, onlyActive bool) ([]AIModel, error) {
	svc := NewService()
	return svc.ListModels(context.Background(), onlyActive)
}

func TestFinalizeProjectEnqueuesOutboxWithoutBlockingPipeline(t *testing.T) {
	ctx := context.Background()
	analysisSpy := &analysisClientSpy{}
	iaSpy := &iaClientSpy{}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		AnalysisClient: analysisSpy,
		IAClient:       iaSpy,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Acme",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	if _, err := svc.AddPrompts(ctx, project.ID, 42, []string{"Quel CRM pour PME ?"}); err != nil {
		t.Fatalf("add prompts: %v", err)
	}

	_, err = svc.FinalizeProject(ctx, project.ID, 42)
	if err != nil {
		t.Fatalf("finalize: %v", err)
	}
	if analysisSpy.startCalls != 0 || analysisSpy.recordCalls != 0 || iaSpy.execCalls != 0 {
		t.Fatalf("expected no sync pipeline calls during finalize, got start=%d record=%d ia=%d", analysisSpy.startCalls, analysisSpy.recordCalls, iaSpy.execCalls)
	}

	events, err := svc.ListOutboxEventsToPublish(ctx, 10)
	if err != nil {
		t.Fatalf("list outbox events: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected one outbox event, got %d", len(events))
	}
	if events[0].EventType != OutboxEventTypeProjectFinalized {
		t.Fatalf("unexpected event type: %s", events[0].EventType)
	}
}

func TestRunPerceptionAnalysisUsesThreePromptsAndAllProjectModels(t *testing.T) {
	ctx := context.Background()
	analysisSpy := &analysisClientSpy{}
	iaSpy := &iaClientSpy{}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		AnalysisClient: analysisSpy,
		IAClient:       iaSpy,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Acme",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	result, err := svc.RunPerceptionAnalysis(ctx, project.ID, 42, 7, RunPerceptionAnalysisInput{})
	if err != nil {
		t.Fatalf("run perception: %v", err)
	}
	if result.RunID != "run-1" {
		t.Fatalf("expected run id run-1, got %q", result.RunID)
	}
	if analysisSpy.lastStartReq.RunType != PromptKindPerception {
		t.Fatalf("expected perception run type for perception launch, got %q", analysisSpy.lastStartReq.RunType)
	}
	for _, prompt := range analysisSpy.lastStartReq.PromptTexts {
		if prompt.Kind != PromptKindPerception {
			t.Fatalf("expected perception prompt kind, got %q", prompt.Kind)
		}
	}
	if len(analysisSpy.lastStartReq.PromptTexts) != 3 {
		t.Fatalf("expected 3 perception prompts, got %d", len(analysisSpy.lastStartReq.PromptTexts))
	}
	if len(analysisSpy.lastStartReq.ModelIDs) == 0 {
		t.Fatalf("expected all active project models to be selected")
	}
	if analysisSpy.lastStartReq.ModelCreditCostSum <= 0 {
		t.Fatalf("expected model credit cost sum to be populated")
	}
	expectedCredits := len(analysisSpy.lastStartReq.PromptTexts) * analysisSpy.lastStartReq.ModelCreditCostSum
	if analysisSpy.lastStartReq.RequestedCredits != expectedCredits {
		t.Fatalf("expected perception requested credits %d, got %d", expectedCredits, analysisSpy.lastStartReq.RequestedCredits)
	}
	expectedExecCalls := len(analysisSpy.lastStartReq.PromptTexts) * len(analysisSpy.lastStartReq.ModelIDs)
	waitForCondition(t, func() bool { return iaSpy.execCalls == expectedExecCalls })
	if iaSpy.execCalls != expectedExecCalls {
		t.Fatalf("expected one IA call per perception prompt/model, got %d", iaSpy.execCalls)
	}

	page, err := svc.ListPrompts(ctx, project.ID, 42, ListPromptsInput{PageSize: 10})
	if err != nil {
		t.Fatalf("list prompts: %v", err)
	}
	if len(page.Items) != 0 {
		t.Fatalf("expected default prompt list to exclude perception prompts, got %d", len(page.Items))
	}

	page, err = svc.ListPrompts(ctx, project.ID, 42, ListPromptsInput{PageSize: 10, Kind: PromptKindPerception})
	if err != nil {
		t.Fatalf("list perception prompts: %v", err)
	}
	perceptionPrompts := 0
	for _, prompt := range page.Items {
		if prompt.Kind == PromptKindPerception {
			perceptionPrompts++
		}
	}
	if perceptionPrompts != 3 {
		t.Fatalf("expected 3 persisted perception prompts, got %d", perceptionPrompts)
	}
}

func TestRunPerceptionAnalysisContinuesAfterRequestContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	analysisSpy := &analysisClientSpy{onStart: cancel}
	iaSpy := &contextAwareIAClientSpy{}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		AnalysisClient: analysisSpy,
		IAClient:       iaSpy,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Acme",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	if _, err := svc.RunPerceptionAnalysis(ctx, project.ID, 42, 7, RunPerceptionAnalysisInput{RequestID: "reload-safe"}); err != nil {
		t.Fatalf("run perception after request cancellation: %v", err)
	}
	waitForCondition(t, func() bool { return iaSpy.execCalls > 0 && analysisSpy.recordCalls > 0 })
	if iaSpy.execCalls == 0 {
		t.Fatalf("expected IA execution to continue after request cancellation")
	}
	if analysisSpy.recordCalls == 0 {
		t.Fatalf("expected responses to be recorded after request cancellation")
	}
}

func TestRunPerceptionAnalysisMultipliesCreditsByModelCost(t *testing.T) {
	ctx := context.Background()
	analysisSpy := &analysisClientSpy{}
	iaSpy := &iaClientSpy{}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		AnalysisClient: analysisSpy,
		IAClient:       iaSpy,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	premiumModel := svc.models["gpt-oss-20b-free"]
	premiumModel.CreditCost = 2
	svc.models[premiumModel.ID] = premiumModel

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Acme",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	if _, err := svc.RunPerceptionAnalysis(ctx, project.ID, 42, 7, RunPerceptionAnalysisInput{RequestID: "perception-premium"}); err != nil {
		t.Fatalf("run perception: %v", err)
	}
	if analysisSpy.lastStartReq.ModelCreditCostSum < len(analysisSpy.lastStartReq.ModelIDs)+1 {
		t.Fatalf("expected premium model to increase credit cost sum, got sum=%d models=%d", analysisSpy.lastStartReq.ModelCreditCostSum, len(analysisSpy.lastStartReq.ModelIDs))
	}
	expectedCredits := len(analysisSpy.lastStartReq.PromptTexts) * analysisSpy.lastStartReq.ModelCreditCostSum
	if analysisSpy.lastStartReq.RequestedCredits != expectedCredits {
		t.Fatalf("expected premium perception credits %d, got %d", expectedCredits, analysisSpy.lastStartReq.RequestedCredits)
	}
}

func TestRunPerceptionAnalysisUsesSelectedPromptsAndModels(t *testing.T) {
	ctx := context.Background()
	analysisSpy := &analysisClientSpy{}
	iaSpy := &iaClientSpy{}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		AnalysisClient: analysisSpy,
		IAClient:       iaSpy,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Acme",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	prompts, err := svc.AddPromptInputsWithKind(ctx, project.ID, 42, []CreatePromptInput{
		{Text: "How is Acme positioned?", Language: "en"},
		{Text: "Who is Acme for?", Language: "en"},
	}, PromptKindPerception)
	if err != nil {
		t.Fatalf("add perception prompts: %v", err)
	}

	selectedModelIDs := []string{"gpt-oss-120b-free"}
	if _, err := svc.RunPerceptionAnalysis(ctx, project.ID, 42, 7, RunPerceptionAnalysisInput{
		RequestID: "selected-perception",
		PromptIDs: []string{prompts[1].ID},
		ModelIDs:  selectedModelIDs,
	}); err != nil {
		t.Fatalf("run selected perception: %v", err)
	}

	if len(analysisSpy.lastStartReq.PromptTexts) != 1 {
		t.Fatalf("expected one selected prompt, got %d", len(analysisSpy.lastStartReq.PromptTexts))
	}
	if analysisSpy.lastStartReq.PromptTexts[0].ID != prompts[1].ID {
		t.Fatalf("expected selected prompt %s, got %s", prompts[1].ID, analysisSpy.lastStartReq.PromptTexts[0].ID)
	}
	if len(analysisSpy.lastStartReq.ModelIDs) != 1 || analysisSpy.lastStartReq.ModelIDs[0] != selectedModelIDs[0] {
		t.Fatalf("expected selected model ids %#v, got %#v", selectedModelIDs, analysisSpy.lastStartReq.ModelIDs)
	}
	waitForCondition(t, func() bool { return iaSpy.execCalls == 1 })
	if iaSpy.execCalls != 1 {
		t.Fatalf("expected one IA call, got %d", iaSpy.execCalls)
	}
	if analysisSpy.lastStartReq.RequestedCredits != analysisSpy.lastStartReq.ModelCreditCostSum {
		t.Fatalf("expected requested credits to match selected model cost, got credits=%d sum=%d", analysisSpy.lastStartReq.RequestedCredits, analysisSpy.lastStartReq.ModelCreditCostSum)
	}
}

func TestRunPerceptionAnalysisResumesOnlyMissingPrompts(t *testing.T) {
	ctx := context.Background()
	analysisSpy := &analysisClientSpy{}
	iaSpy := &iaClientSpy{}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		AnalysisClient: analysisSpy,
		IAClient:       iaSpy,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Acme",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	prompts, err := svc.AddPromptInputsWithKind(ctx, project.ID, 42, []CreatePromptInput{
		{Text: "How is Acme positioned?", Language: "en"},
		{Text: "Who is Acme for?", Language: "en"},
		{Text: "How does Acme compare?", Language: "en"},
	}, PromptKindPerception)
	if err != nil {
		t.Fatalf("add perception prompts: %v", err)
	}
	analysisSpy.missingPromptIDs = []string{prompts[2].ID}

	if _, err := svc.RunPerceptionAnalysis(ctx, project.ID, 42, 7, RunPerceptionAnalysisInput{RequestID: "resume-missing"}); err != nil {
		t.Fatalf("run perception: %v", err)
	}
	if len(analysisSpy.lastStartReq.PromptTexts) != 1 {
		t.Fatalf("expected only one missing prompt to be launched, got %d", len(analysisSpy.lastStartReq.PromptTexts))
	}
	if analysisSpy.lastStartReq.PromptTexts[0].ID != prompts[2].ID {
		t.Fatalf("expected third prompt to be launched, got %q", analysisSpy.lastStartReq.PromptTexts[0].ID)
	}
	waitForCondition(t, func() bool { return iaSpy.execCalls == len(analysisSpy.lastStartReq.ModelIDs) })
	if iaSpy.execCalls != len(analysisSpy.lastStartReq.ModelIDs) {
		t.Fatalf("expected one IA call per model for the missing prompt, got calls=%d models=%d", iaSpy.execCalls, len(analysisSpy.lastStartReq.ModelIDs))
	}
}

func TestRunPerceptionAnalysisRestartIgnoresMissingPromptResume(t *testing.T) {
	ctx := context.Background()
	analysisSpy := &analysisClientSpy{}
	iaSpy := &iaClientSpy{}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		AnalysisClient: analysisSpy,
		IAClient:       iaSpy,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Acme",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	prompts, err := svc.AddPromptInputsWithKind(ctx, project.ID, 42, []CreatePromptInput{
		{Text: "How is Acme positioned?", Language: "en"},
		{Text: "Who is Acme for?", Language: "en"},
		{Text: "How does Acme compare?", Language: "en"},
	}, PromptKindPerception)
	if err != nil {
		t.Fatalf("add perception prompts: %v", err)
	}
	analysisSpy.missingPromptIDs = []string{prompts[2].ID}

	if _, err := svc.RunPerceptionAnalysis(ctx, project.ID, 42, 7, RunPerceptionAnalysisInput{RequestID: "restart-all", Restart: true}); err != nil {
		t.Fatalf("run perception: %v", err)
	}
	if len(analysisSpy.lastStartReq.PromptTexts) != len(prompts) {
		t.Fatalf("expected restart to launch all prompts, got %d", len(analysisSpy.lastStartReq.PromptTexts))
	}
}

func TestRunPerceptionAnalysisReturnsDependencyUnavailableOnProviderFailure(t *testing.T) {
	ctx := context.Background()
	analysisSpy := &analysisClientSpy{}
	iaSpy := &iaClientSpy{err: errors.New("provider returned status 503")}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		AnalysisClient: analysisSpy,
		IAClient:       iaSpy,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Acme",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	if _, err := svc.RunPerceptionAnalysis(ctx, project.ID, 42, 7, RunPerceptionAnalysisInput{RequestID: "provider-failure"}); err != nil {
		t.Fatalf("run perception: %v", err)
	}
	waitForCondition(t, func() bool { return analysisSpy.failCalls == 1 })
	if analysisSpy.recordCalls != 0 {
		t.Fatalf("expected no invented fallback responses, got %d", analysisSpy.recordCalls)
	}
	if analysisSpy.failCalls != 1 {
		t.Fatalf("expected failed analysis run to be marked failed once, got %d", analysisSpy.failCalls)
	}
}

func TestOutboxEventProcessingRunsPipelineOnce(t *testing.T) {
	ctx := context.Background()
	analysisSpy := &analysisClientSpy{}
	iaSpy := &iaClientSpy{}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		AnalysisClient: analysisSpy,
		IAClient:       iaSpy,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Acme",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	if _, err := svc.AddPrompts(ctx, project.ID, 42, []string{"Q1", "Q2"}); err != nil {
		t.Fatalf("add prompts: %v", err)
	}
	if _, err := svc.SaveLLMProviderCredential(ctx, project.ID, 42, "openrouter", "sk-openrouter"); err != nil {
		t.Fatalf("save provider credential: %v", err)
	}

	if _, err := svc.FinalizeProject(ctx, project.ID, 42); err != nil {
		t.Fatalf("finalize: %v", err)
	}
	events, err := svc.ListOutboxEventsToPublish(ctx, 10)
	if err != nil {
		t.Fatalf("list outbox events: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected one event, got %d", len(events))
	}
	eventID := events[0].ID

	if err := svc.MarkOutboxEventPublished(ctx, eventID); err != nil {
		t.Fatalf("mark outbox published: %v", err)
	}

	if err := svc.ProcessFinalizedProjectOutboxEvent(ctx, eventID); err != nil {
		t.Fatalf("process outbox event: %v", err)
	}
	if err := svc.ProcessFinalizedProjectOutboxEvent(ctx, eventID); err != nil {
		t.Fatalf("process outbox event idempotency: %v", err)
	}

	if analysisSpy.startCalls != 1 {
		t.Fatalf("expected one analysis start call, got %d", analysisSpy.startCalls)
	}
	waitForCondition(t, func() bool { return iaSpy.execCalls > 0 && analysisSpy.recordCalls == iaSpy.execCalls })
	if iaSpy.execCalls == 0 {
		t.Fatalf("expected ia execution calls")
	}
	if analysisSpy.recordCalls != iaSpy.execCalls {
		t.Fatalf("expected same ia and record counts, got ia=%d record=%d", iaSpy.execCalls, analysisSpy.recordCalls)
	}
}

func TestOutboxEventProcessingRespectsPromptModelCoverage(t *testing.T) {
	ctx := context.Background()
	analysisSpy := &analysisClientSpy{}
	iaSpy := &iaClientSpy{}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		AnalysisClient: analysisSpy,
		IAClient:       iaSpy,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Acme",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	if _, err := svc.ReplaceProjectModels(ctx, project.ID, 42, []string{"gpt-oss-120b-free", "gemma-3-27b-free"}); err != nil {
		t.Fatalf("replace project models: %v", err)
	}
	if _, err := svc.SaveLLMProviderCredential(ctx, project.ID, 42, "openrouter", "sk-openrouter"); err != nil {
		t.Fatalf("save provider credential: %v", err)
	}

	prompts, err := svc.AddPrompts(ctx, project.ID, 42, []string{"Q1", "Q2"})
	if err != nil {
		t.Fatalf("add prompts: %v", err)
	}

	firstPromptModels := []string{"gpt-oss-120b-free"}
	if _, err := svc.UpdatePrompt(ctx, prompts[0].ID, 42, UpdatePromptInput{ModelIDs: &firstPromptModels}); err != nil {
		t.Fatalf("update first prompt models: %v", err)
	}
	secondPromptModels := []string{"gemma-3-27b-free"}
	if _, err := svc.UpdatePrompt(ctx, prompts[1].ID, 42, UpdatePromptInput{ModelIDs: &secondPromptModels}); err != nil {
		t.Fatalf("update second prompt models: %v", err)
	}

	if _, err := svc.FinalizeProject(ctx, project.ID, 42); err != nil {
		t.Fatalf("finalize: %v", err)
	}
	events, err := svc.ListOutboxEventsToPublish(ctx, 10)
	if err != nil {
		t.Fatalf("list outbox events: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected one event, got %d", len(events))
	}

	eventID := events[0].ID
	if err := svc.MarkOutboxEventPublished(ctx, eventID); err != nil {
		t.Fatalf("mark outbox published: %v", err)
	}
	if err := svc.ProcessFinalizedProjectOutboxEvent(ctx, eventID); err != nil {
		t.Fatalf("process outbox event: %v", err)
	}
	waitForCondition(t, func() bool { return len(iaSpy.execInputs) == 2 })

	if !reflect.DeepEqual(analysisSpy.lastStartReq.ModelIDs, []string{"gemma-3-27b-free", "gpt-oss-120b-free"}) {
		t.Fatalf("expected analysis start modelIds [gemma-3-27b-free gpt-oss-120b-free], got %#v", analysisSpy.lastStartReq.ModelIDs)
	}
	if len(iaSpy.execInputs) != 2 {
		t.Fatalf("expected 2 ia executions, got %d", len(iaSpy.execInputs))
	}

	gotCoverage := map[string][]string{}
	for _, call := range iaSpy.execInputs {
		gotCoverage[call.PromptID] = append(gotCoverage[call.PromptID], call.ModelID)
		if call.PromptMode != PromptModeOrganic {
			t.Fatalf("expected prompt mode organic by default, got %q", call.PromptMode)
		}
	}

	if !reflect.DeepEqual(gotCoverage[prompts[0].ID], []string{"openai/gpt-oss-120b:free"}) {
		t.Fatalf("expected first prompt coverage [openai/gpt-oss-120b:free], got %#v", gotCoverage[prompts[0].ID])
	}
	if !reflect.DeepEqual(gotCoverage[prompts[1].ID], []string{"google/gemma-3-27b-it"}) {
		t.Fatalf("expected second prompt coverage [google/gemma-3-27b-it], got %#v", gotCoverage[prompts[1].ID])
	}
}

func TestOutboxEventProcessingPassesProjectProviderAPIKey(t *testing.T) {
	ctx := context.Background()
	analysisSpy := &analysisClientSpy{}
	iaSpy := &iaClientSpy{}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		AnalysisClient: analysisSpy,
		IAClient:       iaSpy,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Acme",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	if _, err := svc.SaveLLMProviderCredential(ctx, project.ID, 42, "openai", "sk-project-openai"); err != nil {
		t.Fatalf("save project provider credential: %v", err)
	}
	if _, err := svc.ReplaceProjectModels(ctx, project.ID, 42, []string{"gpt-oss-20b-free"}); err != nil {
		t.Fatalf("replace project models: %v", err)
	}
	if _, err := svc.AddPrompts(ctx, project.ID, 42, []string{"Q1"}); err != nil {
		t.Fatalf("add prompts: %v", err)
	}
	if _, err := svc.FinalizeProject(ctx, project.ID, 42); err != nil {
		t.Fatalf("finalize: %v", err)
	}

	events, err := svc.ListOutboxEventsToPublish(ctx, 10)
	if err != nil {
		t.Fatalf("list outbox events: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected one event, got %d", len(events))
	}
	if err := svc.MarkOutboxEventPublished(ctx, events[0].ID); err != nil {
		t.Fatalf("mark outbox published: %v", err)
	}
	if err := svc.ProcessFinalizedProjectOutboxEvent(ctx, events[0].ID); err != nil {
		t.Fatalf("process outbox event: %v", err)
	}
	waitForCondition(t, func() bool { return len(iaSpy.execInputs) > 0 })

	if len(iaSpy.execInputs) == 0 {
		t.Fatalf("expected ia execution")
	}
	got := iaSpy.execInputs[0]
	if got.ProviderID != "openai" {
		t.Fatalf("expected provider openai, got %q", got.ProviderID)
	}
	if got.ProviderAPIKey != "sk-project-openai" {
		t.Fatalf("expected project provider api key to be passed, got %q", got.ProviderAPIKey)
	}
	if got.ModelID != "openai/gpt-oss-20b:free" {
		t.Fatalf("expected provider model id, got %q", got.ModelID)
	}
}

func TestOutboxEventProcessingPrefersOpenRouterForGPTOSSWhenBothCredentialsExist(t *testing.T) {
	ctx := context.Background()
	analysisSpy := &analysisClientSpy{}
	iaSpy := &iaClientSpy{}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		AnalysisClient: analysisSpy,
		IAClient:       iaSpy,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Acme",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	if _, err := svc.SaveLLMProviderCredential(ctx, project.ID, 42, "openai", "sk-project-openai"); err != nil {
		t.Fatalf("save openai credential: %v", err)
	}
	if _, err := svc.SaveLLMProviderCredential(ctx, project.ID, 42, "openrouter", "sk-openrouter"); err != nil {
		t.Fatalf("save openrouter credential: %v", err)
	}
	if _, err := svc.ReplaceProjectModels(ctx, project.ID, 42, []string{"gpt-oss-20b-free"}); err != nil {
		t.Fatalf("replace project models: %v", err)
	}
	if _, err := svc.AddPrompts(ctx, project.ID, 42, []string{"Q1"}); err != nil {
		t.Fatalf("add prompts: %v", err)
	}
	if _, err := svc.FinalizeProject(ctx, project.ID, 42); err != nil {
		t.Fatalf("finalize: %v", err)
	}

	events, err := svc.ListOutboxEventsToPublish(ctx, 10)
	if err != nil {
		t.Fatalf("list outbox events: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected one event, got %d", len(events))
	}
	if err := svc.MarkOutboxEventPublished(ctx, events[0].ID); err != nil {
		t.Fatalf("mark outbox published: %v", err)
	}
	if err := svc.ProcessFinalizedProjectOutboxEvent(ctx, events[0].ID); err != nil {
		t.Fatalf("process outbox event: %v", err)
	}
	waitForCondition(t, func() bool { return len(iaSpy.execInputs) > 0 })

	if len(iaSpy.execInputs) == 0 {
		t.Fatalf("expected ia execution")
	}
	got := iaSpy.execInputs[0]
	if got.ProviderID != "openrouter" {
		t.Fatalf("expected provider openrouter, got %q", got.ProviderID)
	}
	if got.ProviderAPIKey != "sk-openrouter" {
		t.Fatalf("expected openrouter api key, got %q", got.ProviderAPIKey)
	}
	if got.ModelID != "openai/gpt-oss-20b:free" {
		t.Fatalf("expected provider model id, got %q", got.ModelID)
	}
}

func TestOutboxEventProcessingPrefersOpenRouterForLegacyGPTOSSCatalogEntries(t *testing.T) {
	ctx := context.Background()
	analysisSpy := &analysisClientSpy{}
	iaSpy := &iaClientSpy{}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		AnalysisClient: analysisSpy,
		IAClient:       iaSpy,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Acme",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	if _, err := svc.SaveLLMProviderCredential(ctx, project.ID, 42, "openai", "sk-project-openai"); err != nil {
		t.Fatalf("save openai credential: %v", err)
	}
	if _, err := svc.SaveLLMProviderCredential(ctx, project.ID, 42, "openrouter", "sk-openrouter"); err != nil {
		t.Fatalf("save openrouter credential: %v", err)
	}

	legacy := svc.models["gpt-oss-120b-free"]
	legacy.Group = "OpenAI"
	svc.models["gpt-oss-120b-free"] = legacy

	if _, err := svc.ReplaceProjectModels(ctx, project.ID, 42, []string{"gpt-oss-120b-free"}); err != nil {
		t.Fatalf("replace project models: %v", err)
	}
	if _, err := svc.AddPrompts(ctx, project.ID, 42, []string{"Q1"}); err != nil {
		t.Fatalf("add prompts: %v", err)
	}
	if _, err := svc.FinalizeProject(ctx, project.ID, 42); err != nil {
		t.Fatalf("finalize: %v", err)
	}

	events, err := svc.ListOutboxEventsToPublish(ctx, 10)
	if err != nil {
		t.Fatalf("list outbox events: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected one event, got %d", len(events))
	}
	if err := svc.MarkOutboxEventPublished(ctx, events[0].ID); err != nil {
		t.Fatalf("mark outbox published: %v", err)
	}
	if err := svc.ProcessFinalizedProjectOutboxEvent(ctx, events[0].ID); err != nil {
		t.Fatalf("process outbox event: %v", err)
	}
	waitForCondition(t, func() bool { return len(iaSpy.execInputs) > 0 })

	if len(iaSpy.execInputs) == 0 {
		t.Fatalf("expected ia execution")
	}
	got := iaSpy.execInputs[0]
	if got.ProviderID != "openrouter" {
		t.Fatalf("expected provider openrouter, got %q", got.ProviderID)
	}
	if got.ProviderAPIKey != "sk-openrouter" {
		t.Fatalf("expected openrouter api key, got %q", got.ProviderAPIKey)
	}
	if got.ModelID != "openai/gpt-oss-120b:free" {
		t.Fatalf("expected provider model id, got %q", got.ModelID)
	}
}

func TestOutboxEventProcessingPrefersOpenRouterForImportedCatalogModelSource(t *testing.T) {
	ctx := context.Background()
	analysisSpy := &analysisClientSpy{}
	iaSpy := &iaClientSpy{}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		AnalysisClient: analysisSpy,
		IAClient:       iaSpy,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Acme",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	if _, err := svc.SaveLLMProviderCredential(ctx, project.ID, 42, "openai", "sk-project-openai"); err != nil {
		t.Fatalf("save openai credential: %v", err)
	}
	if _, err := svc.SaveLLMProviderCredential(ctx, project.ID, 42, "openrouter", "sk-openrouter"); err != nil {
		t.Fatalf("save openrouter credential: %v", err)
	}
	if _, err := svc.CreateModel(ctx, CreateAIModelInput{
		ID:                 "openai-gpt-4o-mini",
		Label:              "GPT-4o Mini",
		Provider:           "openai",
		Group:              "OpenAI",
		IconKey:            "openai",
		ModelID:            "openai/gpt-4o-mini",
		IsActive:           true,
		SupportsLiveSearch: true,
	}); err != nil {
		t.Fatalf("create imported-like model: %v", err)
	}
	if _, err := svc.ReplaceProjectModels(ctx, project.ID, 42, []string{"openai-gpt-4o-mini"}); err != nil {
		t.Fatalf("replace project models: %v", err)
	}
	if _, err := svc.AddPrompts(ctx, project.ID, 42, []string{"Q1"}); err != nil {
		t.Fatalf("add prompts: %v", err)
	}
	if _, err := svc.FinalizeProject(ctx, project.ID, 42); err != nil {
		t.Fatalf("finalize: %v", err)
	}

	events, err := svc.ListOutboxEventsToPublish(ctx, 10)
	if err != nil {
		t.Fatalf("list outbox events: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected one event, got %d", len(events))
	}
	if err := svc.MarkOutboxEventPublished(ctx, events[0].ID); err != nil {
		t.Fatalf("mark outbox published: %v", err)
	}
	if err := svc.ProcessFinalizedProjectOutboxEvent(ctx, events[0].ID); err != nil {
		t.Fatalf("process outbox event: %v", err)
	}
	waitForCondition(t, func() bool { return len(iaSpy.execInputs) > 0 })

	if len(iaSpy.execInputs) == 0 {
		t.Fatalf("expected ia execution")
	}
	got := iaSpy.execInputs[0]
	if got.ProviderID != "openrouter" {
		t.Fatalf("expected provider openrouter, got %q", got.ProviderID)
	}
	if got.ProviderAPIKey != "sk-openrouter" {
		t.Fatalf("expected openrouter api key, got %q", got.ProviderAPIKey)
	}
	if got.ModelID != "openai/gpt-4o-mini" {
		t.Fatalf("expected provider model id, got %q", got.ModelID)
	}
}

func TestRunManualAnalysisExecutesPromptAndRecordsResponse(t *testing.T) {
	ctx := context.Background()
	analysisSpy := &analysisClientSpy{}
	iaSpy := &iaClientSpy{}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		AnalysisClient: analysisSpy,
		IAClient:       iaSpy,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Acme",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	prompts, err := svc.AddPrompts(ctx, project.ID, 42, []string{"Quel CRM recommander ?"})
	if err != nil {
		t.Fatalf("add prompts: %v", err)
	}
	if _, err := svc.SaveLLMProviderCredential(ctx, project.ID, 42, "openrouter", "sk-openrouter"); err != nil {
		t.Fatalf("save provider credential: %v", err)
	}
	svc.mu.Lock()
	model := svc.models["gpt-oss-20b-free"]
	model.CreditCost = 2
	svc.models["gpt-oss-20b-free"] = model
	svc.mu.Unlock()

	result, err := svc.RunManualAnalysis(ctx, project.ID, 42, 7, RunManualAnalysisInput{
		RequestID: "manual-request-1",
		PromptTexts: []AnalysisPromptText{
			{ID: prompts[0].ID, Text: prompts[0].Text},
		},
		ModelIDs: []string{"gpt-oss-20b-free"},
	})
	if err != nil {
		t.Fatalf("run manual analysis: %v", err)
	}

	if result.RunID != "run-1" {
		t.Fatalf("expected run id run-1, got %q", result.RunID)
	}
	if analysisSpy.startCalls != 1 {
		t.Fatalf("expected one analysis start call, got %d", analysisSpy.startCalls)
	}
	if analysisSpy.lastStartReq.ModelCreditCostSum != 2 {
		t.Fatalf("expected model credit cost sum 2, got %d", analysisSpy.lastStartReq.ModelCreditCostSum)
	}
	if analysisSpy.lastStartReq.RequestedCredits != 2 {
		t.Fatalf("expected requested credits 2, got %d", analysisSpy.lastStartReq.RequestedCredits)
	}
	waitForCondition(t, func() bool { return iaSpy.execCalls == 1 && analysisSpy.recordCalls == 1 })
	if iaSpy.execCalls != 1 {
		t.Fatalf("expected one ia execution, got %d", iaSpy.execCalls)
	}
	if analysisSpy.recordCalls != 1 {
		t.Fatalf("expected one recorded response, got %d", analysisSpy.recordCalls)
	}
	got := iaSpy.execInputs[0]
	if got.ProviderID != "openrouter" {
		t.Fatalf("expected openrouter provider, got %q", got.ProviderID)
	}
	if got.ProviderAPIKey != "sk-openrouter" {
		t.Fatalf("expected project provider api key to be passed, got %q", got.ProviderAPIKey)
	}
	if got.ModelID != "openai/gpt-oss-20b:free" {
		t.Fatalf("expected provider model id, got %q", got.ModelID)
	}
}

func TestRunManualAnalysisRejectsPerceptionPrompt(t *testing.T) {
	ctx := context.Background()
	analysisSpy := &analysisClientSpy{}
	iaSpy := &iaClientSpy{}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		AnalysisClient: analysisSpy,
		IAClient:       iaSpy,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Acme",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	prompts, err := svc.AddPromptsWithKind(ctx, project.ID, 42, []string{"Qu'est-ce que Acme ?"}, PromptKindPerception)
	if err != nil {
		t.Fatalf("add perception prompt: %v", err)
	}

	_, err = svc.RunManualAnalysis(ctx, project.ID, 42, 7, RunManualAnalysisInput{
		RequestID: "manual-perception-prompt",
		PromptTexts: []AnalysisPromptText{
			{ID: prompts[0].ID, Text: prompts[0].Text},
		},
		ModelIDs: []string{"gpt-oss-20b-free"},
	})
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected validation error, got %v", err)
	}
	if analysisSpy.startCalls != 0 {
		t.Fatalf("expected no analysis run to be started, got %d", analysisSpy.startCalls)
	}
	if iaSpy.execCalls != 0 {
		t.Fatalf("expected no ia execution, got %d", iaSpy.execCalls)
	}
}

func TestRunManualAnalysisStopsBeforeExecutingWhenRunIsCancelled(t *testing.T) {
	ctx := context.Background()
	analysisSpy := &analysisClientSpy{cancelledAfterChecks: 1}
	iaSpy := &iaClientSpy{}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		AnalysisClient: analysisSpy,
		IAClient:       iaSpy,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Acme",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	prompts, err := svc.AddPrompts(ctx, project.ID, 42, []string{"Quel CRM recommander ?"})
	if err != nil {
		t.Fatalf("add prompts: %v", err)
	}
	if _, err := svc.SaveLLMProviderCredential(ctx, project.ID, 42, "openrouter", "sk-openrouter"); err != nil {
		t.Fatalf("save provider credential: %v", err)
	}

	result, err := svc.RunManualAnalysis(ctx, project.ID, 42, 7, RunManualAnalysisInput{
		RequestID: "manual-cancelled-request",
		PromptTexts: []AnalysisPromptText{
			{ID: prompts[0].ID, Text: prompts[0].Text},
		},
		ModelIDs: []string{"gpt-oss-20b-free"},
	})
	if err != nil {
		t.Fatalf("run manual analysis: %v", err)
	}
	if result.RunID != "run-1" {
		t.Fatalf("expected run id run-1, got %q", result.RunID)
	}
	if iaSpy.execCalls != 0 {
		t.Fatalf("expected no ia execution after cancellation, got %d", iaSpy.execCalls)
	}
	if analysisSpy.recordCalls != 0 {
		t.Fatalf("expected no recorded response after cancellation, got %d", analysisSpy.recordCalls)
	}
}

func TestRunManualAnalysisFallsBackToOpenRouterServiceCredential(t *testing.T) {
	ctx := context.Background()
	analysisSpy := &analysisClientSpy{}
	iaSpy := &iaClientSpy{}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		AnalysisClient: analysisSpy,
		IAClient:       iaSpy,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Acme",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	prompts, err := svc.AddPrompts(ctx, project.ID, 42, []string{"Quel CRM recommander ?"})
	if err != nil {
		t.Fatalf("add prompts: %v", err)
	}

	_, err = svc.RunManualAnalysis(ctx, project.ID, 42, 7, RunManualAnalysisInput{
		RequestID: "manual-request-1",
		PromptTexts: []AnalysisPromptText{
			{ID: prompts[0].ID, Text: prompts[0].Text},
		},
		ModelIDs: []string{"gpt-oss-20b-free"},
	})
	if err != nil {
		t.Fatalf("run manual analysis: %v", err)
	}

	waitForCondition(t, func() bool { return iaSpy.execCalls == 1 })
	if iaSpy.execCalls != 1 {
		t.Fatalf("expected one ia execution, got %d", iaSpy.execCalls)
	}
	got := iaSpy.execInputs[0]
	if got.ProviderID != "openrouter" {
		t.Fatalf("expected openrouter fallback, got %q", got.ProviderID)
	}
	if got.ProviderAPIKey != "" {
		t.Fatalf("expected empty provider api key so ia-service can use its configured key, got %q", got.ProviderAPIKey)
	}
}
