package usecase

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"
)

type mutableProjectStore struct {
	payload []byte
}

type fakeBillingClient struct {
	entitlements BillingEntitlements
	err          error
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

func (f *fakeBillingClient) GetOrganizationEntitlements(_ context.Context, _ int64) (BillingEntitlements, error) {
	if f.err != nil {
		return BillingEntitlements{}, f.err
	}
	return f.entitlements, nil
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

func TestReplaceProjectModelsRejectsSelectionBeyondPlanLimit(t *testing.T) {
	ctx := context.Background()
	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		BillingClient: &fakeBillingClient{
			entitlements: BillingEntitlements{
				Plan:                    "starter",
				ModelSelectionLimit:     3,
				MonthlyModelChangeLimit: 3,
			},
		},
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

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

	_, err = svc.ReplaceProjectModels(ctx, project.ID, 12, []string{
		"gpt-oss-20b-free",
		"gpt-oss-120b-free",
		"gemma-3-4b-free",
		"gemma-3-27b-free",
	})
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected validation error, got %v", err)
	}
}

func TestReplaceProjectModelsRejectsMoreThanThreeMonthlyChanges(t *testing.T) {
	ctx := context.Background()
	store := &mutableProjectStore{}
	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		Store: store,
		BillingClient: &fakeBillingClient{
			entitlements: BillingEntitlements{
				Plan:                    "growth",
				ModelSelectionLimit:     6,
				MonthlyModelChangeLimit: 3,
			},
		},
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}
	svc.now = func() time.Time {
		return time.Date(2026, 4, 15, 9, 0, 0, 0, time.UTC)
	}

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

	selectionSets := [][]string{
		{"gpt-oss-20b-free"},
		{"gpt-oss-120b-free"},
		{"gemma-3-4b-free"},
		{"gemma-3-27b-free"},
	}

	if _, err := svc.ReplaceProjectModels(ctx, project.ID, 12, selectionSets[0]); err != nil {
		t.Fatalf("first change: %v", err)
	}
	if _, err := svc.ReplaceProjectModels(ctx, project.ID, 12, selectionSets[1]); err != nil {
		t.Fatalf("second change: %v", err)
	}
	if _, err := svc.ReplaceProjectModels(ctx, project.ID, 12, selectionSets[2]); err != nil {
		t.Fatalf("third change: %v", err)
	}

	_, err = svc.ReplaceProjectModels(ctx, project.ID, 12, selectionSets[3])
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected validation error on fourth monthly change, got %v", err)
	}

	var saved persistedState
	if err := json.Unmarshal(store.payload, &saved); err != nil {
		t.Fatalf("unmarshal saved state: %v", err)
	}
	usage, ok := saved.ModelSelectionChanges[project.ID]
	if !ok {
		t.Fatalf("expected model selection usage to be persisted")
	}
	if usage.Month != "2026-04" || usage.Count != 3 {
		t.Fatalf("expected persisted usage 2026-04/3, got %#v", usage)
	}
}

func TestCreateAndUpdateModel(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	created, err := svc.CreateModel(ctx, CreateAIModelInput{
		ID:                 "openai-o3",
		Label:              "OpenAI o3",
		Provider:           "openai",
		Group:              "chatgpt",
		IconKey:            "openai",
		ModelID:            "o3",
		IsActive:           true,
		SupportsLiveSearch: false,
	})
	if err != nil {
		t.Fatalf("create model: %v", err)
	}
	if created.IconPath != "/models/openai.svg" {
		t.Fatalf("expected openai icon path, got %q", created.IconPath)
	}

	newLabel := "OpenAI o3 Updated"
	inactive := false
	liveSearch := true
	updated, err := svc.UpdateModel(ctx, "openai-o3", UpdateAIModelInput{
		Label:              &newLabel,
		IsActive:           &inactive,
		SupportsLiveSearch: &liveSearch,
	})
	if err != nil {
		t.Fatalf("update model: %v", err)
	}
	if updated.Label != newLabel {
		t.Fatalf("expected label %q, got %q", newLabel, updated.Label)
	}
	if updated.IsActive {
		t.Fatalf("expected model to be inactive")
	}
	if !updated.SupportsLiveSearch {
		t.Fatalf("expected live search to be enabled")
	}
}

func TestReplaceProjectModelsRejectsInactiveModel(t *testing.T) {
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

	inactive := false
	if _, err := svc.UpdateModel(ctx, "gpt-oss-20b-free", UpdateAIModelInput{IsActive: &inactive}); err != nil {
		t.Fatalf("deactivate model: %v", err)
	}

	_, err = svc.ReplaceProjectModels(ctx, project.ID, 12, []string{"gpt-oss-20b-free"})
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected validation error, got %v", err)
	}
}

