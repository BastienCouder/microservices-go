package usecase

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"regexp"
	"strings"
	"testing"
	"time"
)

type mutableProjectStore struct {
	payload []byte
}

type fakeBillingClient struct {
	entitlements BillingEntitlements
	creditCosts  CreditCostSettings
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

func (f *fakeBillingClient) GetCreditCostSettings(_ context.Context) (CreditCostSettings, error) {
	if f.err != nil {
		return CreditCostSettings{}, f.err
	}
	if f.creditCosts.DefaultCreditCost <= 0 {
		return defaultCreditCostSettings(), nil
	}
	return f.creditCosts, nil
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
	if matched := regexp.MustCompile(`^prj_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`).MatchString(project.ID); !matched {
		t.Fatalf("expected UUID-like project id, got %q", project.ID)
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
	encoded, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("marshal project: %v", err)
	}
	if strings.Contains(string(encoded), "status") {
		t.Fatalf("expected project json to omit status, got %s", string(encoded))
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

func TestCreateProjectRejectsWhenPlanProjectLimitIsReached(t *testing.T) {
	svc, err := NewServiceWithDependencies(context.Background(), Dependencies{
		BillingClient: &fakeBillingClient{
			entitlements: BillingEntitlements{
				Plan:        "starter",
				MaxProjects: 1,
			},
		},
	})
	if err != nil {
		t.Fatalf("new service with dependencies: %v", err)
	}
	ctx := context.Background()

	if _, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Project one",
		Domain:         "one.test",
		WebsiteURL:     "https://one.test",
	}); err != nil {
		t.Fatalf("create first project: %v", err)
	}

	if _, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Project two",
		Domain:         "two.test",
		WebsiteURL:     "https://two.test",
	}); err == nil || !strings.Contains(err.Error(), "allows up to 1 projects") {
		t.Fatalf("expected project limit error, got %v", err)
	}
}

func TestUpdateProjectCanRenameProject(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Old name",
		Domain:         "acme.com",
		WebsiteURL:     "https://acme.com",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	name := " New name "
	updated, err := svc.UpdateProject(ctx, project.ID, 42, UpdateProjectInput{
		Name: &name,
	})
	if err != nil {
		t.Fatalf("update project: %v", err)
	}
	if updated.Name != "New name" {
		t.Fatalf("expected trimmed project name, got %q", updated.Name)
	}
}

