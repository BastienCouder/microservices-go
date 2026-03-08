package usecase

import (
	"context"
	"testing"
)

type analysisClientSpy struct {
	startCalls  int
	recordCalls int
}

func (s *analysisClientSpy) StartAnalysis(_ context.Context, req AnalysisStartRequest) (AnalysisStartResponse, error) {
	s.startCalls++
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

func (s *analysisClientSpy) RecordResponse(_ context.Context, _ string, _ AnalysisRecordResponseInput) error {
	s.recordCalls++
	return nil
}

type iaClientSpy struct {
	execCalls int
}

func (s *iaClientSpy) ExecutePrompt(_ context.Context, _ IAExecutePromptInput) (IAExecutePromptResult, error) {
	s.execCalls++
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