func TestListEnabledProjectModelIDsSkipsInactiveCatalogModels(t *testing.T) {
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

	if _, err := svc.ReplaceProjectModels(ctx, project.ID, 12, []string{"gpt-oss-20b-free"}); err != nil {
		t.Fatalf("replace models: %v", err)
	}

	inactive := false
	if _, err := svc.UpdateModel(ctx, "gpt-oss-20b-free", UpdateAIModelInput{IsActive: &inactive}); err != nil {
		t.Fatalf("deactivate model: %v", err)
	}

	enabledModelIDs, err := svc.ListEnabledProjectModelIDs(ctx, project.ID, 12)
	if err != nil {
		t.Fatalf("list enabled models: %v", err)
	}
	if len(enabledModelIDs) != 0 {
		t.Fatalf("expected no enabled model ids, got %v", enabledModelIDs)
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
				ID:              "seed-demo-project",
				OrganizationID:  1,
				CreatedBy:       1,
				Name:            "Seed Demo Project",
				Domain:          "seed-demo.local",
				WebsiteURL:      "https://seed-demo.local",
				PrimaryLanguage: "fr",
				Country:         "FR",
				Status:          "active",
				CreatedAt:       now,
				UpdatedAt:       now,
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

func TestUpdatePromptsStatusPersistsPromptStatus(t *testing.T) {
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

	prompts, err := svc.AddPrompts(ctx, project.ID, 42, []string{"Prompt one", "Prompt two"})
	if err != nil {
		t.Fatalf("add prompts: %v", err)
	}

	updated, err := svc.UpdatePromptsStatus(ctx, project.ID, 42, UpdatePromptsStatusInput{
		PromptIDs: []string{prompts[0].ID, prompts[1].ID},
		Status:    PromptStatusArchived,
	})
	if err != nil {
		t.Fatalf("update prompts status: %v", err)
	}
	if len(updated) != 2 {
		t.Fatalf("expected 2 updated prompts, got %d", len(updated))
	}
	for _, prompt := range updated {
		if prompt.Status != PromptStatusArchived {
			t.Fatalf("expected archived status, got %q", prompt.Status)
		}
		if prompt.IsActive {
			t.Fatalf("expected archived prompt to be inactive")
		}
	}

	page, err := svc.ListPrompts(ctx, project.ID, 42, ListPromptsInput{})
	if err != nil {
		t.Fatalf("list prompts: %v", err)
	}
	if len(page.Items) != 2 {
		t.Fatalf("expected 2 prompts in page, got %d", len(page.Items))
	}
	for _, prompt := range page.Items {
		if prompt.Status != PromptStatusArchived {
			t.Fatalf("expected archived status after reload, got %q", prompt.Status)
		}
	}
}

func TestUpdatePromptPersistsModelCoverage(t *testing.T) {
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

	if _, err := svc.ReplaceProjectModels(ctx, project.ID, 42, []string{"gpt-oss-120b-free", "gemma-3-27b-free"}); err != nil {
		t.Fatalf("replace project models: %v", err)
	}

	prompts, err := svc.AddPrompts(ctx, project.ID, 42, []string{"Prompt one"})
	if err != nil {
		t.Fatalf("add prompts: %v", err)
	}

	modelIDs := []string{"gemma-3-27b-free"}
	updated, err := svc.UpdatePrompt(ctx, prompts[0].ID, 42, UpdatePromptInput{ModelIDs: &modelIDs})
	if err != nil {
		t.Fatalf("update prompt: %v", err)
	}

	if !reflect.DeepEqual(updated.ModelIDs, []string{"gemma-3-27b-free"}) {
		t.Fatalf("expected modelIds [gemma-3-27b-free], got %#v", updated.ModelIDs)
	}

	page, err := svc.ListPrompts(ctx, project.ID, 42, ListPromptsInput{})
	if err != nil {
		t.Fatalf("list prompts: %v", err)
	}
	if len(page.Items) != 1 {
		t.Fatalf("expected 1 prompt, got %d", len(page.Items))
	}
	if !reflect.DeepEqual(page.Items[0].ModelIDs, []string{"gemma-3-27b-free"}) {
		t.Fatalf("expected persisted modelIds [gemma-3-27b-free], got %#v", page.Items[0].ModelIDs)
	}
}

func TestUpdatePromptRejectsModelOutsideProjectCoverage(t *testing.T) {
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

	if _, err := svc.ReplaceProjectModels(ctx, project.ID, 42, []string{"gpt-oss-120b-free"}); err != nil {
		t.Fatalf("replace project models: %v", err)
	}

	prompts, err := svc.AddPrompts(ctx, project.ID, 42, []string{"Prompt one"})
	if err != nil {
		t.Fatalf("add prompts: %v", err)
	}

	modelIDs := []string{"gemma-3-27b-free"}
	_, err = svc.UpdatePrompt(ctx, prompts[0].ID, 42, UpdatePromptInput{ModelIDs: &modelIDs})
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected validation error, got %v", err)
	}
}

func TestUpdatePromptPersistsScheduleConfig(t *testing.T) {
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

	if _, err := svc.ReplaceProjectModels(ctx, project.ID, 42, []string{"gpt-oss-120b-free", "gemma-3-27b-free"}); err != nil {
		t.Fatalf("replace project models: %v", err)
	}

	prompts, err := svc.AddPrompts(ctx, project.ID, 42, []string{"Prompt one"})
	if err != nil {
		t.Fatalf("add prompts: %v", err)
	}

	schedule := PromptSchedule{
		Mode:     PromptScheduleModePerModel,
		Cron:     "0 */4 * * *",
		Timezone: "Europe/Paris",
		ModelCrons: map[string]string{
			"gpt-oss-120b-free": "15 */2 * * *",
			"gemma-3-27b-free":  "45 6 * * 1-5",
		},
	}

	updated, err := svc.UpdatePrompt(ctx, prompts[0].ID, 42, UpdatePromptInput{Schedule: &schedule})
	if err != nil {
		t.Fatalf("update prompt schedule: %v", err)
	}

	if updated.Schedule.Mode != PromptScheduleModePerModel {
		t.Fatalf("expected per_model mode, got %q", updated.Schedule.Mode)
	}
	if updated.Schedule.Cron != "0 */4 * * *" {
		t.Fatalf("expected global cron to persist, got %q", updated.Schedule.Cron)
	}
	if updated.Schedule.Timezone != "Europe/Paris" {
		t.Fatalf("expected timezone Europe/Paris, got %q", updated.Schedule.Timezone)
	}
	if !reflect.DeepEqual(updated.Schedule.ModelCrons, schedule.ModelCrons) {
		t.Fatalf("expected model overrides %#v, got %#v", schedule.ModelCrons, updated.Schedule.ModelCrons)
	}

	page, err := svc.ListPrompts(ctx, project.ID, 42, ListPromptsInput{})
	if err != nil {
		t.Fatalf("list prompts: %v", err)
	}
	if got := page.Items[0].Schedule; !reflect.DeepEqual(got, updated.Schedule) {
		t.Fatalf("expected persisted schedule %#v, got %#v", updated.Schedule, got)
	}
}

func TestUpdatePromptRejectsInvalidCronSchedule(t *testing.T) {
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

	prompts, err := svc.AddPrompts(ctx, project.ID, 42, []string{"Prompt one"})
	if err != nil {
		t.Fatalf("add prompts: %v", err)
	}

	schedule := PromptSchedule{
		Mode:     PromptScheduleModeGlobal,
		Cron:     "every day at nine",
		Timezone: "UTC",
	}
	_, err = svc.UpdatePrompt(ctx, prompts[0].ID, 42, UpdatePromptInput{Schedule: &schedule})
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected validation error, got %v", err)
	}
}

