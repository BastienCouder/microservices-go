package usecase

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
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
				MonthlyModelChangeLimit: 0,
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

func TestReplaceProjectModelsAllowsMoreThanThreeMonthlyChanges(t *testing.T) {
	ctx := context.Background()
	svc, err := NewServiceWithDependencies(ctx, Dependencies{
		BillingClient: &fakeBillingClient{
			entitlements: BillingEntitlements{
				Plan:                    "growth",
				ModelSelectionLimit:     6,
				MonthlyModelChangeLimit: 0,
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

	result, err := svc.ReplaceProjectModels(ctx, project.ID, 12, selectionSets[3])
	if err != nil {
		t.Fatalf("fourth change should be allowed, got %v", err)
	}
	if result.Count != 1 || len(result.ModelIDs) != 1 || result.ModelIDs[0] != "gemma-3-27b-free" {
		t.Fatalf("unexpected fourth change result: %#v", result)
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

func TestUpdateModelInfersMissingIconKeyFromProvider(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	svc.models["legacy-openai"] = AIModel{
		ID:                 "legacy-openai",
		Label:              "Legacy OpenAI",
		Provider:           "openai",
		Group:              "legacy",
		ModelID:            "openai/legacy",
		IsActive:           false,
		SupportsLiveSearch: false,
	}

	activated := true
	updated, err := svc.UpdateModel(ctx, "legacy-openai", UpdateAIModelInput{
		IsActive: &activated,
	})
	if err != nil {
		t.Fatalf("update model: %v", err)
	}
	if updated.IconKey != "openai" {
		t.Fatalf("expected icon key fallback, got %q", updated.IconKey)
	}
	if updated.IconPath != "/models/openai.svg" {
		t.Fatalf("expected icon path fallback, got %q", updated.IconPath)
	}
	if !updated.IsActive {
		t.Fatalf("expected model to be activated")
	}
}

func TestSyncOpenRouterModelsImportsAvailableModels(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/models" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"data": [
				{
					"id": "openai/gpt-oss-20b:free",
					"name": "OpenAI: gpt-oss-20b (free)",
					"context_length": 131072,
					"pricing": {"prompt": "0"},
					"supported_parameters": ["tools"]
				},
				{
					"id": "anthropic/claude-3.5-sonnet",
					"name": "Anthropic: Claude 3.5 Sonnet",
					"context_length": 200000,
					"pricing": {"prompt": "0.000003"},
					"supported_parameters": ["tools"]
				},
				{
					"id": "mistral/tiny-paid",
					"name": "Mistral: Tiny Paid",
					"context_length": 32000,
					"pricing": {"prompt": "0.000001"},
					"supported_parameters": []
				}
			]
		}`))
	}))
	defer server.Close()

	previousURL := openRouterModelsURL
	openRouterModelsURL = server.URL + "/api/v1/models"
	defer func() {
		openRouterModelsURL = previousURL
	}()

	result, err := svc.SyncOpenRouterModels(ctx, SyncOpenRouterModelsInput{
		MinContext:    128000,
		SupportsTools: true,
		Providers:     []string{"openai", "anthropic"},
	})
	if err != nil {
		t.Fatalf("sync openrouter models: %v", err)
	}
	if result.Imported != 2 {
		t.Fatalf("expected 2 imported models, got %d", result.Imported)
	}

	models, err := svc.ListModels(ctx, false)
	if err != nil {
		t.Fatalf("list models: %v", err)
	}

	byProviderModelID := make(map[string]AIModel)
	for _, model := range models {
		byProviderModelID[model.ModelID] = model
	}

	existing := byProviderModelID["openai/gpt-oss-20b:free"]
	if existing.ID != "gpt-oss-20b-free" || !existing.IsActive {
		t.Fatalf("expected existing active seed model to be preserved, got %#v", existing)
	}
	imported := byProviderModelID["anthropic/claude-3.5-sonnet"]
	if imported.ID != "anthropic-claude-3-5-sonnet" {
		t.Fatalf("expected sanitized model id, got %#v", imported)
	}
	if imported.IsActive {
		t.Fatalf("expected new OpenRouter imports to be inactive by default")
	}
	if !imported.SupportsLiveSearch {
		t.Fatalf("expected tools support to be captured")
	}
	if _, ok := byProviderModelID["mistral/tiny-paid"]; ok {
		t.Fatalf("expected filtered model to be skipped")
	}
}

func TestFilterOpenRouterModelsUsesSupportedProvidersByDefault(t *testing.T) {
	models := []openRouterModelPayload{
		{ID: "openai/gpt-4o", Name: "OpenAI: GPT-4o"},
		{ID: "anthropic/claude-sonnet", Name: "Anthropic: Claude Sonnet"},
		{ID: "google/gemini-2.5-pro", Name: "Google: Gemini 2.5 Pro"},
		{ID: "perplexity/sonar", Name: "Perplexity: Sonar"},
		{ID: "qwen/qwen3", Name: "Qwen: Qwen3"},
		{ID: "deepseek/deepseek-chat", Name: "DeepSeek: Chat"},
		{ID: "mistralai/mistral-large", Name: "Mistral: Large"},
		{ID: "z-ai/glm-4.5", Name: "Z.ai: GLM 4.5"},
		{ID: "x-ai/grok-4", Name: "Grok: Grok 4"},
		{ID: "groq/llama-3.3", Name: "Groq: Llama 3.3"},
		{ID: "copilot/gpt-4.1", Name: "Copilot: GPT-4.1"},
		{ID: "meta-llama/llama-4", Name: "Meta: Llama 4"},
		{ID: "cohere/command-r", Name: "Cohere: Command R"},
	}

	filtered := filterOpenRouterModels(models, SyncOpenRouterModelsInput{})
	ids := make(map[string]bool, len(filtered))
	for _, model := range filtered {
		ids[model.ID] = true
	}

	for _, expectedID := range []string{
		"openai/gpt-4o",
		"anthropic/claude-sonnet",
		"google/gemini-2.5-pro",
		"perplexity/sonar",
		"qwen/qwen3",
		"deepseek/deepseek-chat",
		"mistralai/mistral-large",
		"z-ai/glm-4.5",
		"x-ai/grok-4",
		"groq/llama-3.3",
		"copilot/gpt-4.1",
		"meta-llama/llama-4",
	} {
		if !ids[expectedID] {
			t.Fatalf("expected provider whitelist to include %s", expectedID)
		}
	}
	if ids["cohere/command-r"] {
		t.Fatalf("expected unsupported provider to be excluded")
	}
}

func TestFilterOpenRouterModelsCanFilterByVariant(t *testing.T) {
	models := []openRouterModelPayload{
		{ID: "openai/gpt-4o", Name: "OpenAI: GPT-4o"},
		{ID: "mistralai/mixtral-8x7b-instruct", Name: "Mistral: Mixtral 8x7B Instruct"},
		{ID: "meta-llama/llama-3-8b-instruct", Name: "Meta: Llama 3 8B Instruct"},
	}

	instruct := filterOpenRouterModels(models, SyncOpenRouterModelsInput{Variant: "instruct"})
	if len(instruct) != 2 {
		t.Fatalf("expected 2 instruct models, got %d", len(instruct))
	}
	for _, model := range instruct {
		if !strings.Contains(strings.ToLower(model.ID), "instruct") {
			t.Fatalf("expected instruct model, got %#v", model)
		}
	}

	chat := filterOpenRouterModels(models, SyncOpenRouterModelsInput{Variant: "chat"})
	if len(chat) != 1 {
		t.Fatalf("expected 1 chat model, got %d", len(chat))
	}
	if chat[0].ID != "openai/gpt-4o" {
		t.Fatalf("expected chat model to stay, got %#v", chat[0])
	}
}

func TestSyncOpenRouterModelsCanPurgeUnsupportedImportedProviders(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	if _, err := svc.CreateModel(ctx, CreateAIModelInput{
		ID:                 "cohere-command-r",
		Label:              "Command R",
		Provider:           "cohere",
		Group:              "Cohere",
		IconKey:            "openrouter",
		ModelID:            "cohere/command-r",
		IsActive:           false,
		SupportsLiveSearch: true,
	}); err != nil {
		t.Fatalf("create unsupported imported model: %v", err)
	}
	if _, err := svc.CreateModel(ctx, CreateAIModelInput{
		ID:                 "z-ai-glm-4-5",
		Label:              "GLM 4.5",
		Provider:           "z-ai",
		Group:              "Z.ai",
		IconKey:            "zai",
		ModelID:            "z-ai/glm-4.5",
		IsActive:           false,
		SupportsLiveSearch: true,
	}); err != nil {
		t.Fatalf("create supported legacy provider model: %v", err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[]}`))
	}))
	defer server.Close()

	previousURL := openRouterModelsURL
	openRouterModelsURL = server.URL
	defer func() {
		openRouterModelsURL = previousURL
	}()

	result, err := svc.SyncOpenRouterModels(ctx, SyncOpenRouterModelsInput{
		PurgeUnsupportedProviders: true,
	})
	if err != nil {
		t.Fatalf("sync openrouter models: %v", err)
	}
	if result.Purged != 1 {
		t.Fatalf("expected 1 purged model, got %d", result.Purged)
	}

	models, err := svc.ListModels(ctx, false)
	if err != nil {
		t.Fatalf("list models: %v", err)
	}
	byID := make(map[string]AIModel, len(models))
	for _, model := range models {
		byID[model.ID] = model
	}
	if _, ok := byID["cohere-command-r"]; ok {
		t.Fatalf("expected unsupported imported provider to be purged")
	}
	if _, ok := byID["z-ai-glm-4-5"]; !ok {
		t.Fatalf("expected supported legacy provider alias to be kept")
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

func TestAssignProjectMemberListsMembers(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      1,
		Name:           "Project scoped",
		Domain:         "scoped.test",
		WebsiteURL:     "https://scoped.test",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	assigned, err := svc.AssignProjectMember(ctx, project.ID, 42, 99, "Viewer")
	if err != nil {
		t.Fatalf("assign project member: %v", err)
	}
	if assigned.ProjectID != project.ID {
		t.Fatalf("expected project id %s, got %q", project.ID, assigned.ProjectID)
	}
	if assigned.OrganizationID != 42 {
		t.Fatalf("expected organization 42, got %d", assigned.OrganizationID)
	}
	if assigned.UserID != 99 {
		t.Fatalf("expected user 99, got %d", assigned.UserID)
	}
	if assigned.Role != "viewer" {
		t.Fatalf("expected normalized role viewer, got %q", assigned.Role)
	}

	members, err := svc.ListProjectMembers(ctx, project.ID, 42)
	if err != nil {
		t.Fatalf("list project members: %v", err)
	}
	if len(members) != 1 {
		t.Fatalf("expected 1 project member, got %d", len(members))
	}
	if members[0].UserID != 99 {
		t.Fatalf("expected user 99 in project members, got %d", members[0].UserID)
	}
}

func TestAssignProjectMemberRejectsWrongOrganization(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      1,
		Name:           "Project scoped",
		Domain:         "scoped.test",
		WebsiteURL:     "https://scoped.test",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	_, err = svc.AssignProjectMember(ctx, project.ID, 7, 99, "viewer")
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected unauthorized error, got %v", err)
	}
}

