package usecase

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

func (s *Service) ListModels(ctx context.Context, onlyActive bool) ([]AIModel, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	models := make([]AIModel, 0, len(s.models))
	for _, model := range s.models {
		if onlyActive && !model.IsActive {
			continue
		}
		models = append(models, model)
	}
	sort.Slice(models, func(i, j int) bool { return models[i].Label < models[j].Label })
	return models, nil
}

func (s *Service) ListProjectModels(ctx context.Context, projectID string, organizationID int64) ([]ProjectModelSelection, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return nil, err
	}

	models := make([]AIModel, 0, len(s.models))
	for _, model := range s.models {
		models = append(models, model)
	}
	sort.Slice(models, func(i, j int) bool { return models[i].Label < models[j].Label })

	enabledByID := s.projectModels[projectID]
	if enabledByID == nil {
		enabledByID = make(map[string]bool)
	}

	selection := make([]ProjectModelSelection, 0, len(models))
	for _, model := range models {
		selection = append(selection, ProjectModelSelection{AIModel: model, IsEnabledForProject: enabledByID[model.ID]})
	}
	return selection, nil
}

func (s *Service) ListEnabledProjectModelIDs(ctx context.Context, projectID string, organizationID int64) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return nil, err
	}

	return filterEnabledModels(s.projectModels, projectID), nil
}

func (s *Service) ReplaceProjectModels(ctx context.Context, projectID string, organizationID int64, modelIDs []string) (ReplaceProjectModelsResult, error) {
	if len(modelIDs) == 0 {
		return ReplaceProjectModelsResult{}, fmt.Errorf("%w: modelIds cannot be empty", ErrValidation)
	}

	normalized := make([]string, 0, len(modelIDs))
	seen := make(map[string]bool)
	for _, raw := range modelIDs {
		modelID := strings.TrimSpace(raw)
		if modelID == "" {
			return ReplaceProjectModelsResult{}, fmt.Errorf("%w: modelId cannot be empty", ErrValidation)
		}
		if seen[modelID] {
			continue
		}
		seen[modelID] = true
		normalized = append(normalized, modelID)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return ReplaceProjectModelsResult{}, err
	}

	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return ReplaceProjectModelsResult{}, err
	}
	for _, modelID := range normalized {
		if _, exists := s.models[modelID]; !exists {
			return ReplaceProjectModelsResult{}, fmt.Errorf("%w: unknown model id %s", ErrValidation, modelID)
		}
	}

	backup := s.snapshotLocked()
	replacement := make(map[string]bool, len(normalized))
	for _, modelID := range normalized {
		replacement[modelID] = true
	}
	s.projectModels[projectID] = replacement
	for _, prompt := range s.prompts {
		if prompt.ProjectID != projectID {
			continue
		}
		prompt.ModelIDs = effectivePromptModelIDs(prompt, normalized)
		schedule, err := normalizePromptSchedule(prompt.Schedule, prompt.ModelIDs)
		if err != nil {
			s.restoreLocked(backup)
			return ReplaceProjectModelsResult{}, err
		}
		prompt.Schedule = schedule
	}
	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return ReplaceProjectModelsResult{}, err
	}

	sort.Strings(normalized)
	return ReplaceProjectModelsResult{ProjectID: projectID, ModelIDs: normalized, Count: len(normalized)}, nil
}

func (s *Service) SeedDefaultModels(ctx context.Context) ([]AIModel, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	s.seedDefaultModels()
	if err := s.persistLocked(ctx); err != nil {
		return nil, err
	}

	models := make([]AIModel, 0, len(s.models))
	for _, model := range s.models {
		models = append(models, model)
	}
	sort.Slice(models, func(i, j int) bool { return models[i].Label < models[j].Label })
	return models, nil
}
