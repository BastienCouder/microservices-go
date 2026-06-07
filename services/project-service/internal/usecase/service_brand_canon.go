package usecase

import (
	"context"
	"fmt"
	"strings"
)

func (s *Service) GetBrandCanon(ctx context.Context, projectID string, organizationID int64) (BrandCanon, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return BrandCanon{}, err
	}
	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return BrandCanon{}, err
	}

	if canon, ok := s.brandCanonByProject[projectID]; ok {
		result := copyBrandCanon(canon)
		result.ProjectID = projectID
		return result, nil
	}

	return emptyBrandCanon(projectID), nil
}

func (s *Service) UpdateBrandCanon(ctx context.Context, projectID string, organizationID int64, input UpdateBrandCanonInput) (BrandCanon, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return BrandCanon{}, err
	}
	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return BrandCanon{}, err
	}

	now := s.now().UTC()
	current, ok := s.brandCanonByProject[projectID]
	if !ok {
		canon := emptyBrandCanon(projectID)
		canon.CreatedAt = now
		canon.UpdatedAt = now
		current = &canon
		s.brandCanonByProject[projectID] = current
	}

	backup := copyBrandCanon(current)
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
	if input.Pricing != nil {
		current.Pricing = copyCanonMap(*input.Pricing)
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

func emptyBrandCanon(projectID string) BrandCanon {
	return BrandCanon{
		ProjectID: projectID,
		Audience:  []string{},
		UseCases:  []string{},
		Pricing:   map[string]any{},
		Features:  []string{},
	}
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

func copyCanonMap(input map[string]any) map[string]any {
	if input == nil {
		return map[string]any{}
	}
	out := make(map[string]any, len(input))
	for key, value := range input {
		out[key] = value
	}
	return out
}