func TestListProjectsForUserReturnsAssignedProjectsOnly(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	first, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      1,
		Name:           "Assigned",
		Domain:         "assigned.test",
		WebsiteURL:     "https://assigned.test",
	})
	if err != nil {
		t.Fatalf("create first project: %v", err)
	}
	second, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      1,
		Name:           "Hidden",
		Domain:         "hidden.test",
		WebsiteURL:     "https://hidden.test",
	})
	if err != nil {
		t.Fatalf("create second project: %v", err)
	}
	if _, err := svc.AssignProjectMember(ctx, first.ID, 42, 99, "viewer"); err != nil {
		t.Fatalf("assign project member: %v", err)
	}

	projects, err := svc.ListProjectsForUser(ctx, 42, 99)
	if err != nil {
		t.Fatalf("list projects for user: %v", err)
	}
	if len(projects) != 1 {
		t.Fatalf("expected 1 assigned project, got %d", len(projects))
	}
	if projects[0].ID != first.ID {
		t.Fatalf("expected project %s, got %s", first.ID, projects[0].ID)
	}
	if projects[0].ID == second.ID {
		t.Fatalf("project %s should not be visible to assigned user", second.ID)
	}
}

func TestSaveAndListLLMProviderCredentials(t *testing.T) {
	svc := NewService()
	ctx := context.Background()
	project := mustCreateCredentialProject(t, svc, ctx, 42)

	saved, err := svc.SaveLLMProviderCredential(ctx, project.ID, 42, "openai", "sk-test-123")
	if err != nil {
		t.Fatalf("save provider credential: %v", err)
	}
	if saved.ProjectID != project.ID {
		t.Fatalf("expected project %s, got %q", project.ID, saved.ProjectID)
	}
	if saved.Provider != "openai" {
		t.Fatalf("expected provider openai, got %q", saved.Provider)
	}
	if !saved.HasAPIKey {
		t.Fatalf("expected saved credential to be marked as configured")
	}

	credentials, err := svc.ListLLMProviderCredentials(ctx, project.ID, 42)
	if err != nil {
		t.Fatalf("list provider credentials: %v", err)
	}
	if len(credentials) != 1 {
		t.Fatalf("expected 1 provider credential, got %d", len(credentials))
	}
	if credentials[0].Provider != "openai" {
		t.Fatalf("expected openai provider, got %q", credentials[0].Provider)
	}
	if !credentials[0].HasAPIKey {
		t.Fatalf("expected credential to be marked as configured")
	}
}

