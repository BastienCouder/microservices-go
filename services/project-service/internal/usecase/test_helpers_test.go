package usecase

import (
	"context"
	"testing"
)

func mustUpdateBrandCanon(
	t *testing.T,
	ctx context.Context,
	svc *Service,
	projectID string,
	organizationID int64,
	brandName string,
	category string,
	positioning string,
) {
	t.Helper()

	input := UpdateBrandCanonInput{}
	if brandName != "" {
		input.BrandName = &brandName
	}
	if category != "" {
		input.Category = &category
	}
	if positioning != "" {
		input.Positioning = &positioning
	}

	if _, err := svc.UpdateBrandCanon(ctx, projectID, organizationID, input); err != nil {
		t.Fatalf("update brand canon: %v", err)
	}
}