func TestDeleteProjectRemovesProjectAndRelatedState(t *testing.T) {
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
	if _, err := svc.AddPrompts(ctx, project.ID, 42, []string{"Quel CRM pour PME ?"}); err != nil {
		t.Fatalf("add prompts: %v", err)
	}
	if _, err := svc.AddCompetitors(ctx, project.ID, 42, []AddCompetitorInput{{Name: "Rival"}}); err != nil {
		t.Fatalf("add competitors: %v", err)
	}
	if _, err := svc.AssignProjectMember(ctx, project.ID, 42, 99, "viewer"); err != nil {
		t.Fatalf("assign member: %v", err)
	}

	if err := svc.DeleteProject(ctx, project.ID, 42); err != nil {
		t.Fatalf("delete project: %v", err)
	}
	if _, err := svc.GetProject(ctx, project.ID, 42); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected project not found, got %v", err)
	}
	if _, ok := svc.projectModels[project.ID]; ok {
		t.Fatalf("expected project models to be removed")
	}
	if _, ok := svc.projectMembers[project.ID]; ok {
		t.Fatalf("expected project members to be removed")
	}
	for _, prompt := range svc.prompts {
		if prompt.ProjectID == project.ID {
			t.Fatalf("expected project prompts to be removed")
		}
	}
	for _, competitor := range svc.competitors {
		if competitor.ProjectID == project.ID {
			t.Fatalf("expected project competitors to be removed")
		}
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

func TestReplaceProjectModelsPrunesStalePromptScheduleOverrides(t *testing.T) {
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
		Cron:     "0 */6 * * *",
		Timezone: "UTC",
		ModelCrons: map[string]string{
			"gemma-3-27b-free": "15 */6 * * *",
		},
	}
	if _, err := svc.UpdatePrompt(ctx, prompts[0].ID, 42, UpdatePromptInput{Schedule: &schedule}); err != nil {
		t.Fatalf("update prompt schedule: %v", err)
	}

	result, err := svc.ReplaceProjectModels(ctx, project.ID, 42, []string{"gpt-oss-120b-free"})
	if err != nil {
		t.Fatalf("replace project models should prune stale schedule overrides: %v", err)
	}

	if !reflect.DeepEqual(result.ModelIDs, []string{"gpt-oss-120b-free"}) {
		t.Fatalf("expected modelIds [gpt-oss-120b-free], got %#v", result.ModelIDs)
	}

	page, err := svc.ListPrompts(ctx, project.ID, 42, ListPromptsInput{})
	if err != nil {
		t.Fatalf("list prompts: %v", err)
	}
	if len(page.Items) != 1 {
		t.Fatalf("expected 1 prompt, got %d", len(page.Items))
	}
	if len(page.Items[0].Schedule.ModelCrons) != 0 {
		t.Fatalf("expected stale schedule overrides to be pruned, got %#v", page.Items[0].Schedule.ModelCrons)
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

type fakeGA4OAuthProvider struct {
	exchangeToken           GA4OAuthToken
	properties              []GA4OAuthProperty
	listCalls               int
	setupResult             GA4LLMSetupResult
	setupErr                error
	setupCalls              int
	setupRefresh            string
	setupProperty           string
	setupServiceAccountJSON string
}

func (p *fakeGA4OAuthProvider) AuthorizationURL(state, redirectURI string) (string, error) {
	return "https://accounts.google.com/o/oauth2/v2/auth?state=" + state + "&redirect_uri=" + redirectURI, nil
}

func (p *fakeGA4OAuthProvider) ExchangeCode(_ context.Context, code, redirectURI string) (GA4OAuthToken, error) {
	if code == "" || redirectURI == "" {
		return GA4OAuthToken{}, errors.New("missing code or redirect uri")
	}
	return p.exchangeToken, nil
}

func (p *fakeGA4OAuthProvider) ListProperties(_ context.Context, refreshToken string) ([]GA4OAuthProperty, error) {
	p.listCalls++
	if refreshToken == "" {
		return nil, errors.New("missing refresh token")
	}
	return p.properties, nil
}

func (p *fakeGA4OAuthProvider) SetupLLMTracking(_ context.Context, refreshToken, propertyID string) (GA4LLMSetupResult, error) {
	p.setupCalls++
	p.setupRefresh = refreshToken
	p.setupProperty = propertyID
	if p.setupErr != nil {
		return GA4LLMSetupResult{}, p.setupErr
	}
	return p.setupResult, nil
}

func (p *fakeGA4OAuthProvider) SetupLLMTrackingWithServiceAccount(_ context.Context, serviceAccountJSON, propertyID string) (GA4LLMSetupResult, error) {
	p.setupCalls++
	p.setupServiceAccountJSON = serviceAccountJSON
	p.setupProperty = propertyID
	if p.setupErr != nil {
		return GA4LLMSetupResult{}, p.setupErr
	}
	return p.setupResult, nil
}

func TestGA4OAuthConnectsDirectlyWithProvidedProjectProperty(t *testing.T) {
	svc := NewService()
	provider := &fakeGA4OAuthProvider{
		exchangeToken: GA4OAuthToken{RefreshToken: "refresh_token_123"},
		setupResult:   GA4LLMSetupResult{SetupStatus: GA4LLMSetupStatusSuccess},
		properties: []GA4OAuthProperty{
			{PropertyID: "123456789", DisplayName: "Site France"},
			{PropertyID: "987654321", DisplayName: "Site Europe"},
		},
	}
	svc.ConfigureGA4OAuth(provider, "state-secret")
	ctx := context.Background()
	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "GA4 OAuth Project",
		Domain:         "oauth.test",
		WebsiteURL:     "https://oauth.test",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	start, err := svc.StartProjectGA4OAuth(ctx, project.ID, 42, StartProjectGA4OAuthInput{
		RedirectURI: "http://localhost:30006/traffic",
	})
	if err != nil {
		t.Fatalf("start ga4 oauth: %v", err)
	}
	if start.AuthorizationURL == "" || start.State == "" {
		t.Fatalf("expected authorization url and state, got %+v", start)
	}

	callback, err := svc.CompleteProjectGA4OAuth(ctx, project.ID, 42, CompleteProjectGA4OAuthInput{
		Code:        "auth-code",
		State:       start.State,
		RedirectURI: "http://localhost:30006/traffic",
		PropertyID:  "123456789",
	})
	if err != nil {
		t.Fatalf("complete ga4 oauth: %v", err)
	}
	if provider.listCalls != 0 {
		t.Fatalf("expected direct property callback to skip property listing, got %d calls", provider.listCalls)
	}
	if callback.Integration.GA4.AuthMode != "oauth" || !callback.Integration.GA4.HasOAuthToken {
		t.Fatalf("expected oauth integration after callback, got %+v", callback.Integration.GA4)
	}
	if callback.Integration.GA4.PropertyID != "123456789" || !callback.Integration.GA4.IsConnected {
		t.Fatalf("expected oauth integration to connect selected property, got %+v", callback.Integration.GA4)
	}
	if provider.setupCalls != 1 {
		t.Fatalf("expected direct property callback to run llm setup once, got %d calls", provider.setupCalls)
	}
	if provider.setupRefresh != "refresh_token_123" || provider.setupProperty != "123456789" {
		t.Fatalf("expected llm setup to use selected oauth property, got refresh=%q property=%q", provider.setupRefresh, provider.setupProperty)
	}
	if callback.LLMSetup.SetupStatus != GA4LLMSetupStatusSuccess {
		t.Fatalf("expected llm setup result to be returned, got %+v", callback.LLMSetup)
	}
}

func TestSelectProjectGA4OAuthPropertyRunsLLMSetup(t *testing.T) {
	svc := NewService()
	provider := &fakeGA4OAuthProvider{
		exchangeToken: GA4OAuthToken{RefreshToken: "refresh_token_123"},
		setupResult: GA4LLMSetupResult{
			SetupStatus: GA4LLMSetupStatusSuccess,
			CreatedResources: GA4LLMSetupResources{
				ChannelGroupName:    "properties/123/channelGroups/456",
				CustomDimensionName: "properties/123/customDimensions/789",
			},
		},
		properties: []GA4OAuthProperty{
			{PropertyID: "123456789", DisplayName: "Site France"},
		},
	}
	svc.ConfigureGA4OAuth(provider, "state-secret")
	ctx := context.Background()
	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "GA4 OAuth Project",
		Domain:         "oauth.test",
		WebsiteURL:     "https://oauth.test",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	start, err := svc.StartProjectGA4OAuth(ctx, project.ID, 42, StartProjectGA4OAuthInput{
		RedirectURI: "http://localhost:30006/traffic",
	})
	if err != nil {
		t.Fatalf("start ga4 oauth: %v", err)
	}
	if _, err := svc.CompleteProjectGA4OAuth(ctx, project.ID, 42, CompleteProjectGA4OAuthInput{
		Code:        "auth-code",
		State:       start.State,
		RedirectURI: "http://localhost:30006/traffic",
	}); err != nil {
		t.Fatalf("complete ga4 oauth: %v", err)
	}
	if provider.setupCalls != 0 {
		t.Fatalf("expected setup to wait for property selection, got %d calls", provider.setupCalls)
	}

	selected, err := svc.SelectProjectGA4OAuthProperty(ctx, project.ID, 42, SelectProjectGA4OAuthPropertyInput{
		PropertyID: "123456789",
	})
	if err != nil {
		t.Fatalf("select ga4 property: %v", err)
	}
	if provider.setupCalls != 1 {
		t.Fatalf("expected property selection to run llm setup once, got %d calls", provider.setupCalls)
	}
	if selected.Integration.GA4.PropertyID != "123456789" || !selected.Integration.GA4.IsConnected {
		t.Fatalf("expected selected property integration, got %+v", selected.Integration.GA4)
	}
	if selected.LLMSetup.CreatedResources.CustomDimensionName != "properties/123/customDimensions/789" {
		t.Fatalf("expected llm setup resources in response, got %+v", selected.LLMSetup)
	}
}

func TestUpdateProjectImpactIntegrationsRunsLLMSetupForServiceAccount(t *testing.T) {
	svc := NewService()
	provider := &fakeGA4OAuthProvider{
		setupResult: GA4LLMSetupResult{
			SetupStatus: GA4LLMSetupStatusSuccess,
			CreatedResources: GA4LLMSetupResources{
				ChannelGroupName:    "properties/123/channelGroups/456",
				CustomDimensionName: "properties/123/customDimensions/789",
			},
		},
	}
	svc.ConfigureGA4LLMSetup(provider)
	ctx := context.Background()
	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "GA4 Service Account Project",
		Domain:         "service-account.test",
		WebsiteURL:     "https://service-account.test",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	serviceAccountJSON := `{"client_email":"ga4@example.iam.gserviceaccount.com","private_key":"-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----"}`
	propertyID := "123456789"
	updated, err := svc.UpdateProjectImpactIntegrations(ctx, project.ID, 42, UpdateProjectImpactIntegrationsInput{
		GA4: &UpdateProjectGA4IntegrationInput{
			PropertyID:         &propertyID,
			ServiceAccountJSON: &serviceAccountJSON,
		},
	})
	if err != nil {
		t.Fatalf("update project impact integrations: %v", err)
	}
	if provider.setupCalls != 1 {
		t.Fatalf("expected service account setup to run once, got %d calls", provider.setupCalls)
	}
	if provider.setupServiceAccountJSON != serviceAccountJSON {
		t.Fatalf("expected setup to receive service account json, got %q", provider.setupServiceAccountJSON)
	}
	if provider.setupProperty != propertyID {
		t.Fatalf("expected setup to receive property %q, got %q", propertyID, provider.setupProperty)
	}
	if updated.Integration.GA4.AuthMode != "service_account" || !updated.Integration.GA4.IsConnected {
		t.Fatalf("expected service account integration to stay connected, got %+v", updated.Integration.GA4)
	}
	if updated.LLMSetup.CreatedResources.ChannelGroupName != "properties/123/channelGroups/456" {
		t.Fatalf("expected llm setup resources in response, got %+v", updated.LLMSetup)
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
					"pricing": {"input": "0.000005", "output": "0.000025"},
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
	if imported.CreditCost != 2 {
		t.Fatalf("expected credit cost 2, got %d", imported.CreditCost)
	}
	if imported.InputPricePerMillion == nil || imported.OutputPricePerMillion == nil || *imported.InputPricePerMillion != 5 || *imported.OutputPricePerMillion != 25 {
		t.Fatalf("expected input/output prices 5/25, got %v/%v", imported.InputPricePerMillion, imported.OutputPricePerMillion)
	}
	if imported.OpenRouterPricing["input"] != "0.000005" || imported.OpenRouterPricing["output"] != "0.000025" {
		t.Fatalf("expected raw OpenRouter pricing to be preserved, got %#v", imported.OpenRouterPricing)
	}
	if _, ok := byProviderModelID["mistral/tiny-paid"]; ok {
		t.Fatalf("expected filtered model to be skipped")
	}
}

func TestOpenRouterCreditCostFromPricingUsesInputPricePerMillion(t *testing.T) {
	tests := []struct {
		name    string
		pricing map[string]any
		want    int
	}{
		{
			name:    "free models still cost the minimum credit",
			pricing: map[string]any{"input": "0", "output": "0"},
			want:    1,
		},
		{
			name:    "medium priced models cost one credit",
			pricing: map[string]any{"input": "0.000004", "output": "0.000020"},
			want:    1,
		},
		{
			name:    "high priced five dollar models cost two credits",
			pricing: map[string]any{"input": "0.000005", "output": "0.000025"},
			want:    2,
		},
		{
			name:    "premium models cost three credits",
			pricing: map[string]any{"input": "0.000012"},
			want:    3,
		},
		{
			name:    "ultra premium models cost four credits",
			pricing: map[string]any{"input": "0.000022"},
			want:    4,
		},
		{
			name:    "legacy prompt price is a fallback when input price is missing",
			pricing: map[string]any{"prompt": "0.000006"},
			want:    2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := openRouterCreditCostFromPricing(tt.pricing, defaultCreditCostSettings()); got != tt.want {
				t.Fatalf("expected %d credits, got %d", tt.want, got)
			}
		})
	}
}

func TestOpenRouterCreditCostFromPricingUsesBillingThresholds(t *testing.T) {
	settings := CreditCostSettings{
		DefaultCreditCost: 1,
		Rules: []CreditCostRule{
			{MinPricePerMillion: 8, CreditCost: 5},
			{MinPricePerMillion: 3, CreditCost: 2},
		},
	}

	if got := openRouterCreditCostFromPricing(map[string]any{"input": "0.000005"}, settings); got != 2 {
		t.Fatalf("expected 2 credits for $5 / 1M, got %d", got)
	}
	if got := openRouterCreditCostFromPricing(map[string]any{"input": "0.000009"}, settings); got != 5 {
		t.Fatalf("expected 5 credits for $9 / 1M, got %d", got)
	}
}

func TestOpenRouterPricingPerMillionCapturesInputAndOutput(t *testing.T) {
	inputPrice, outputPrice := openRouterPricingPerMillion(map[string]any{
		"input":  "0.000005",
		"output": "0.000025",
	})

	if inputPrice == nil || *inputPrice != 5 {
		t.Fatalf("expected input price 5, got %v", inputPrice)
	}
	if outputPrice == nil || *outputPrice != 25 {
		t.Fatalf("expected output price 25, got %v", outputPrice)
	}
}

func TestLoadNormalizesStaleDefaultModelProviderIDs(t *testing.T) {
	ctx := context.Background()
	state := persistedState{
		Models: map[string]AIModel{
			"gemma-3-4b-free": {
				ID:       "gemma-3-4b-free",
				Label:    "Gemma 3 4B (free)",
				Provider: "google",
				Group:    "gemma",
				ModelID:  "google/gemma-3-4b-it:free",
				IsActive: true,
			},
			"gemma-3-27b-free": {
				ID:       "gemma-3-27b-free",
				Label:    "Gemma 3 27B (free)",
				Provider: "google",
				Group:    "gemma",
				ModelID:  "google/gemma-3-27b-it:free",
				IsActive: true,
			},
		},
		ProjectModels: map[string]map[string]bool{},
	}
	payload, err := json.Marshal(state)
	if err != nil {
		t.Fatalf("marshal state: %v", err)
	}
	store := &mutableProjectStore{payload: payload}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{Store: store})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	models, err := svc.ListModels(ctx, false)
	if err != nil {
		t.Fatalf("list models: %v", err)
	}
	byID := make(map[string]AIModel, len(models))
	for _, model := range models {
		byID[model.ID] = model
	}

	if got := byID["gemma-3-4b-free"].ModelID; got != "google/gemma-3-4b-it" {
		t.Fatalf("expected gemma 4b provider model to be normalized, got %q", got)
	}
	if got := byID["gemma-3-27b-free"].ModelID; got != "google/gemma-3-27b-it" {
		t.Fatalf("expected gemma 27b provider model to be normalized, got %q", got)
	}
}

func TestLoadMigratesLegacyGemmaModelsToCanonicalImportWhenPresent(t *testing.T) {
	ctx := context.Background()
	state := persistedState{
		Models: map[string]AIModel{
			"gemma-3-4b-free": {
				ID:       "gemma-3-4b-free",
				Label:    "Gemma 3 4B (free)",
				Provider: "google",
				Group:    "gemma",
				ModelID:  "google/gemma-3-4b-it:free",
				IsActive: true,
			},
			"google-gemma-3-4b-it": {
				ID:       "google-gemma-3-4b-it",
				Label:    "Gemma 3 4B",
				Provider: "google",
				Group:    "gemma",
				ModelID:  "google/gemma-3-4b-it",
				IsActive: false,
			},
		},
		Projects: map[string]*Project{
			"prj-1": {
				ID:             "prj-1",
				OrganizationID: 42,
				CreatedBy:      7,
				Name:           "Acme",
				Domain:         "acme.com",
				WebsiteURL:     "https://acme.com",
			},
		},
		ProjectModels: map[string]map[string]bool{
			"prj-1": {"gemma-3-4b-free": true},
		},
		Prompts: map[string]*Prompt{
			"prm-1": {
				ID:        "prm-1",
				ProjectID: "prj-1",
				Text:      "Q1",
				ModelIDs:  []string{"gemma-3-4b-free"},
				Schedule: PromptSchedule{
					Mode:       PromptScheduleModePerModel,
					Cron:       "0 9 * * 1",
					Timezone:   "UTC",
					ModelCrons: map[string]string{"gemma-3-4b-free": "15 9 * * 1"},
				},
				Status:   PromptStatusActive,
				IsActive: true,
			},
		},
	}
	payload, err := json.Marshal(state)
	if err != nil {
		t.Fatalf("marshal state: %v", err)
	}
	store := &mutableProjectStore{payload: payload}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{Store: store})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	models, err := svc.ListModels(ctx, false)
	if err != nil {
		t.Fatalf("list models: %v", err)
	}
	byID := make(map[string]AIModel, len(models))
	for _, model := range models {
		byID[model.ID] = model
	}

	if _, exists := byID["gemma-3-4b-free"]; exists {
		t.Fatalf("expected legacy gemma model to be removed after migration")
	}
	if got := byID["google-gemma-3-4b-it"].ModelID; got != "google/gemma-3-4b-it" {
		t.Fatalf("expected canonical gemma provider model id to remain canonical, got %q", got)
	}

	projectModels, err := svc.ListProjectModels(ctx, "prj-1", 42)
	if err != nil {
		t.Fatalf("list project models: %v", err)
	}
	foundEnabledCanonical := false
	for _, selection := range projectModels {
		if selection.ID == "google-gemma-3-4b-it" && selection.IsEnabledForProject {
			foundEnabledCanonical = true
		}
		if selection.ID == "gemma-3-4b-free" && selection.IsEnabledForProject {
			t.Fatalf("expected legacy gemma model to be removed from project selection")
		}
	}
	if !foundEnabledCanonical {
		t.Fatalf("expected canonical gemma model to be enabled for project after migration")
	}

	page, err := svc.ListPrompts(ctx, "prj-1", 42, ListPromptsInput{})
	if err != nil {
		t.Fatalf("list prompts: %v", err)
	}
	if len(page.Items) != 1 {
		t.Fatalf("expected 1 prompt, got %d", len(page.Items))
	}
	if len(page.Items[0].ModelIDs) != 1 || page.Items[0].ModelIDs[0] != "google-gemma-3-4b-it" {
		t.Fatalf("expected prompt model ids to migrate to canonical gemma model, got %#v", page.Items[0].ModelIDs)
	}
	if _, exists := page.Items[0].Schedule.ModelCrons["gemma-3-4b-free"]; exists {
		t.Fatalf("expected legacy gemma prompt schedule to be removed")
	}
	if got := page.Items[0].Schedule.ModelCrons["google-gemma-3-4b-it"]; got != "15 9 * * 1" {
		t.Fatalf("expected canonical gemma prompt schedule to be preserved, got %q", got)
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

func TestFilterOpenRouterModelsCanFilterFreeModels(t *testing.T) {
	models := []openRouterModelPayload{
		{
			ID:      "google/gemma-3-4b-it:free",
			Name:    "Google: Gemma 3 4B (free)",
			Pricing: map[string]any{"prompt": "0", "completion": "0"},
		},
		{
			ID:      "openai/gpt-oss-20b:free",
			Name:    "OpenAI: gpt-oss-20b (free)",
			Pricing: map[string]any{"prompt": "0.000000", "completion": "0.000000"},
		},
		{
			ID:      "anthropic/claude-3.5-sonnet",
			Name:    "Anthropic: Claude 3.5 Sonnet",
			Pricing: map[string]any{"prompt": "0.000003", "completion": "0.000015"},
		},
	}

	filtered := filterOpenRouterModels(models, SyncOpenRouterModelsInput{OnlyFree: true})
	if len(filtered) != 2 {
		t.Fatalf("expected 2 free models, got %d", len(filtered))
	}
	if filtered[0].ID != "google/gemma-3-4b-it:free" {
		t.Fatalf("expected first free model to stay, got %#v", filtered[0])
	}
	if filtered[1].ID != "openai/gpt-oss-20b:free" {
		t.Fatalf("expected second free model to stay, got %#v", filtered[1])
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

func TestSyncOpenRouterModelsCanPurgeMissingImportedModels(t *testing.T) {
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
		t.Fatalf("create imported model: %v", err)
	}
	if _, err := svc.ReplaceProjectModels(ctx, project.ID, 42, []string{"openai-gpt-4o-mini"}); err != nil {
		t.Fatalf("replace project models: %v", err)
	}
	prompts, err := svc.AddPrompts(ctx, project.ID, 42, []string{"Q1"})
	if err != nil {
		t.Fatalf("add prompts: %v", err)
	}
	modelIDs := []string{"openai-gpt-4o-mini"}
	schedule := PromptSchedule{
		Mode:       PromptScheduleModePerModel,
		Cron:       "0 9 * * 1",
		Timezone:   "UTC",
		ModelCrons: map[string]string{"openai-gpt-4o-mini": "15 9 * * 1"},
	}
	if _, err := svc.UpdatePrompt(ctx, prompts[0].ID, 42, UpdatePromptInput{ModelIDs: &modelIDs, Schedule: &schedule}); err != nil {
		t.Fatalf("update prompt: %v", err)
	}
	if _, err := svc.CreateModel(ctx, CreateAIModelInput{
		ID:                 "manual-curated-model",
		Label:              "Manual Curated",
		Provider:           "openai",
		Group:              "OpenAI",
		IconKey:            "openai",
		ModelID:            "openai/manual-curated-model",
		IsActive:           false,
		SupportsLiveSearch: false,
	}); err != nil {
		t.Fatalf("create manual model: %v", err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"data": [
				{
					"id": "openai/gpt-5",
					"name": "OpenAI: GPT-5",
					"context_length": 200000,
					"pricing": {"prompt": "0.00001"},
					"supported_parameters": ["tools"]
				}
			]
		}`))
	}))
	defer server.Close()

	previousURL := openRouterModelsURL
	openRouterModelsURL = server.URL
	defer func() {
		openRouterModelsURL = previousURL
	}()

	result, err := svc.SyncOpenRouterModels(ctx, SyncOpenRouterModelsInput{
		PurgeMissingModels: true,
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
	if _, ok := byID["openai-gpt-4o-mini"]; ok {
		t.Fatalf("expected missing imported model to be purged")
	}
	if _, ok := byID["manual-curated-model"]; !ok {
		t.Fatalf("expected manual model to be kept")
	}
	projectModels, err := svc.ListProjectModels(ctx, project.ID, 42)
	if err != nil {
		t.Fatalf("list project models: %v", err)
	}
	for _, selection := range projectModels {
		if selection.IsEnabledForProject {
			t.Fatalf("expected project model selection to be pruned, got enabled model %#v", selection)
		}
	}
	page, err := svc.ListPrompts(ctx, project.ID, 42, ListPromptsInput{})
	if err != nil {
		t.Fatalf("list prompts: %v", err)
	}
	if len(page.Items) != 1 {
		t.Fatalf("expected 1 prompt, got %d", len(page.Items))
	}
	updatedPrompt := page.Items[0]
	if len(updatedPrompt.ModelIDs) != 0 {
		t.Fatalf("expected prompt model ids to be pruned, got %#v", updatedPrompt.ModelIDs)
	}
	if len(updatedPrompt.Schedule.ModelCrons) != 0 {
		t.Fatalf("expected prompt model schedules to be pruned, got %#v", updatedPrompt.Schedule.ModelCrons)
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

func TestProjectMemberRolesControlProjectActions(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      1,
		Name:           "Role scoped",
		Domain:         "role-scoped.test",
		WebsiteURL:     "https://role-scoped.test",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	if err := svc.EnforceUserProjectActionAccess(ctx, project.ID, 42, 100, "read"); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected missing membership to deny read, got %v", err)
	}
	if _, err := svc.AssignProjectMember(ctx, project.ID, 42, 99, "viewer"); err != nil {
		t.Fatalf("assign viewer: %v", err)
	}
	if err := svc.EnforceUserProjectActionAccess(ctx, project.ID, 42, 99, "read"); err != nil {
		t.Fatalf("viewer should read assigned project: %v", err)
	}
	if err := svc.EnforceUserProjectActionAccess(ctx, project.ID, 42, 99, "update"); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected viewer update denied, got %v", err)
	}

	if _, err := svc.AssignProjectMember(ctx, project.ID, 42, 98, "editor"); err != nil {
		t.Fatalf("assign editor: %v", err)
	}
	if err := svc.EnforceUserProjectActionAccess(ctx, project.ID, 42, 98, "delete"); err != nil {
		t.Fatalf("editor should mutate assigned project: %v", err)
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

func TestUpdatePromptModelIDsPrunesStaleScheduleOverrides(t *testing.T) {
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

	if _, err := svc.ReplaceProjectModels(ctx, project.ID, 42, []string{"gemma-3-27b-free", "gpt-oss-120b-free"}); err != nil {
		t.Fatalf("replace project models: %v", err)
	}

	prompts, err := svc.AddPrompts(ctx, project.ID, 42, []string{"Prompt one"})
	if err != nil {
		t.Fatalf("add prompts: %v", err)
	}

	schedule := PromptSchedule{
		Mode:     PromptScheduleModePerModel,
		Cron:     "0 */6 * * *",
		Timezone: "UTC",
		ModelCrons: map[string]string{
			"gemma-3-27b-free": "15 */6 * * *",
		},
	}
	if _, err := svc.UpdatePrompt(ctx, prompts[0].ID, 42, UpdatePromptInput{Schedule: &schedule}); err != nil {
		t.Fatalf("update prompt schedule: %v", err)
	}

	modelIDs := []string{"gpt-oss-120b-free"}
	updated, err := svc.UpdatePrompt(ctx, prompts[0].ID, 42, UpdatePromptInput{ModelIDs: &modelIDs})
	if err != nil {
		t.Fatalf("update prompt models: %v", err)
	}

	if !reflect.DeepEqual(updated.ModelIDs, []string{"gpt-oss-120b-free"}) {
		t.Fatalf("expected modelIds [gpt-oss-120b-free], got %#v", updated.ModelIDs)
	}
	if len(updated.Schedule.ModelCrons) != 0 {
		t.Fatalf("expected stale model overrides to be pruned, got %#v", updated.Schedule.ModelCrons)
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
