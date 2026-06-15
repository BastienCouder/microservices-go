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
	})
	if err != nil {
		t.Fatalf("create active project: %v", err)
	}
	mustUpdateBrandCanon(t, ctx, svc, activeProject.ID, 42, "Acme", "", "")
	if _, err := svc.ReplaceProjectModels(ctx, activeProject.ID, 42, []string{"gpt-oss-120b-free", "gemma-3-27b-free"}); err != nil {
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
			"gpt-oss-120b-free": "15 */2 * * *",
		},
	}
	if _, err := svc.UpdatePrompt(ctx, prompts[0].ID, 42, UpdatePromptInput{Schedule: &schedule}); err != nil {
		t.Fatalf("update prompt schedule: %v", err)
	}
	firstPromptModels := []string{"gpt-oss-120b-free"}
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

	secondProject, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Second",
		Domain:         "second.example",
		WebsiteURL:     "https://second.example",
	})
	if err != nil {
		t.Fatalf("create second project: %v", err)
	}
	if _, err := svc.AddPrompts(ctx, secondProject.ID, 42, []string{"Should run"}); err != nil {
		t.Fatalf("add second project prompts: %v", err)
	}

	jobs, err := svc.ListScheduledAnalysisJobs(ctx)
	if err != nil {
		t.Fatalf("list scheduled jobs: %v", err)
	}
	if len(jobs) != 2 {
		t.Fatalf("expected two scheduled jobs, got %d", len(jobs))
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
	if !reflect.DeepEqual(job.ModelIDs, []string{"gpt-oss-120b-free"}) {
		t.Fatalf("expected model ids [gpt-oss-120b-free], got %#v", job.ModelIDs)
	}
	if !reflect.DeepEqual(job.Competitors, []string{"HubSpot", "Pipedrive"}) {
		t.Fatalf("expected competitors [HubSpot Pipedrive], got %#v", job.Competitors)
	}
	if !reflect.DeepEqual(job.Schedule, schedule) {
		t.Fatalf("expected schedule %#v, got %#v", schedule, job.Schedule)
	}
}
