package usecase

import (
	"context"
	"fmt"
	"strings"
)

func (s *Service) GetProjectAIBriefSettings(ctx context.Context, projectID string, organizationID int64) (ProjectAIBriefSettings, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return ProjectAIBriefSettings{}, fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return ProjectAIBriefSettings{}, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return ProjectAIBriefSettings{}, err
	}
	if settings, ok := s.aiBriefSettings[projectID]; ok {
		return copyProjectAIBriefSettings(settings), nil
	}
	return ProjectAIBriefSettings{ProjectID: projectID}, nil
}

func (s *Service) UpdateProjectAIBriefSettings(ctx context.Context, projectID string, organizationID int64, input UpdateProjectAIBriefSettingsInput) (ProjectAIBriefSettings, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return ProjectAIBriefSettings{}, fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return ProjectAIBriefSettings{}, err
	}

	briefModelID := strings.TrimSpace(stringPointerValue(input.BriefModelID))
	briefProvider := strings.TrimSpace(stringPointerValue(input.BriefProvider))
	briefProviderModelID := strings.TrimSpace(stringPointerValue(input.BriefProviderModelID))
	if briefModelID == "" || briefProviderModelID == "" {
		return ProjectAIBriefSettings{}, fmt.Errorf("%w: briefModelId and briefProviderModelId are required", ErrValidation)
	}
	if briefProvider == "" {
		briefProvider = "openrouter"
	}
	if err := s.ensureAIBriefModelEnabled(ctx, projectID, organizationID, briefModelID); err != nil {
		return ProjectAIBriefSettings{}, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return ProjectAIBriefSettings{}, err
	}

	backup := s.snapshotLocked()
	now := s.now().UTC()
	settings := s.aiBriefSettings[projectID]
	if settings == nil {
		settings = &ProjectAIBriefSettings{ProjectID: projectID, CreatedAt: now}
	}
	if settings.CreatedAt.IsZero() {
		settings.CreatedAt = now
	}
	settings.BriefModelID = briefModelID
	settings.BriefProvider = briefProvider
	settings.BriefProviderModelID = briefProviderModelID
	settings.UpdatedAt = now
	s.aiBriefSettings[projectID] = settings

	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return ProjectAIBriefSettings{}, err
	}
	return copyProjectAIBriefSettings(settings), nil
}

func (s *Service) getProjectAIBriefSettingsLocked(projectID string) ProjectAIBriefSettings {
	if settings, ok := s.aiBriefSettings[projectID]; ok {
		return copyProjectAIBriefSettings(settings)
	}
	return ProjectAIBriefSettings{ProjectID: projectID}
}

func (s *Service) getProjectAIBriefSettings(ctx context.Context, projectID string, organizationID int64) (ProjectAIBriefSettings, error) {
	settings, err := s.GetProjectAIBriefSettings(ctx, projectID, organizationID)
	if err != nil {
		return ProjectAIBriefSettings{}, err
	}
	return settings, nil
}

func (s *Service) ensureAIBriefModelEnabled(ctx context.Context, projectID string, organizationID int64, modelID string) error {
	modelIDs, available, err := s.listProjectEnabledModels(ctx, projectID, organizationID)
	if err != nil {
		return err
	}
	if !available {
		return nil
	}
	for _, enabledModelID := range modelIDs {
		if enabledModelID == modelID {
			return nil
		}
	}
	return fmt.Errorf("%w: selected brief model is not enabled for this project", ErrValidation)
}

func stringPointerValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
