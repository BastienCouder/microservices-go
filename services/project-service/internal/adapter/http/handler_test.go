package http

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
)

type handlerTestGA4OAuthProvider struct {
	exchangeErr error
}

type handlerAnalysisClientSpy struct {
	startCalls  int
	recordCalls int
}

func (s *handlerAnalysisClientSpy) StartAnalysis(_ context.Context, req usecase.AnalysisStartRequest) (usecase.AnalysisStartResponse, error) {
	s.startCalls++
	promptRuns := make([]usecase.AnalysisPromptRun, 0, len(req.PromptTexts))
	for _, prompt := range req.PromptTexts {
		promptRuns = append(promptRuns, usecase.AnalysisPromptRun{
			ID:         prompt.ID + "-run",
			PromptID:   prompt.ID,
			PromptText: prompt.Text,
		})
	}
	return usecase.AnalysisStartResponse{RunID: "run-1", PromptRuns: promptRuns}, nil
}

func (s *handlerAnalysisClientSpy) RecordResponse(_ context.Context, _ string, _ usecase.AnalysisRecordResponseInput) error {
	s.recordCalls++
	return nil
}

func (s *handlerAnalysisClientSpy) IsAnalysisRunCancelled(_ context.Context, _ string, _ int64) (bool, error) {
	return false, nil
}

type handlerIAClientSpy struct {
	execCalls int
	result    usecase.IAExecutePromptResult
}

func (s *handlerIAClientSpy) ExecutePrompt(_ context.Context, _ usecase.IAExecutePromptInput) (usecase.IAExecutePromptResult, error) {
	s.execCalls++
	if strings.TrimSpace(s.result.RawResponse) != "" {
		return s.result, nil
	}
	var result usecase.IAExecutePromptResult
	result.RawResponse = "Acme est recommande https://acme.test"
	result.Analysis.BrandMentioned = true
	result.Analysis.BrandPosition = "top"
	result.Analysis.CitationFound = true
	result.Analysis.CitedURLs = []string{"https://acme.test"}
	result.Analysis.Sentiment = "positive"
	return result, nil
}

func (s *handlerIAClientSpy) ListModels(_ context.Context, onlyActive bool) ([]usecase.AIModel, error) {
	svc := usecase.NewService()
	return svc.ListModels(context.Background(), onlyActive)
}

func (p handlerTestGA4OAuthProvider) AuthorizationURL(state, redirectURI string) (string, error) {
	return "https://accounts.google.com/o/oauth2/v2/auth?state=" + state + "&redirect_uri=" + redirectURI, nil
}

func (p handlerTestGA4OAuthProvider) ExchangeCode(_ context.Context, _, _ string) (usecase.GA4OAuthToken, error) {
	if p.exchangeErr != nil {
		return usecase.GA4OAuthToken{}, p.exchangeErr
	}
	return usecase.GA4OAuthToken{RefreshToken: "refresh-token"}, nil
}

func (p handlerTestGA4OAuthProvider) ListProperties(_ context.Context, _ string) ([]usecase.GA4OAuthProperty, error) {
	return []usecase.GA4OAuthProperty{{PropertyID: "123456789", DisplayName: "Site France"}}, nil
}

func (p handlerTestGA4OAuthProvider) SetupLLMTracking(_ context.Context, _, _ string) (usecase.GA4LLMSetupResult, error) {
	return usecase.GA4LLMSetupResult{SetupStatus: usecase.GA4LLMSetupStatusSuccess}, nil
}

func (p handlerTestGA4OAuthProvider) SetupLLMTrackingWithServiceAccount(_ context.Context, _, _ string) (usecase.GA4LLMSetupResult, error) {
	return usecase.GA4LLMSetupResult{SetupStatus: usecase.GA4LLMSetupStatusSuccess}, nil
}

