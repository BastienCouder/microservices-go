package http

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/domain"
	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/usecase"
)

type stubRepo struct{}

func (stubRepo) Create(_ context.Context, organization *domain.Organization) error {
	organization.ID = 1
	return nil
}

func (stubRepo) GetByID(_ context.Context, id int64) (*domain.Organization, error) {
	if id <= 0 {
		return nil, domain.ErrOrganizationNotFound
	}
	return &domain.Organization{ID: id, Name: "Acme", OwnerIdentityID: 7, CreatedAt: time.Now().UTC()}, nil
}

func (stubRepo) UpdateName(_ context.Context, id int64, name string) (*domain.Organization, error) {
	if id <= 0 {
		return nil, domain.ErrOrganizationNotFound
	}
	return &domain.Organization{ID: id, Name: name, OwnerIdentityID: 7, CreatedAt: time.Now().UTC()}, nil
}

func (stubRepo) DeleteOrganization(_ context.Context, organizationID int64, _ time.Time) error {
	if organizationID <= 0 {
		return domain.ErrOrganizationNotFound
	}
	return nil
}

func (stubRepo) ListOrganizationsByUser(_ context.Context, _ int64) ([]domain.Membership, error) {
	return nil, nil
}

func (stubRepo) CreateAPIKey(_ context.Context, key *domain.OrganizationAPIKey) error {
	key.ID = 1
	return nil
}

func (stubRepo) ListAPIKeys(_ context.Context, organizationID int64) ([]domain.OrganizationAPIKey, error) {
	return []domain.OrganizationAPIKey{
		{
			ID:             1,
			OrganizationID: organizationID,
			Name:           "Production",
			Prefix:         "org_12345678",
			CreatedAt:      time.Now().UTC(),
		},
	}, nil
}

func (stubRepo) RevokeAPIKey(_ context.Context, organizationID, keyID int64, _ time.Time) error {
	if organizationID <= 0 || keyID <= 0 {
		return domain.ErrOrganizationNotFound
	}
	return nil
}

func (stubRepo) CreateTeam(_ context.Context, team *domain.Team) error {
	team.ID = 1
	return nil
}

func (stubRepo) ListTeams(_ context.Context, _ int64) ([]domain.Team, error) {
	return nil, nil
}

func (stubRepo) UpsertMember(_ context.Context, _ *domain.Member) error {
	return nil
}

func (stubRepo) ListMembers(_ context.Context, organizationID int64) ([]domain.Member, error) {
	return []domain.Member{
		{OrganizationID: organizationID, UserID: 42, Roles: []string{"member"}, AddedAt: time.Now().UTC()},
	}, nil
}

func (stubRepo) UpdateMemberTeam(_ context.Context, organizationID, userID, teamID int64) (*domain.Member, error) {
	if organizationID <= 0 || userID <= 0 {
		return nil, domain.ErrInvalidMember
	}
	return &domain.Member{
		OrganizationID: organizationID,
		UserID:         userID,
		TeamID:         teamID,
		Roles:          []string{"member"},
		AddedAt:        time.Now().UTC(),
	}, nil
}

func (stubRepo) AssignRole(_ context.Context, organizationID, userID int64, role string) (*domain.Member, error) {
	if organizationID <= 0 || userID <= 0 {
		return nil, domain.ErrInvalidMember
	}
	return &domain.Member{
		OrganizationID: organizationID,
		UserID:         userID,
		Roles:          []string{"member", role},
		AddedAt:        time.Now().UTC(),
	}, nil
}

func (stubRepo) UpdateMemberRoles(_ context.Context, organizationID, userID int64, roles []string) (*domain.Member, error) {
	if organizationID <= 0 || userID <= 0 {
		return nil, domain.ErrInvalidMember
	}
	return &domain.Member{
		OrganizationID: organizationID,
		UserID:         userID,
		Roles:          append([]string(nil), roles...),
		AddedAt:        time.Now().UTC(),
	}, nil
}

func (stubRepo) RemoveMember(_ context.Context, organizationID, userID int64, _ time.Time) error {
	if organizationID <= 0 || userID <= 0 {
		return domain.ErrInvalidMember
	}
	return nil
}

func (stubRepo) CreateInvitation(_ context.Context, invitation *domain.Invitation) error {
	invitation.ID = 1
	return nil
}

func (stubRepo) ListInvitations(_ context.Context, _ int64) ([]domain.Invitation, error) {
	return nil, nil
}

func (stubRepo) GetInvitationByID(_ context.Context, _, _ int64) (*domain.Invitation, error) {
	return nil, domain.ErrInvitationNotFound
}

func (stubRepo) GetInvitationByToken(_ context.Context, _ string) (*domain.Invitation, error) {
	return nil, domain.ErrInvitationNotFound
}

func (stubRepo) UpdateInvitation(_ context.Context, _ *domain.Invitation) (*domain.Invitation, error) {
	return nil, domain.ErrInvitationNotFound
}

func (stubRepo) DeleteInvitation(_ context.Context, _, _ int64) error {
	return nil
}

