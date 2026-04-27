package usecase

import (
	"context"
	"testing"
	"time"

	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/domain"
)

type fakeProjectLister struct {
	projects []ProjectSummary
}

func (f fakeProjectLister) ListProjectsByOrganization(_ context.Context, organizationID int64) ([]ProjectSummary, error) {
	out := make([]ProjectSummary, 0, len(f.projects))
	for _, project := range f.projects {
		if project.OrganizationID == organizationID {
			out = append(out, project)
		}
	}
	return out, nil
}

func (f fakeProjectLister) ListProjectsByOrganizationForUser(_ context.Context, organizationID, userID int64) ([]ProjectSummary, error) {
	out := make([]ProjectSummary, 0, len(f.projects))
	for _, project := range f.projects {
		if project.OrganizationID == organizationID && project.ID == "prj-user" && userID == 42 {
			out = append(out, project)
		}
	}
	return out, nil
}

func TestGetOrganizationHierarchyIncludesProjects(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	svc.EnableProjectHierarchy(fakeProjectLister{
		projects: []ProjectSummary{
			{
				ID:                "prj-1",
				OrganizationID:    1,
				Name:              "Acme Core",
				Status:            "active",
				BrandName:         "Acme",
				BrandDescription:  "Acme brand",
				AttributionSource: "google",
				CreatedAt:         time.Date(2026, 3, 15, 10, 0, 0, 0, time.UTC),
			},
		},
	})

	org, err := svc.CreateOrganization(context.Background(), "Acme", 7)
	if err != nil {
		t.Fatalf("create organization: %v", err)
	}

	hierarchy, err := svc.GetOrganizationHierarchy(context.Background(), org.ID)
	if err != nil {
		t.Fatalf("get organization hierarchy: %v", err)
	}
	if hierarchy.Organization.ID != org.ID {
		t.Fatalf("expected organization id %d, got %d", org.ID, hierarchy.Organization.ID)
	}
	if len(hierarchy.Projects) != 1 {
		t.Fatalf("expected 1 project, got %d", len(hierarchy.Projects))
	}
	if hierarchy.Projects[0].BrandName != "Acme" {
		t.Fatalf("expected brand name Acme, got %q", hierarchy.Projects[0].BrandName)
	}
}

func TestGetOrganizationHierarchyForUserUsesProjectScopedListing(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	svc.EnableProjectHierarchy(fakeProjectLister{
		projects: []ProjectSummary{
			{ID: "prj-user", OrganizationID: 1, Name: "Visible", Status: "active"},
			{ID: "prj-other", OrganizationID: 1, Name: "Hidden", Status: "active"},
		},
	})

	org, err := svc.CreateOrganization(context.Background(), "Acme", 7)
	if err != nil {
		t.Fatalf("create organization: %v", err)
	}

	hierarchy, err := svc.GetOrganizationHierarchyForUser(context.Background(), org.ID, 42)
	if err != nil {
		t.Fatalf("get user hierarchy: %v", err)
	}
	if len(hierarchy.Projects) != 1 {
		t.Fatalf("expected 1 scoped project, got %d", len(hierarchy.Projects))
	}
	if hierarchy.Projects[0].ID != "prj-user" {
		t.Fatalf("expected prj-user, got %s", hierarchy.Projects[0].ID)
	}
}

func TestGetOrganizationHierarchyForAdminUserIncludesAllProjects(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	svc.EnableProjectHierarchy(fakeProjectLister{
		projects: []ProjectSummary{
			{ID: "prj-user", OrganizationID: 1, Name: "Visible", Status: "active"},
			{ID: "prj-other", OrganizationID: 1, Name: "Also visible", Status: "active"},
		},
	})

	org, err := svc.CreateOrganization(context.Background(), "Acme", 7)
	if err != nil {
		t.Fatalf("create organization: %v", err)
	}
	repo.members[[2]int64{org.ID, 42}] = domain.Member{
		OrganizationID: org.ID,
		UserID:         42,
		Roles:          []string{"admin"},
		AddedAt:        time.Now().UTC(),
	}

	hierarchy, err := svc.GetOrganizationHierarchyForUser(context.Background(), org.ID, 42)
	if err != nil {
		t.Fatalf("get admin hierarchy: %v", err)
	}
	if len(hierarchy.Projects) != 2 {
		t.Fatalf("expected all projects for admin, got %d", len(hierarchy.Projects))
	}
}

func TestGetOrganizationHierarchyForOwnerUserIncludesAllProjectsEvenWithoutMemberRole(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	svc.EnableProjectHierarchy(fakeProjectLister{
		projects: []ProjectSummary{
			{ID: "prj-user", OrganizationID: 1, Name: "Visible", Status: "active"},
			{ID: "prj-other", OrganizationID: 1, Name: "Also visible", Status: "active"},
		},
	})

	org, err := svc.CreateOrganization(context.Background(), "Acme", 42)
	if err != nil {
		t.Fatalf("create organization: %v", err)
	}

	hierarchy, err := svc.GetOrganizationHierarchyForUser(context.Background(), org.ID, 42)
	if err != nil {
		t.Fatalf("get owner hierarchy: %v", err)
	}
	if len(hierarchy.Projects) != 2 {
		t.Fatalf("expected all projects for owner, got %d", len(hierarchy.Projects))
	}
}
