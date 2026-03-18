package usecase

import (
	"context"
	"reflect"
	"testing"
)

func TestListScheduledAnalysisJobsReturnsActivePromptCoverage(t *testing.T) {
	ctx := context.Background()
	svc := NewService()

	activeProject, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Acme",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
		BrandName:      "Acme",
	})
	if err != nil {
		t.Fatalf("create active project: %v", err)
	}
	if _, err := svc.ActivateProject(ctx, activeProject.ID, 42); err != nil {
		t.Fatalf("activate project: %v", err)
	}
	if _, err := svc.ReplaceProjectModels(ctx, activeProject.ID, 42, []string{"gpt-4o", "sonar"}); err != nil {
		t.Fatalf("replace models: %v", err)
	}

	prompts, err := svc.AddPrompts(ctx, activeProject.ID, 42, []string{"Prompt A", "Prompt B"})
	if err != nil {
		t.Fatalf("add prompts: %v", err)
	}

	schedule := PromptSchedule{
		Mode:     PromptScheduleModePerModel,
		Cron:     "0 */4 * * *",
		Timezone: "Europe/Paris",
		ModelCrons: map[string]string{
			"gpt-4o": "15 */2 * * *",
		},
	}
	if _, err := svc.UpdatePrompt(ctx, prompts[0].ID, 42, UpdatePromptInput{Schedule: &schedule}); err != nil {
		t.Fatalf("update prompt schedule: %v", err)
	}
	firstPromptModels := []string{"gpt-4o"}
	if _, err := svc.UpdatePrompt(ctx, prompts[0].ID, 42, UpdatePromptInput{ModelIDs: &firstPromptModels}); err != nil {
		t.Fatalf("update prompt models: %v", err)
	}
	archivedStatus := PromptStatusArchived
	if _, err := svc.UpdatePrompt(ctx, prompts[1].ID, 42, UpdatePromptInput{Status: &archivedStatus}); err != nil {
		t.Fatalf("archive prompt: %v", err)
	}

	if _, err := svc.AddCompetitors(ctx, activeProject.ID, 42, []AddCompetitorInput{
		{Name: "HubSpot"},
		{Name: "Pipedrive"},
	}); err != nil {
		t.Fatalf("add competitors: %v", err)
	}

	draftProject, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Draft",
		Domain:         "draft.example",
		WebsiteURL:     "https://draft.example",
	})
	if err != nil {
		t.Fatalf("create draft project: %v", err)
	}
	if _, err := svc.AddPrompts(ctx, draftProject.ID, 42, []string{"Should not run"}); err != nil {
		t.Fatalf("add draft prompts: %v", err)
	}

	jobs, err := svc.ListScheduledAnalysisJobs(ctx)
	if err != nil {
		t.Fatalf("list scheduled jobs: %v", err)
	}
	if len(jobs) != 1 {
		t.Fatalf("expected one scheduled job, got %d", len(jobs))
	}

	job := jobs[0]
	if job.ProjectID != activeProject.ID {
		t.Fatalf("expected project %s, got %s", activeProject.ID, job.ProjectID)
	}
	if job.ProjectName != "Acme" {
		t.Fatalf("expected project name Acme, got %q", job.ProjectName)
	}
	if job.OrganizationID != 42 {
		t.Fatalf("expected organization 42, got %d", job.OrganizationID)
	}
	if job.CreatedBy != 7 {
		t.Fatalf("expected createdBy 7, got %d", job.CreatedBy)
	}
	if job.PromptID != prompts[0].ID {
		t.Fatalf("expected prompt %s, got %s", prompts[0].ID, job.PromptID)
	}
	if job.PromptText != "Prompt A" {
		t.Fatalf("expected prompt text Prompt A, got %q", job.PromptText)
	}
	if !reflect.DeepEqual(job.ModelIDs, []string{"gpt-4o"}) {
		t.Fatalf("expected model ids [gpt-4o], got %#v", job.ModelIDs)
	}
	if !reflect.DeepEqual(job.Competitors, []string{"HubSpot", "Pipedrive"}) {
		t.Fatalf("expected competitors [HubSpot Pipedrive], got %#v", job.Competitors)
	}
	if !reflect.DeepEqual(job.Schedule, schedule) {
		t.Fatalf("expected schedule %#v, got %#v", schedule, job.Schedule)
	}
}
