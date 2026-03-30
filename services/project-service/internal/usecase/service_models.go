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

	return filterEnabledModels(s.projectModels, s.models, projectID), nil
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
		model, exists := s.models[modelID]
		if !exists {
			return ReplaceProjectModelsResult{}, fmt.Errorf("%w: unknown model id %s", ErrValidation, modelID)
		}
		if !model.IsActive {
			return ReplaceProjectModelsResult{}, fmt.Errorf("%w: model id %s is inactive", ErrValidation, modelID)
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

func (s *Service) CreateModel(ctx context.Context, input CreateAIModelInput) (AIModel, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return AIModel{}, err
	}

	model, err := s.buildModelLocked(
		strings.TrimSpace(input.ID),
		func(candidate *AIModel) {
			candidate.Label = strings.TrimSpace(input.Label)
			candidate.Provider = strings.TrimSpace(input.Provider)
			candidate.Group = strings.TrimSpace(input.Group)
			candidate.IconKey = strings.TrimSpace(input.IconKey)
			candidate.ModelID = strings.TrimSpace(input.ModelID)
			candidate.IsActive = input.IsActive
			candidate.SupportsLiveSearch = input.SupportsLiveSearch
		},
	)
	if err != nil {
		return AIModel{}, err
	}
	if _, exists := s.models[model.ID]; exists {
		return AIModel{}, fmt.Errorf("%w: model id already exists", ErrValidation)
	}
	if err := validateModelUniqueness(s.models, model.ID, model.Provider, model.ModelID); err != nil {
		return AIModel{}, err
	}

	s.models[model.ID] = model
	if err := s.persistLocked(ctx); err != nil {
		delete(s.models, model.ID)
		return AIModel{}, err
	}
	return model, nil
}

func (s *Service) UpdateModel(ctx context.Context, modelID string, input UpdateAIModelInput) (AIModel, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return AIModel{}, err
	}

	modelID = strings.TrimSpace(modelID)
	current, exists := s.models[modelID]
	if !exists {
		return AIModel{}, fmt.Errorf("%w: model", ErrNotFound)
	}
	backup := current

	model, err := s.buildModelLocked(modelID, func(candidate *AIModel) {
		candidate.Label = current.Label
		candidate.Provider = current.Provider
		candidate.Group = current.Group
		candidate.IconKey = current.IconKey
		candidate.ModelID = current.ModelID
		candidate.IsActive = current.IsActive
		candidate.SupportsLiveSearch = current.SupportsLiveSearch
		if input.Label != nil {
			candidate.Label = strings.TrimSpace(*input.Label)
		}
		if input.Provider != nil {
			candidate.Provider = strings.TrimSpace(*input.Provider)
		}
		if input.Group != nil {
			candidate.Group = strings.TrimSpace(*input.Group)
		}
		if input.IconKey != nil {
			candidate.IconKey = strings.TrimSpace(*input.IconKey)
		}
		if input.ModelID != nil {
			candidate.ModelID = strings.TrimSpace(*input.ModelID)
		}
		if input.IsActive != nil {
			candidate.IsActive = *input.IsActive
		}
		if input.SupportsLiveSearch != nil {
			candidate.SupportsLiveSearch = *input.SupportsLiveSearch
		}
	})
	if err != nil {
		return AIModel{}, err
	}
	if err := validateModelUniqueness(s.models, model.ID, model.Provider, model.ModelID); err != nil {
		return AIModel{}, err
	}

	s.models[model.ID] = model
	for _, prompt := range s.prompts {
		if prompt.ProjectID == "" {
			continue
		}
		schedule, scheduleErr := normalizePromptSchedule(
			prompt.Schedule,
			effectivePromptModelIDs(prompt, filterEnabledModels(s.projectModels, s.models, prompt.ProjectID)),
		)
		if scheduleErr != nil {
			s.models[model.ID] = backup
			return AIModel{}, scheduleErr
		}
		prompt.Schedule = schedule
	}
	if err := s.persistLocked(ctx); err != nil {
		s.models[model.ID] = backup
		return AIModel{}, err
	}
	return model, nil
}

func (s *Service) buildModelLocked(modelID string, mutate func(candidate *AIModel)) (AIModel, error) {
	candidate := AIModel{ID: strings.TrimSpace(modelID)}
	mutate(&candidate)
	candidate.IconPath = modelIconPath(candidate.IconKey)

	if candidate.ID == "" {
		return AIModel{}, fmt.Errorf("%w: model id is required", ErrValidation)
	}
	if candidate.Label == "" {
		return AIModel{}, fmt.Errorf("%w: displayName is required", ErrValidation)
	}
	if candidate.Provider == "" {
		return AIModel{}, fmt.Errorf("%w: provider is required", ErrValidation)
	}
	if candidate.Group == "" {
		return AIModel{}, fmt.Errorf("%w: groupName is required", ErrValidation)
	}
	if candidate.IconKey == "" {
		return AIModel{}, fmt.Errorf("%w: iconKey is required", ErrValidation)
	}
	if candidate.ModelID == "" {
		return AIModel{}, fmt.Errorf("%w: providerModelId is required", ErrValidation)
	}

	return candidate, nil
}

func validateModelUniqueness(models map[string]AIModel, modelID, provider, providerModelID string) error {
	for existingID, existing := range models {
		if existingID == modelID {
			continue
		}
		if existing.Provider == provider && existing.ModelID == providerModelID {
			return fmt.Errorf("%w: providerModelId already exists for provider", ErrValidation)
		}
	}
	return nil
}

func modelIconPath(iconKey string) string {
	iconKey = strings.TrimSpace(iconKey)
	if iconKey == "" {
		return ""
	}
	return "/models/" + iconKey + ".svg"
}