func TestLLMProviderCredentialsRoutes(t *testing.T) {
	svc := usecase.NewService()
	project, err := svc.CreateProject(context.Background(), usecase.CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Credential Project",
		Domain:         "credentials.test",
		WebsiteURL:     "https://credentials.test",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	handler := NewHandler(svc)
	mux := http.NewServeMux()
	handler.Register(mux)

	putReq := httptest.NewRequest(
		http.MethodPut,
		"/projects/"+project.ID+"/llm-provider-credentials/openai",
		strings.NewReader(`{"apiKey":"sk-test"}`),
	)
	putReq.Header.Set("Content-Type", "application/json")
	putReq.Header.Set("X-Organization-ID", "42")
	putRec := httptest.NewRecorder()

	mux.ServeHTTP(putRec, putReq)
	if putRec.Code != http.StatusOK {
		t.Fatalf("expected PUT 200, got %d: %s", putRec.Code, putRec.Body.String())
	}

	var putResponse struct {
		Success bool                                `json:"success"`
		Data    usecase.LLMProviderCredentialStatus `json:"data"`
	}
	if err := json.Unmarshal(putRec.Body.Bytes(), &putResponse); err != nil {
		t.Fatalf("unmarshal PUT response: %v", err)
	}
	if !putResponse.Success {
		t.Fatalf("expected success response")
	}
	if putResponse.Data.Provider != "openai" {
		t.Fatalf("expected openai provider, got %q", putResponse.Data.Provider)
	}
	if !putResponse.Data.HasAPIKey {
		t.Fatalf("expected PUT response to mark api key as configured")
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/projects/"+project.ID+"/llm-provider-credentials/openai", nil)
	deleteReq.Header.Set("X-Organization-ID", "42")
	deleteRec := httptest.NewRecorder()

	mux.ServeHTTP(deleteRec, deleteReq)
	if deleteRec.Code != http.StatusOK {
		t.Fatalf("expected DELETE 200, got %d: %s", deleteRec.Code, deleteRec.Body.String())
	}

	var deleteResponse struct {
		Success bool                                `json:"success"`
		Data    usecase.LLMProviderCredentialStatus `json:"data"`
	}
	if err := json.Unmarshal(deleteRec.Body.Bytes(), &deleteResponse); err != nil {
		t.Fatalf("unmarshal DELETE response: %v", err)
	}
	if !deleteResponse.Success {
		t.Fatalf("expected delete success response")
	}
	if deleteResponse.Data.Provider != "openai" {
		t.Fatalf("expected openai provider on delete, got %q", deleteResponse.Data.Provider)
	}
	if deleteResponse.Data.HasAPIKey {
		t.Fatalf("expected delete response to mark api key as removed")
	}

	getReq := httptest.NewRequest(http.MethodGet, "/projects/"+project.ID+"/llm-provider-credentials", nil)
	getReq.Header.Set("X-Organization-ID", "42")
	getRec := httptest.NewRecorder()

	mux.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("expected GET 200, got %d: %s", getRec.Code, getRec.Body.String())
	}

	var getResponse struct {
		Success bool                                  `json:"success"`
		Data    []usecase.LLMProviderCredentialStatus `json:"data"`
	}
	if err := json.Unmarshal(getRec.Body.Bytes(), &getResponse); err != nil {
		t.Fatalf("unmarshal GET response: %v", err)
	}
	if !getResponse.Success {
		t.Fatalf("expected success response")
	}
	if len(getResponse.Data) != 0 {
		t.Fatalf("expected no stored credentials after delete, got %d", len(getResponse.Data))
	}
}

func TestManualAnalysisRunRouteExecutesPrompt(t *testing.T) {
	ctx := context.Background()
	analysisSpy := &handlerAnalysisClientSpy{}
	iaSpy := &handlerIAClientSpy{}
	svc, err := usecase.NewServiceWithDependencies(ctx, usecase.Dependencies{
		AnalysisClient: analysisSpy,
		IAClient:       iaSpy,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}
	project, err := svc.CreateProject(ctx, usecase.CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Manual Analysis",
		Domain:         "manual.test",
		WebsiteURL:     "https://manual.test",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	prompts, err := svc.AddPrompts(ctx, project.ID, 42, []string{"Quel CRM recommander ?"})
	if err != nil {
		t.Fatalf("add prompts: %v", err)
	}
	if _, err := svc.SaveLLMProviderCredential(ctx, project.ID, 42, "openrouter", "sk-openrouter"); err != nil {
		t.Fatalf("save provider credential: %v", err)
	}

	handler := NewHandler(svc)
	mux := http.NewServeMux()
	handler.Register(mux)
	req := httptest.NewRequest(
		http.MethodPost,
		"/analysis/projects/"+project.ID+"/run",
		strings.NewReader(`{"requestId":"manual-route-1","promptTexts":[{"id":"`+prompts[0].ID+`","text":"`+prompts[0].Text+`"}],"modelIds":["gpt-oss-20b-free"],"runType":"manual"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Organization-ID", "42")
	req.Header.Set("X-Authenticated-User-ID", "7")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected POST 201, got %d: %s", rec.Code, rec.Body.String())
	}
	if analysisSpy.startCalls != 1 || iaSpy.execCalls != 1 || analysisSpy.recordCalls != 1 {
		t.Fatalf("expected full manual pipeline, got start=%d ia=%d record=%d", analysisSpy.startCalls, iaSpy.execCalls, analysisSpy.recordCalls)
	}
}

func TestGeneratePromptsRouteCreatesTenPrompts(t *testing.T) {
	ctx := context.Background()
	iaSpy := &handlerIAClientSpy{}
	svc, err := usecase.NewServiceWithDependencies(ctx, usecase.Dependencies{
		IAClient: iaSpy,
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}
	project, err := svc.CreateProject(ctx, usecase.CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Prompt Generator",
		Domain:         "generator.test",
		WebsiteURL:     "https://generator.test",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	if _, err := svc.SaveLLMProviderCredential(ctx, project.ID, 42, "openrouter", "sk-openrouter"); err != nil {
		t.Fatalf("save provider credential: %v", err)
	}

	iaSpy.execCalls = 0
	handler := NewHandler(svc)
	mux := http.NewServeMux()
	handler.Register(mux)

	req := httptest.NewRequest(http.MethodPost, "/projects/"+project.ID+"/prompts/generate", nil)
	req.Header.Set("X-Organization-ID", "42")
	rec := httptest.NewRecorder()

	iaSpy.result.RawResponse = `{"prompts":[
		"Prompt 1","Prompt 2","Prompt 3","Prompt 4","Prompt 5",
		"Prompt 6","Prompt 7","Prompt 8","Prompt 9","Prompt 10"
	]}`

	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected POST 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var response struct {
		Success bool             `json:"success"`
		Data    []usecase.Prompt `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !response.Success {
		t.Fatalf("expected success response")
	}
	if len(response.Data) != 10 {
		t.Fatalf("expected 10 generated prompts, got %d", len(response.Data))
	}
}

func TestGA4OAuthCallbackReturnsActionableInvalidGrantMessage(t *testing.T) {
	svc := usecase.NewService()
	svc.ConfigureGA4OAuth(
		handlerTestGA4OAuthProvider{exchangeErr: errors.New("google oauth error (400): invalid_grant")},
		"state-secret",
	)
	ctx := context.Background()
	project, err := svc.CreateProject(ctx, usecase.CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "GA4 OAuth Callback",
		Domain:         "oauth-callback.test",
		WebsiteURL:     "https://oauth-callback.test",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	start, err := svc.StartProjectGA4OAuth(ctx, project.ID, 42, usecase.StartProjectGA4OAuthInput{
		RedirectURI: "http://localhost:30004/traffic",
	})
	if err != nil {
		t.Fatalf("start ga4 oauth: %v", err)
	}

	handler := NewHandler(svc)
	mux := http.NewServeMux()
	handler.Register(mux)
	req := httptest.NewRequest(
		http.MethodPost,
		"/projects/"+project.ID+"/impact-integrations/ga4/oauth/callback",
		strings.NewReader(`{"code":"one-use-code","state":"`+start.State+`","redirectUri":"http://localhost:30004/traffic"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Organization-ID", "42")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected callback 503, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "a expiré ou a déjà été utilisée") {
		t.Fatalf("expected actionable invalid_grant error, got %s", rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), "exchange ga4 oauth code") || strings.Contains(rec.Body.String(), "invalid_grant") {
		t.Fatalf("expected response to hide dependency details, got %s", rec.Body.String())
	}
}

func TestGA4OAuthCallbackKeepsGenericMessageForOtherOAuthFailures(t *testing.T) {
	svc := usecase.NewService()
	svc.ConfigureGA4OAuth(
		handlerTestGA4OAuthProvider{exchangeErr: errors.New("google oauth error (500): backend failure")},
		"state-secret",
	)
	ctx := context.Background()
	project, err := svc.CreateProject(ctx, usecase.CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "GA4 OAuth Generic Callback",
		Domain:         "oauth-generic.test",
		WebsiteURL:     "https://oauth-generic.test",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	start, err := svc.StartProjectGA4OAuth(ctx, project.ID, 42, usecase.StartProjectGA4OAuthInput{
		RedirectURI: "http://localhost:30004/traffic",
	})
	if err != nil {
		t.Fatalf("start ga4 oauth: %v", err)
	}

	handler := NewHandler(svc)
	mux := http.NewServeMux()
	handler.Register(mux)
	req := httptest.NewRequest(
		http.MethodPost,
		"/projects/"+project.ID+"/impact-integrations/ga4/oauth/callback",
		strings.NewReader(`{"code":"one-use-code","state":"`+start.State+`","redirectUri":"http://localhost:30004/traffic"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Organization-ID", "42")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected callback 503, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "Connexion Google Analytics momentanément indisponible") {
		t.Fatalf("expected generic GA4 error, got %s", rec.Body.String())
	}
}

func TestProjectMembersRoutesAreOwnedByOrganizationsService(t *testing.T) {
	svc := usecase.NewService()
	project, err := svc.CreateProject(context.Background(), usecase.CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Project Members",
		Domain:         "members.test",
		WebsiteURL:     "https://members.test",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	handler := NewHandler(svc)
	mux := http.NewServeMux()
	handler.Register(mux)

	for _, method := range []string{http.MethodGet, http.MethodPost, http.MethodDelete} {
		path := "/projects/" + project.ID + "/members"
		if method == http.MethodDelete {
			path += "/99"
		}
		req := httptest.NewRequest(method, path, strings.NewReader(`{"userId":99,"role":"viewer"}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Organization-ID", "42")
		req.Header.Set("X-Authenticated-User-ID", "7")
		req.Header.Set("X-Organization-Full-Access", "true")
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("expected %s %s to be 404, got %d: %s", method, path, rec.Code, rec.Body.String())
		}
	}
}

func TestActivateProjectRouteIsRemoved(t *testing.T) {
	svc := usecase.NewService()
	project, err := svc.CreateProject(context.Background(), usecase.CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Removed Activation",
		Domain:         "activation.test",
		WebsiteURL:     "https://activation.test",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	handler := NewHandler(svc)
	mux := http.NewServeMux()
	handler.Register(mux)

	req := httptest.NewRequest(http.MethodPost, "/projects/"+project.ID+"/activate", nil)
	req.Header.Set("X-Organization-ID", "42")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected activate route 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestProjectRouteAuthorizationIsExpectedToBeHandledUpstream(t *testing.T) {
	svc := usecase.NewService()
	ctx := context.Background()
	assigned, err := svc.CreateProject(ctx, usecase.CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Assigned",
		Domain:         "assigned.test",
		WebsiteURL:     "https://assigned.test",
	})
	if err != nil {
		t.Fatalf("create assigned project: %v", err)
	}
	other, err := svc.CreateProject(ctx, usecase.CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Other",
		Domain:         "other.test",
		WebsiteURL:     "https://other.test",
	})
	if err != nil {
		t.Fatalf("create other project: %v", err)
	}

	handler := NewHandler(svc)
	mux := http.NewServeMux()
	handler.Register(mux)

	allowedReq := httptest.NewRequest(http.MethodGet, "/projects/"+assigned.ID, nil)
	allowedReq.Header.Set("X-Organization-ID", "42")
	allowedReq.Header.Set("X-Authenticated-User-ID", "99")
	allowedRec := httptest.NewRecorder()
	mux.ServeHTTP(allowedRec, allowedReq)
	if allowedRec.Code != http.StatusOK {
		t.Fatalf("expected assigned project GET 200, got %d: %s", allowedRec.Code, allowedRec.Body.String())
	}

	directReq := httptest.NewRequest(http.MethodGet, "/projects/"+other.ID, nil)
	directReq.Header.Set("X-Organization-ID", "42")
	directReq.Header.Set("X-Authenticated-User-ID", "99")
	directRec := httptest.NewRecorder()
	mux.ServeHTTP(directRec, directReq)
	if directRec.Code != http.StatusOK {
		t.Fatalf("expected direct project GET 200 when gateway checks are bypassed, got %d: %s", directRec.Code, directRec.Body.String())
	}
}

func TestProjectQueryRouteAuthorizationIsExpectedToBeHandledUpstream(t *testing.T) {
	svc := usecase.NewService()
	ctx := context.Background()
	if _, err := svc.CreateProject(ctx, usecase.CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Assigned",
		Domain:         "assigned-query.test",
		WebsiteURL:     "https://assigned-query.test",
	}); err != nil {
		t.Fatalf("create assigned project: %v", err)
	}
	other, err := svc.CreateProject(ctx, usecase.CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Other",
		Domain:         "other-query.test",
		WebsiteURL:     "https://other-query.test",
	})
	if err != nil {
		t.Fatalf("create other project: %v", err)
	}

	handler := NewHandler(svc)
	mux := http.NewServeMux()
	handler.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/projects/llm-provider-credentials?projectId="+other.ID, nil)
	req.Header.Set("X-Organization-ID", "42")
	req.Header.Set("X-Authenticated-User-ID", "99")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected direct project credentials GET 200 when gateway checks are bypassed, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestOrganizationFullAccessBypassesProjectScopeGuard(t *testing.T) {
	svc := usecase.NewService()
	ctx := context.Background()
	if _, err := svc.CreateProject(ctx, usecase.CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Assigned",
		Domain:         "assigned-admin.test",
		WebsiteURL:     "https://assigned-admin.test",
	}); err != nil {
		t.Fatalf("create assigned project: %v", err)
	}
	other, err := svc.CreateProject(ctx, usecase.CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Other",
		Domain:         "other-admin.test",
		WebsiteURL:     "https://other-admin.test",
	})
	if err != nil {
		t.Fatalf("create other project: %v", err)
	}

	handler := NewHandler(svc)
	mux := http.NewServeMux()
	handler.Register(mux)

	req := httptest.NewRequest(http.MethodDelete, "/projects/"+other.ID, nil)
	req.Header.Set("X-Organization-ID", "42")
	req.Header.Set("X-Authenticated-User-ID", "99")
	req.Header.Set("X-Organization-Full-Access", "true")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected full access DELETE 204, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestNestedResourceAuthorizationIsExpectedToBeHandledUpstream(t *testing.T) {
	svc := usecase.NewService()
	ctx := context.Background()
	if _, err := svc.CreateProject(ctx, usecase.CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Assigned",
		Domain:         "assigned-nested.test",
		WebsiteURL:     "https://assigned-nested.test",
	}); err != nil {
		t.Fatalf("create assigned project: %v", err)
	}
	other, err := svc.CreateProject(ctx, usecase.CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Other",
		Domain:         "other-nested.test",
		WebsiteURL:     "https://other-nested.test",
	})
	if err != nil {
		t.Fatalf("create other project: %v", err)
	}
	prompts, err := svc.AddPrompts(ctx, other.ID, 42, []string{"Unassigned prompt"})
	if err != nil {
		t.Fatalf("add prompt: %v", err)
	}
	competitors, err := svc.AddCompetitors(ctx, other.ID, 42, []usecase.AddCompetitorInput{{Name: "Competitor"}})
	if err != nil {
		t.Fatalf("add competitor: %v", err)
	}

	handler := NewHandler(svc)
	mux := http.NewServeMux()
	handler.Register(mux)

	promptReq := httptest.NewRequest(
		http.MethodPatch,
		"/prompts/"+prompts[0].ID,
		strings.NewReader(`{"text":"stolen"}`),
	)
	promptReq.Header.Set("Content-Type", "application/json")
	promptReq.Header.Set("X-Organization-ID", "42")
	promptReq.Header.Set("X-Authenticated-User-ID", "99")
	promptRec := httptest.NewRecorder()
	mux.ServeHTTP(promptRec, promptReq)
	if promptRec.Code != http.StatusOK {
		t.Fatalf("expected direct prompt PATCH 200 when gateway checks are bypassed, got %d: %s", promptRec.Code, promptRec.Body.String())
	}

	competitorReq := httptest.NewRequest(
		http.MethodPatch,
		"/competitors/"+competitors[0].ID,
		strings.NewReader(`{"name":"stolen"}`),
	)
	competitorReq.Header.Set("Content-Type", "application/json")
	competitorReq.Header.Set("X-Organization-ID", "42")
	competitorReq.Header.Set("X-Authenticated-User-ID", "99")
	competitorRec := httptest.NewRecorder()
	mux.ServeHTTP(competitorRec, competitorReq)
	if competitorRec.Code != http.StatusOK {
		t.Fatalf("expected direct competitor PATCH 200 when gateway checks are bypassed, got %d: %s", competitorRec.Code, competitorRec.Body.String())
	}
}
