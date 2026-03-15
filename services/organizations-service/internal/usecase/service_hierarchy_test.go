package usecase

import (
	"context"
	"testing"
	"time"
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
