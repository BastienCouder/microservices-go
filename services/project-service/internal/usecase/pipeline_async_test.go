package usecase

import (
	"context"
	"reflect"
	"testing"
)

type analysisClientSpy struct {
	startCalls    int
	recordCalls   int
	lastStartReq  AnalysisStartRequest
	recordedCalls []AnalysisRecordResponseInput
}

func (s *analysisClientSpy) StartAnalysis(_ context.Context, req AnalysisStartRequest) (AnalysisStartResponse, error) {
	s.startCalls++
	s.lastStartReq = req
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

type iaClientSpy struct {
	execCalls  int
	execInputs []IAExecutePromptInput
}

func (s *iaClientSpy) ExecutePrompt(_ context.Context, input IAExecutePromptInput) (IAExecutePromptResult, error) {
	s.execCalls++
	s.execInputs = append(s.execInputs, input)
	var result IAExecutePromptResult
	result.RawResponse = "ok"
	result.Analysis.BrandMentioned = true
	result.Analysis.BrandPosition = "top"
	result.Analysis.CitationFound = true
	result.Analysis.CitedURLs = []string{"https://example.com"}
	result.Analysis.Sentiment = "positive"
	return result, nil
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
		BrandName:      "Acme",
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
		BrandName:      "Acme",
		Industry:       "CRM",
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
		t.Fatalf("expected perception run type, got %q", analysisSpy.lastStartReq.RunType)
	}
	if len(analysisSpy.lastStartReq.PromptTexts) != 3 {
		t.Fatalf("expected 3 perception prompts, got %d", len(analysisSpy.lastStartReq.PromptTexts))
	}
	if len(analysisSpy.lastStartReq.ModelIDs) == 0 {
		t.Fatalf("expected all active project models to be selected")
	}
	if iaSpy.execCalls != len(analysisSpy.lastStartReq.PromptTexts)*len(analysisSpy.lastStartReq.ModelIDs) {
		t.Fatalf("expected one IA call per perception prompt/model, got %d", iaSpy.execCalls)
	}

	page, err := svc.ListPrompts(ctx, project.ID, 42, ListPromptsInput{PageSize: 10})
	if err != nil {
		t.Fatalf("list prompts: %v", err)
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
		BrandName:      "Acme",
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
		BrandName:      "Acme",
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
		BrandName:      "Acme",
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
		BrandName:      "Acme",
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
		BrandName:      "Acme",
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
		BrandName:      "Acme",
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
		BrandName:      "Acme",
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
		BrandName:      "Acme",
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