func TestDeleteLLMProviderCredential(t *testing.T) {
	svc := NewService()
	ctx := context.Background()
	project := mustCreateCredentialProject(t, svc, ctx, 42)

	if _, err := svc.SaveLLMProviderCredential(ctx, project.ID, 42, "openai", "sk-test-123"); err != nil {
		t.Fatalf("save provider credential: %v", err)
	}
	if _, err := svc.DeleteLLMProviderCredential(ctx, project.ID, 42, "openai"); err != nil {
		t.Fatalf("delete provider credential: %v", err)
	}

	credentials, err := svc.ListLLMProviderCredentials(ctx, project.ID, 42)
	if err != nil {
		t.Fatalf("list provider credentials after delete: %v", err)
	}
	if len(credentials) != 0 {
		t.Fatalf("expected no provider credentials after delete, got %d", len(credentials))
	}
}

func TestSaveLLMProviderCredentialPersistsState(t *testing.T) {
	ctx := context.Background()
	store := &mutableProjectStore{}
	svc, err := NewServiceWithDependencies(ctx, Dependencies{Store: store})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}
	project := mustCreateCredentialProject(t, svc, ctx, 99)

	if _, err := svc.SaveLLMProviderCredential(ctx, project.ID, 99, "google", "sk-test-456"); err != nil {
		t.Fatalf("save provider credential: %v", err)
	}

	reloaded, err := NewServiceWithDependencies(ctx, Dependencies{Store: store})
	if err != nil {
		t.Fatalf("reload service: %v", err)
	}

	credentials, err := reloaded.ListLLMProviderCredentials(ctx, project.ID, 99)
	if err != nil {
		t.Fatalf("list provider credentials: %v", err)
	}
	if len(credentials) != 1 {
		t.Fatalf("expected 1 provider credential after reload, got %d", len(credentials))
	}
	if credentials[0].Provider != "google" {
		t.Fatalf("expected google provider after reload, got %q", credentials[0].Provider)
	}
}

