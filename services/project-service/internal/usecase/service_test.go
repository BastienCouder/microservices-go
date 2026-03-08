package usecase

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"
)

type mutableProjectStore struct {
	payload []byte
}

func (s *mutableProjectStore) Load(_ context.Context) ([]byte, bool, error) {
	if s.payload == nil {
		return nil, false, nil
	}
	return append([]byte(nil), s.payload...), true, nil
}

func (s *mutableProjectStore) Save(_ context.Context, payload []byte) error {
	s.payload = append([]byte(nil), payload...)
	return nil
}

func TestProjectFlowCreateFinalize(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

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
	if project.OrganizationID != 42 {
		t.Fatalf("expected organization id 42, got %d", project.OrganizationID)
	}
	if project.CreatedBy != 7 {
		t.Fatalf("expected created by 7, got %d", project.CreatedBy)
	}

	if _, err := svc.AddPrompts(ctx, project.ID, 42, []string{"Quel CRM pour PME ?"}); err != nil {
		t.Fatalf("add prompts: %v", err)
	}

	result, err := svc.FinalizeProject(ctx, project.ID, 42)
	if err != nil {
		t.Fatalf("finalize project: %v", err)
	}
	if result.PromptCount != 1 {
		t.Fatalf("expected prompt count 1, got %d", result.PromptCount)
	}
	if result.ModelCount == 0 {
		t.Fatalf("expected at least one model")
	}

	got, err := svc.GetProject(ctx, project.ID, 42)
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
		OrganizationID: 10,
		CreatedBy:      2,
		Name:           "Owner Project",
		Domain:         "owner.io",
		WebsiteURL:     "https://owner.io",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	_, err = svc.GetProject(ctx, project.ID, 11)
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected unauthorized error, got %v", err)
	}
}

func TestReplaceProjectModelsRejectsUnknownModel(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 12,
		CreatedBy:      1,
		Name:           "Acme",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	_, err = svc.ReplaceProjectModels(ctx, project.ID, 12, []string{"unknown-model"})
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected validation error, got %v", err)
	}
}

func TestListProjectsFiltersByOrganization(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	if _, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 101,
		CreatedBy:      1,
		Name:           "Org A",
		Domain:         "orga.test",
		WebsiteURL:     "https://orga.test",
	}); err != nil {
		t.Fatalf("create project A: %v", err)
	}
	if _, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 202,
		CreatedBy:      2,
		Name:           "Org B",
		Domain:         "orgb.test",
		WebsiteURL:     "https://orgb.test",
	}); err != nil {
		t.Fatalf("create project B: %v", err)
	}

	projects, err := svc.ListProjects(ctx, 101)
	if err != nil {
		t.Fatalf("list projects: %v", err)
	}
	if len(projects) != 1 {
		t.Fatalf("expected 1 project for org 101, got %d", len(projects))
	}
	if projects[0].OrganizationID != 101 {
		t.Fatalf("expected organization id 101, got %d", projects[0].OrganizationID)
	}
}

func TestListProjectsReloadsStateFromStore(t *testing.T) {
	ctx := context.Background()
	store := &mutableProjectStore{}

	initialPayload, err := json.Marshal(persistedState{
		Projects:      map[string]*Project{},
		Prompts:       map[string]*Prompt{},
		Competitors:   map[string]*Competitor{},
		Models:        map[string]AIModel{},
		ProjectModels: map[string]map[string]bool{},
		Outbox:        map[string]*OutboxEvent{},
		OutboxOrder:   []string{},
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
		Projects: map[string]*Project{
			"seed-demo-project": {
				ID:             "seed-demo-project",
				OrganizationID: 1,
				CreatedBy:      1,
				Name:           "Seed Demo Project",
				Domain:         "seed-demo.local",
				WebsiteURL:     "https://seed-demo.local",
				PrimaryLanguage:"fr",
				Country:        "FR",
				Status:         "active",
				CreatedAt:      now,
				UpdatedAt:      now,
			},
		},
		Prompts:       map[string]*Prompt{},
		Competitors:   map[string]*Competitor{},
		Models:        map[string]AIModel{},
		ProjectModels: map[string]map[string]bool{},
		Outbox:        map[string]*OutboxEvent{},
		OutboxOrder:   []string{},
	})
	if err != nil {
		t.Fatalf("marshal updated state: %v", err)
	}
	store.payload = updatedPayload

	projects, err := svc.ListProjects(ctx, 1)
	if err != nil {
		t.Fatalf("list projects: %v", err)
	}
	if len(projects) != 1 {
		t.Fatalf("expected 1 project after store update, got %d", len(projects))
	}
	if projects[0].ID != "seed-demo-project" {
		t.Fatalf("expected seed-demo-project, got %q", projects[0].ID)
	}
}