func TestListActiveCompetitorsReturnsOnlyActiveNames(t *testing.T) {
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

	created, err := svc.AddCompetitors(ctx, project.ID, 42, []AddCompetitorInput{
		{Name: "HubSpot"},
		{Name: "Salesforce"},
		{Name: "Pipedrive"},
	})
	if err != nil {
		t.Fatalf("add competitors: %v", err)
	}

	disabled := false
	if _, err := svc.UpdateCompetitor(ctx, created[1].ID, 42, UpdateCompetitorInput{IsActive: &disabled}); err != nil {
		t.Fatalf("disable competitor: %v", err)
	}

	activeCompetitors, err := svc.ListActiveCompetitors(ctx, project.ID, 42)
	if err != nil {
		t.Fatalf("list active competitors: %v", err)
	}

	expected := []string{"HubSpot", "Pipedrive"}
	if !reflect.DeepEqual(activeCompetitors, expected) {
		t.Fatalf("expected active competitors %v, got %v", expected, activeCompetitors)
	}
}

func TestListEnabledProjectModelIDsReturnsOnlyCurrentProjectModels(t *testing.T) {
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

	if _, err := svc.ReplaceProjectModels(ctx, project.ID, 42, []string{"gpt-oss-120b-free", "gemma-3-27b-free"}); err != nil {
		t.Fatalf("replace project models: %v", err)
	}

	modelIDs, err := svc.ListEnabledProjectModelIDs(ctx, project.ID, 42)
	if err != nil {
		t.Fatalf("list enabled project model ids: %v", err)
	}

	expected := []string{"gemma-3-27b-free", "gpt-oss-120b-free"}
	if !reflect.DeepEqual(modelIDs, expected) {
		t.Fatalf("expected enabled project model ids %v, got %v", expected, modelIDs)
	}
}
