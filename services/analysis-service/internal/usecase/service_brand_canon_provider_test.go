package usecase

import (
	"context"
	"testing"
)

type staticProjectBrandCanonProvider struct {
	canon BrandCanon
}

func (provider staticProjectBrandCanonProvider) GetProjectBrandCanon(
	_ context.Context,
	projectID string,
	_ int64,
) (BrandCanon, error) {
	canon := provider.canon
	canon.ProjectID = projectID
	return canon, nil
}

func TestGetBrandCanonUsesProjectServiceAsSourceOfTruth(t *testing.T) {
	svc, err := NewServiceWithDependencies(context.Background(), Dependencies{
		ProjectBrandCanon: staticProjectBrandCanonProvider{canon: BrandCanon{
			BrandName:   "Nike",
			Category:    "Sportswear",
			Positioning: "Performance et lifestyle",
			UseCases:    []string{"Running"},
			Features:    []string{"Performance innovation"},
		}},
	})
	if err != nil {
		t.Fatalf("create service: %v", err)
	}

	canon, err := svc.GetBrandCanon(context.Background(), "project-nike", 42)
	if err != nil {
		t.Fatalf("get brand canon: %v", err)
	}
	if canon.ProjectID != "project-nike" || canon.BrandName != "Nike" {
		t.Fatalf("unexpected project brand canon: %+v", canon)
	}
}
