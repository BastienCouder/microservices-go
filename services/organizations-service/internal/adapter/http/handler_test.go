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

func (stubRepo) ListOrganizationsByUser(_ context.Context, _ int64) ([]domain.Membership, error) {
	return nil, nil
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

func TestGetOrganizationHierarchyReturnsProjects(t *testing.T) {
	svc := usecase.NewService(stubRepo{})
	svc.EnableProjectHierarchy(stubProjectLister{
		projects: []usecase.ProjectSummary{
			{
				ID:               "prj-1",
				OrganizationID:   1,
				Name:             "Acme Core",
				Status:           "active",
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
