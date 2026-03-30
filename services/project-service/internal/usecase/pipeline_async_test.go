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

	result, err := svc.FinalizeProject(ctx, project.ID, 42)
	if err != nil {
		t.Fatalf("finalize: %v", err)
	}
	if result.Project.Status != "active" {
		t.Fatalf("expected active status, got %s", result.Project.Status)
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
	}

	if !reflect.DeepEqual(gotCoverage[prompts[0].ID], []string{"gpt-oss-120b-free"}) {
		t.Fatalf("expected first prompt coverage [gpt-oss-120b-free], got %#v", gotCoverage[prompts[0].ID])
	}
	if !reflect.DeepEqual(gotCoverage[prompts[1].ID], []string{"gemma-3-27b-free"}) {
		t.Fatalf("expected second prompt coverage [gemma-3-27b-free], got %#v", gotCoverage[prompts[1].ID])
	}
}
