package usecase

import (
	"context"
	"fmt"
	"strings"
)

type ResourceScope struct {
	OrganizationID int64
	ProjectID      string
}

func (s *Service) GetProjectScope(ctx context.Context, projectID string) (ResourceScope, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return ResourceScope{}, fmt.Errorf("%w: project id is required", ErrValidation)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return ResourceScope{}, err
	}
	project, ok := s.projects[projectID]
	if !ok {
		return ResourceScope{}, fmt.Errorf("%w: project", ErrNotFound)
	}
	if isProjectDeleted(project) {
		return ResourceScope{}, fmt.Errorf("%w: project", ErrNotFound)
	}
	return ResourceScope{OrganizationID: project.OrganizationID, ProjectID: project.ID}, nil
}

func (s *Service) GetPromptScope(ctx context.Context, promptID string) (ResourceScope, error) {
	promptID = strings.TrimSpace(promptID)
	if promptID == "" {
		return ResourceScope{}, fmt.Errorf("%w: prompt id is required", ErrValidation)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return ResourceScope{}, err
	}
	prompt, ok := s.prompts[promptID]
	if !ok {
		return ResourceScope{}, fmt.Errorf("%w: prompt", ErrNotFound)
	}
	project, ok := s.projects[prompt.ProjectID]
	if !ok {
		return ResourceScope{}, fmt.Errorf("%w: project", ErrNotFound)
	}
	if isProjectDeleted(project) {
		return ResourceScope{}, fmt.Errorf("%w: project", ErrNotFound)
	}
	return ResourceScope{OrganizationID: project.OrganizationID, ProjectID: project.ID}, nil
}

func (s *Service) GetCompetitorScope(ctx context.Context, competitorID string) (ResourceScope, error) {
	competitorID = strings.TrimSpace(competitorID)
	if competitorID == "" {
		return ResourceScope{}, fmt.Errorf("%w: competitor id is required", ErrValidation)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return ResourceScope{}, err
	}
	competitor, ok := s.competitors[competitorID]
	if !ok {
		return ResourceScope{}, fmt.Errorf("%w: competitor", ErrNotFound)
	}
	project, ok := s.projects[competitor.ProjectID]
	if !ok {
		return ResourceScope{}, fmt.Errorf("%w: project", ErrNotFound)
	}
	if isProjectDeleted(project) {
		return ResourceScope{}, fmt.Errorf("%w: project", ErrNotFound)
	}
	return ResourceScope{OrganizationID: project.OrganizationID, ProjectID: project.ID}, nil
}
