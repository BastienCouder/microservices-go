package usecase

import (
	"context"
	"errors"
	"testing"
)

func TestProjectFlowCreateFinalize(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		UserID:     "user-1",
		Name:       "Acme",
		Domain:     "acme.com",
		WebsiteURL: "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	if _, err := svc.AddPrompts(ctx, project.ID, "user-1", []string{"Quel CRM pour PME ?"}); err != nil {
		t.Fatalf("add prompts: %v", err)
	}

	result, err := svc.FinalizeProject(ctx, project.ID, "user-1")
	if err != nil {
		t.Fatalf("finalize project: %v", err)
	}
	if result.PromptCount != 1 {
		t.Fatalf("expected prompt count 1, got %d", result.PromptCount)
	}
	if result.ModelCount == 0 {
		t.Fatalf("expected at least one model")
	}

	got, err := svc.GetProject(ctx, project.ID, "user-1")
	if err != nil {
		t.Fatalf("get project: %v", err)
	}
	if got.Status != "active" {
		t.Fatalf("expected active status, got %q", got.Status)
	}
}

func TestProjectUnauthorizedAccess(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		UserID:     "user-owner",
		Name:       "Owner Project",
		Domain:     "owner.io",
		WebsiteURL: "https://owner.io",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	_, err = svc.GetProject(ctx, project.ID, "user-other")
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected unauthorized error, got %v", err)
	}
}

func TestReplaceProjectModelsRejectsUnknownModel(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		UserID:     "user-1",
		Name:       "Acme",
		Domain:     "acme.com",
		WebsiteURL: "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	_, err = svc.ReplaceProjectModels(ctx, project.ID, "user-1", []string{"unknown-model"})
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected validation error, got %v", err)
	}
}
