package usecase

import (
	"context"
	"fmt"
	"strings"
)

func (s *Service) GetBrandCanon(ctx context.Context, projectID string, organizationID int64) (BrandCanon, error) {
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return BrandCanon{}, err
	}
	if s.projectBrandCanon != nil {
		return s.projectBrandCanon.GetProjectBrandCanon(ctx, projectID, organizationID)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return BrandCanon{}, err
	}

	if canon, ok := s.brandCanonByProject[projectID]; ok {
		result := copyBrandCanon(canon)
		result.ProjectID = projectID
		return result, nil
	}

	return BrandCanon{
		ProjectID: projectID,
		Audience:  []string{},
		UseCases:  []string{},
		Features:  []string{},
	}, nil
}

func (s *Service) UpdateBrandCanon(ctx context.Context, projectID string, organizationID int64, input UpdateBrandCanonInput) (BrandCanon, error) {
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return BrandCanon{}, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return BrandCanon{}, err
	}

	now := s.now().UTC()
	current, ok := s.brandCanonByProject[projectID]
	if !ok {
		current = &BrandCanon{
			ProjectID: projectID,
			Audience:  []string{},
			UseCases:  []string{},
			Features:  []string{},
			CreatedAt: now,
			UpdatedAt: now,
		}
		s.brandCanonByProject[projectID] = current
	}

	backup := copyBrandCanon(current)
	backup.ProjectID = current.ProjectID
	backup.CreatedAt = current.CreatedAt
	backup.UpdatedAt = current.UpdatedAt

	if input.BrandName != nil {
		current.BrandName = strings.TrimSpace(*input.BrandName)
	}
	if input.Category != nil {
		current.Category = strings.TrimSpace(*input.Category)
	}
	if input.Positioning != nil {
		current.Positioning = strings.TrimSpace(*input.Positioning)
	}
	if input.Audience != nil {
		current.Audience = normalizeCanonList(*input.Audience)
	}
	if input.UseCases != nil {
		current.UseCases = normalizeCanonList(*input.UseCases)
	}
	if input.Features != nil {
		current.Features = normalizeCanonList(*input.Features)
	}
	current.ProjectID = projectID
	if current.CreatedAt.IsZero() {
		current.CreatedAt = now
	}
	current.UpdatedAt = now

	if err := s.persistLocked(ctx); err != nil {
		s.brandCanonByProject[projectID] = &backup
		return BrandCanon{}, fmt.Errorf("persist brand canon: %w", err)
	}

	result := copyBrandCanon(current)
	result.ProjectID = projectID
	return result, nil
}

func normalizeCanonList(items []string) []string {
	seen := make(map[string]struct{}, len(items))
	out := make([]string, 0, len(items))

	for _, item := range items {
		trimmed := strings.TrimSpace(item)
		if trimmed == "" {
			continue
		}
		key := strings.ToLower(trimmed)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, trimmed)
	}

	return out
}