func TestDeleteLLMProviderCredentialPersistsState(t *testing.T) {
	ctx := context.Background()
	store := &mutableProjectStore{}
	svc, err := NewServiceWithDependencies(ctx, Dependencies{Store: store})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}
	project := mustCreateCredentialProject(t, svc, ctx, 99)

	if _, err := svc.SaveLLMProviderCredential(ctx, project.ID, 99, "openai", "sk-test-789"); err != nil {
		t.Fatalf("save provider credential: %v", err)
	}
	if _, err := svc.DeleteLLMProviderCredential(ctx, project.ID, 99, "openai"); err != nil {
		t.Fatalf("delete provider credential: %v", err)
	}

	reloaded, err := NewServiceWithDependencies(ctx, Dependencies{Store: store})
	if err != nil {
		t.Fatalf("reload service: %v", err)
	}

	credentials, err := reloaded.ListLLMProviderCredentials(ctx, project.ID, 99)
	if err != nil {
		t.Fatalf("list provider credentials after reload: %v", err)
	}
	if len(credentials) != 0 {
		t.Fatalf("expected no provider credentials after reload, got %d", len(credentials))
	}
}

func mustCreateCredentialProject(t *testing.T, svc *Service, ctx context.Context, organizationID int64) Project {
	t.Helper()
	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: organizationID,
		CreatedBy:      7,
		Name:           "Credential Project",
		Domain:         "credentials.test",
		WebsiteURL:     "https://credentials.test",
		BrandName:      "Credentials",
	})
	if err != nil {
		t.Fatalf("create credential project: %v", err)
	}
	return project
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