func (stubRepo) AcceptInvitationByToken(_ context.Context, _ string, _ int64, _ time.Time) (*domain.Invitation, *domain.Member, error) {
	return nil, nil, domain.ErrInvitationNotFound
}

func (stubRepo) RefuseInvitationByToken(_ context.Context, _ string, _ int64, _ time.Time) (*domain.Invitation, error) {
	return nil, domain.ErrInvitationNotFound
}

type stubProjectLister struct {
	projects []usecase.ProjectSummary
	err      error
}

func (s stubProjectLister) ListProjectsByOrganization(_ context.Context, organizationID int64) ([]usecase.ProjectSummary, error) {
	if s.err != nil {
		return nil, s.err
	}
	out := make([]usecase.ProjectSummary, 0, len(s.projects))
	for _, project := range s.projects {
		if project.OrganizationID == organizationID {
			out = append(out, project)
		}
	}
	return out, nil
}

func newTestHandler() *Handler {
	svc := usecase.NewService(stubRepo{})
	return NewHandler(svc, nil)
}

func TestOrganizationRoutesRejectMismatchedScopedOrganization(t *testing.T) {
	h := newTestHandler()

	req := httptest.NewRequest(http.MethodGet, "/organizations/2", nil)
	req.Header.Set("X-Organization-ID", "1")
	resp := httptest.NewRecorder()

	h.organizationRoutes(resp, req)

	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.Code)
	}
}

func TestAssignRoleAllowsTargetUserDifferentFromCaller(t *testing.T) {
	h := newTestHandler()

	body, err := json.Marshal(map[string]string{"role": "admin"})
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/organizations/1/members/42/roles", bytes.NewReader(body))
	req.Header.Set("X-Authenticated-User-ID", "7")
	resp := httptest.NewRecorder()

	h.assignRole(resp, req, 1, 42)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
}

func TestMemberActionRoutes(t *testing.T) {
	tests := []struct {
		name   string
		method string
		path   string
		body   any
		want   int
	}{
		{
			name:   "update roles",
			method: http.MethodPatch,
			path:   "/organizations/1/members/42",
			body:   map[string][]string{"roles": []string{"admin", "editor"}},
			want:   http.StatusOK,
		},
		{
			name:   "ban member",
			method: http.MethodPost,
			path:   "/organizations/1/members/42/ban",
			want:   http.StatusNotFound,
		},
		{
			name:   "unban member",
			method: http.MethodPost,
			path:   "/organizations/1/members/42/unban",
			want:   http.StatusNotFound,
		},
		{
			name:   "remove member",
			method: http.MethodDelete,
			path:   "/organizations/1/members/42",
			want:   http.StatusNoContent,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := newTestHandler()
			var body bytes.Buffer
			if tt.body != nil {
				if err := json.NewEncoder(&body).Encode(tt.body); err != nil {
					t.Fatalf("encode body: %v", err)
				}
			}
			req := httptest.NewRequest(tt.method, tt.path, &body)
			req.Header.Set("X-Authenticated-User-ID", "7")
			req.Header.Set("X-Organization-ID", "1")
			resp := httptest.NewRecorder()

			h.organizationRoutes(resp, req)

			if resp.Code != tt.want {
				t.Fatalf("expected %d, got %d body=%s", tt.want, resp.Code, resp.Body.String())
			}
		})
	}
}

func TestDeleteOrganizationRoute(t *testing.T) {
	h := newTestHandler()

	req := httptest.NewRequest(http.MethodDelete, "/organizations/1", nil)
	req.Header.Set("X-Authenticated-User-ID", "7")
	req.Header.Set("X-Organization-ID", "1")
	resp := httptest.NewRecorder()

	h.organizationRoutes(resp, req)

	if resp.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d body=%s", resp.Code, resp.Body.String())
	}
}

func TestGetOrganizationHierarchyReturnsProjects(t *testing.T) {
	svc := usecase.NewService(stubRepo{})
	svc.EnableProjectHierarchy(stubProjectLister{
		projects: []usecase.ProjectSummary{
			{
				ID:               "prj-1",
				OrganizationID:   1,
				Name:             "Acme Core",
				BrandName:        "Acme",
				BrandDescription: "Acme brand",
			},
		},
	})
	h := NewHandler(svc, nil)

	req := httptest.NewRequest(http.MethodGet, "/organizations/1/hierarchy", nil)
	req.Header.Set("X-Organization-ID", "1")
	resp := httptest.NewRecorder()

	h.organizationRoutes(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}

	var payload struct {
		Projects []usecase.ProjectSummary `json:"projects"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(payload.Projects) != 1 {
		t.Fatalf("expected 1 project, got %d", len(payload.Projects))
	}
}

func TestGetOrganizationHierarchyPropagatesErrors(t *testing.T) {
	svc := usecase.NewService(stubRepo{})
	svc.EnableProjectHierarchy(stubProjectLister{err: errors.New("boom")})
	h := NewHandler(svc, nil)

	req := httptest.NewRequest(http.MethodGet, "/organizations/1/hierarchy", nil)
	req.Header.Set("X-Organization-ID", "1")
	resp := httptest.NewRecorder()

	h.organizationRoutes(resp, req)

	if resp.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", resp.Code)
	}
}
