package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
)

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

func TestProjectMembersRoutes(t *testing.T) {
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

	postReq := httptest.NewRequest(
		http.MethodPost,
		"/projects/"+project.ID+"/members",
		strings.NewReader(`{"userId":99,"role":"viewer"}`),
	)
	postReq.Header.Set("Content-Type", "application/json")
	postReq.Header.Set("X-Organization-ID", "42")
	postReq.Header.Set("X-Authenticated-User-ID", "7")
	postRec := httptest.NewRecorder()

	mux.ServeHTTP(postRec, postReq)
	if postRec.Code != http.StatusCreated {
		t.Fatalf("expected POST 201, got %d: %s", postRec.Code, postRec.Body.String())
	}

	getReq := httptest.NewRequest(http.MethodGet, "/projects/"+project.ID+"/members", nil)
	getReq.Header.Set("X-Organization-ID", "42")
	getRec := httptest.NewRecorder()

	mux.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("expected GET 200, got %d: %s", getRec.Code, getRec.Body.String())
	}
	var getResponse struct {
		Success bool                    `json:"success"`
		Data    []usecase.ProjectMember `json:"data"`
	}
	if err := json.Unmarshal(getRec.Body.Bytes(), &getResponse); err != nil {
		t.Fatalf("unmarshal GET response: %v", err)
	}
	if len(getResponse.Data) != 1 {
		t.Fatalf("expected 1 project member, got %d", len(getResponse.Data))
	}
	if getResponse.Data[0].UserID != 99 || getResponse.Data[0].Role != "viewer" {
		t.Fatalf("unexpected project member: %+v", getResponse.Data[0])
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/projects/"+project.ID+"/members/99", nil)
	deleteReq.Header.Set("X-Organization-ID", "42")
	deleteRec := httptest.NewRecorder()

	mux.ServeHTTP(deleteRec, deleteReq)
	if deleteRec.Code != http.StatusNoContent {
		t.Fatalf("expected DELETE 204, got %d: %s", deleteRec.Code, deleteRec.Body.String())
	}
}

func TestProjectMembersRoutesUseGatewayMemberPermissionWithoutProjectScope(t *testing.T) {
	svc := usecase.NewService()
	ctx := context.Background()
	assigned, err := svc.CreateProject(ctx, usecase.CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Assigned",
		Domain:         "assigned-members.test",
		WebsiteURL:     "https://assigned-members.test",
	})
	if err != nil {
		t.Fatalf("create assigned project: %v", err)
	}
	other, err := svc.CreateProject(ctx, usecase.CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Other",
		Domain:         "other-members.test",
		WebsiteURL:     "https://other-members.test",
	})
	if err != nil {
		t.Fatalf("create other project: %v", err)
	}
	if _, err := svc.AssignProjectMember(ctx, assigned.ID, 42, 99, "viewer"); err != nil {
		t.Fatalf("assign scoped project member: %v", err)
	}
	if _, err := svc.AssignProjectMember(ctx, other.ID, 42, 100, "viewer"); err != nil {
		t.Fatalf("assign other project member: %v", err)
	}

	handler := NewHandler(svc)
	mux := http.NewServeMux()
	handler.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/projects/"+other.ID+"/members", nil)
	req.Header.Set("X-Organization-ID", "42")
	req.Header.Set("X-Authenticated-User-ID", "99")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected gateway-authorized project members GET 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestProjectScopedUserCannotReadUnassignedProjectDirectly(t *testing.T) {
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
	if _, err := svc.AssignProjectMember(ctx, assigned.ID, 42, 99, "viewer"); err != nil {
		t.Fatalf("assign project member: %v", err)
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

	deniedReq := httptest.NewRequest(http.MethodGet, "/projects/"+other.ID, nil)
	deniedReq.Header.Set("X-Organization-ID", "42")
	deniedReq.Header.Set("X-Authenticated-User-ID", "99")
	deniedRec := httptest.NewRecorder()
	mux.ServeHTTP(deniedRec, deniedReq)
	if deniedRec.Code != http.StatusForbidden {
		t.Fatalf("expected unassigned project GET 403, got %d: %s", deniedRec.Code, deniedRec.Body.String())
	}
}

func TestProjectScopedUserCannotReadUnassignedProjectQueryRoute(t *testing.T) {
	svc := usecase.NewService()
	ctx := context.Background()
	assigned, err := svc.CreateProject(ctx, usecase.CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Assigned",
		Domain:         "assigned-query.test",
		WebsiteURL:     "https://assigned-query.test",
	})
	if err != nil {
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
	if _, err := svc.AssignProjectMember(ctx, assigned.ID, 42, 99, "viewer"); err != nil {
		t.Fatalf("assign project member: %v", err)
	}

	handler := NewHandler(svc)
	mux := http.NewServeMux()
	handler.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/projects/llm-provider-credentials?projectId="+other.ID, nil)
	req.Header.Set("X-Organization-ID", "42")
	req.Header.Set("X-Authenticated-User-ID", "99")
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected unassigned project credentials GET 403, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestProjectScopedUserCannotMutateUnassignedNestedResources(t *testing.T) {
	svc := usecase.NewService()
	ctx := context.Background()
	assigned, err := svc.CreateProject(ctx, usecase.CreateProjectInput{
		OrganizationID: 42,
		CreatedBy:      7,
		Name:           "Assigned",
		Domain:         "assigned-nested.test",
		WebsiteURL:     "https://assigned-nested.test",
	})
	if err != nil {
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
	if _, err := svc.AssignProjectMember(ctx, assigned.ID, 42, 99, "viewer"); err != nil {
		t.Fatalf("assign project member: %v", err)
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
	if promptRec.Code != http.StatusForbidden {
		t.Fatalf("expected unassigned prompt PATCH 403, got %d: %s", promptRec.Code, promptRec.Body.String())
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
	if competitorRec.Code != http.StatusForbidden {
		t.Fatalf("expected unassigned competitor PATCH 403, got %d: %s", competitorRec.Code, competitorRec.Body.String())
	}
}
