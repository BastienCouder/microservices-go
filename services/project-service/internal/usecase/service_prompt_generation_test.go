package usecase

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"
)

type promptGenerationIAClientSpy struct {
	result IAExecutePromptResult
	err    error
	inputs []IAExecutePromptInput
}

func (s *promptGenerationIAClientSpy) ExecutePrompt(_ context.Context, input IAExecutePromptInput) (IAExecutePromptResult, error) {
	s.inputs = append(s.inputs, input)
	if s.err != nil {
		return IAExecutePromptResult{}, s.err
	}
	return s.result, nil
}

func TestParseGeneratedPromptTextsAcceptsJSONArrayInCodeFence(t *testing.T) {
	raw := "```json\n[\"Prompt 1\", \"Prompt 2\", \"Prompt 3\", \"Prompt 4\", \"Prompt 5\", \"Prompt 6\", \"Prompt 7\", \"Prompt 8\", \"Prompt 9\", \"Prompt 10\"]\n```"

	got, err := parseGeneratedPromptTexts(raw, 10)
	if err != nil {
		t.Fatalf("parse generated prompts: %v", err)
	}

	expected := []string{
		"Prompt 1", "Prompt 2", "Prompt 3", "Prompt 4", "Prompt 5",
		"Prompt 6", "Prompt 7", "Prompt 8", "Prompt 9", "Prompt 10",
	}
	if !reflect.DeepEqual(got, expected) {
		t.Fatalf("expected %#v, got %#v", expected, got)
	}
}

func TestGenerateMonitoringPromptsCreatesTenPromptsWithOpenRouterModel(t *testing.T) {
	ctx := context.Background()
	iaSpy := &promptGenerationIAClientSpy{
		result: IAExecutePromptResult{
			RawResponse: `{"prompts":[
				"Prompt 1","Prompt 2","Prompt 3","Prompt 4","Prompt 5",
				"Prompt 6","Prompt 7","Prompt 8","Prompt 9","Prompt 10"
			]}`,
		},
	}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{IAClient: iaSpy})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}

	project, err := svc.CreateProject(ctx, CreateProjectInput{
		OrganizationID:    42,
		CreatedBy:         7,
		Name:              "Acme",
		Domain:            "acme.com",
		WebsiteURL:        "https://acme.com",
		BrandName:         "Acme",
		BrandDescription: "CRM analytics platform",
		Industry:          "B2B SaaS",
		PrimaryLanguage: "fr",
		Country:           "FR",
		AttributionSource: "organic search",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	if _, err := svc.SaveLLMProviderCredential(ctx, project.ID, 42, "openrouter", "sk-openrouter"); err != nil {
		t.Fatalf("save openrouter credential: %v", err)
	}
	if _, err := svc.AddCompetitors(ctx, project.ID, 42, []AddCompetitorInput{
		{Name: "HubSpot"},
		{Name: "Salesforce"},
	}); err != nil {
		t.Fatalf("add competitors: %v", err)
	}

	prompts, err := svc.GenerateMonitoringPrompts(ctx, project.ID, 42)
	if err != nil {
		t.Fatalf("generate monitoring prompts: %v", err)
	}

	if len(prompts) != 10 {
		t.Fatalf("expected 10 prompts, got %d", len(prompts))
	}
	if len(iaSpy.inputs) != 1 {
		t.Fatalf("expected one IA call, got %d", len(iaSpy.inputs))
	}
	if iaSpy.inputs[0].ProviderID != "openrouter" {
		t.Fatalf("expected provider openrouter, got %q", iaSpy.inputs[0].ProviderID)
	}
	if iaSpy.inputs[0].ModelID != "openai/gpt-oss-120b:free" {
		t.Fatalf("expected openrouter model openai/gpt-oss-120b:free, got %q", iaSpy.inputs[0].ModelID)
	}
	if iaSpy.inputs[0].ProviderAPIKey != "sk-openrouter" {
		t.Fatalf("expected openrouter API key, got %q", iaSpy.inputs[0].ProviderAPIKey)
	}
	if iaSpy.inputs[0].BrandName != "" {
		t.Fatalf("expected empty brand name in generation request, got %q", iaSpy.inputs[0].BrandName)
	}
	if len(iaSpy.inputs[0].Competitors) != 0 {
		t.Fatalf("expected no competitor names in generation request, got %#v", iaSpy.inputs[0].Competitors)
	}
	instruction := iaSpy.inputs[0].PromptText
	for _, forbidden := range []string{"Acme", "HubSpot", "Salesforce"} {
		if strings.Contains(instruction, forbidden) {
			t.Fatalf("generation instruction should not include %q, got %q", forbidden, instruction)
		}
	}
	for _, expected := range []string{
		"Do not mention the brand, company name, product name, website, or any competitor name",
		"Each prompt must sound like a real user asking for help in this sector.",
		"Adapt the prompts to the brand identity, positioning, offer, and target customer described in the context.",
		"Primary language: fr",
		"Primary market country: FR",
		"Acquisition or attribution focus: organic-search",
	} {
		if !strings.Contains(instruction, expected) {
			t.Fatalf("generation instruction should include %q, got %q", expected, instruction)
		}
	}
	page, err := svc.ListPrompts(ctx, project.ID, 42, ListPromptsInput{PageSize: 20})
	if err != nil {
		t.Fatalf("list prompts: %v", err)
	}
	if len(page.Items) != 10 {
		t.Fatalf("expected 10 persisted prompts, got %d", len(page.Items))
	}
}

func TestGenerateMonitoringPromptsRejectsInvalidModelOutput(t *testing.T) {
	ctx := context.Background()
	iaSpy := &promptGenerationIAClientSpy{
		result: IAExecutePromptResult{
			RawResponse: `{"prompts":["Prompt 1","Prompt 2"]}`,
		},
	}

	svc, err := NewServiceWithDependencies(ctx, Dependencies{IAClient: iaSpy})
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

	_, err = svc.GenerateMonitoringPrompts(ctx, project.ID, 42)
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected validation error, got %v", err)
	}
}
