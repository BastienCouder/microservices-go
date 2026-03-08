package usecase

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

func (s *Service) CreateProject(ctx context.Context, input CreateProjectInput) (Project, error) {
	name := strings.TrimSpace(input.Name)
	domain := strings.TrimSpace(input.Domain)
	websiteURL := strings.TrimSpace(input.WebsiteURL)
	if input.OrganizationID <= 0 || input.CreatedBy <= 0 || name == "" || domain == "" || websiteURL == "" {
		return Project{}, fmt.Errorf("%w: organizationId, createdBy, name, domain and websiteUrl are required", ErrValidation)
	}

	primaryLanguage := strings.TrimSpace(input.PrimaryLanguage)
	if primaryLanguage == "" {
		primaryLanguage = "fr"
	}
	country := strings.TrimSpace(input.Country)
	if country == "" {
		country = "FR"
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return Project{}, err
	}

	now := s.now().UTC()
	project := &Project{
		ID:               s.nextID("prj"),
		OrganizationID:   input.OrganizationID,
		CreatedBy:        input.CreatedBy,
		Name:             name,
		Domain:           domain,
		WebsiteURL:       websiteURL,
		BrandName:        strings.TrimSpace(input.BrandName),
		BrandDescription: strings.TrimSpace(input.BrandDescription),
		Industry:         strings.TrimSpace(input.Industry),
		PrimaryLanguage:  primaryLanguage,
		Country:          country,
		Status:           "draft",
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	s.projects[project.ID] = project

	enabled := make(map[string]bool)
	for modelID, model := range s.models {
		if model.IsActive {
			enabled[modelID] = true
		}
	}
	s.projectModels[project.ID] = enabled
	if err := s.persistLocked(ctx); err != nil {
		delete(s.projects, project.ID)
		delete(s.projectModels, project.ID)
		return Project{}, err
	}

	return copyProject(project), nil
}

func (s *Service) ListProjects(ctx context.Context, organizationID int64) ([]Project, error) {
	if organizationID <= 0 {
		return nil, fmt.Errorf("%w: organizationId must be positive", ErrValidation)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	projects := make([]Project, 0)
	for _, project := range s.projects {
		if project.OrganizationID == organizationID {
			projects = append(projects, copyProject(project))
		}
	}
	sort.Slice(projects, func(i, j int) bool {
		return projects[i].CreatedAt.Before(projects[j].CreatedAt)
	})
	return projects, nil
}

func (s *Service) GetProject(ctx context.Context, projectID string, organizationID int64) (Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return Project{}, err
	}

	project, err := s.getProjectForOrganizationLocked(projectID, organizationID)
	if err != nil {
		return Project{}, err
	}
	return copyProject(project), nil
}

func (s *Service) UpdateProject(ctx context.Context, projectID string, organizationID int64, input UpdateProjectInput) (Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return Project{}, err
	}

	project, err := s.getProjectForOrganizationLocked(projectID, organizationID)
	if err != nil {
		return Project{}, err
	}
	backup := *project

	if input.Name != nil {
		value := strings.TrimSpace(*input.Name)
		if value == "" {
			return Project{}, fmt.Errorf("%w: name cannot be empty", ErrValidation)
		}
		project.Name = value
	}
	if input.Domain != nil {
		value := strings.TrimSpace(*input.Domain)
		if value == "" {
			return Project{}, fmt.Errorf("%w: domain cannot be empty", ErrValidation)
		}
		project.Domain = value
	}
	if input.WebsiteURL != nil {
		value := strings.TrimSpace(*input.WebsiteURL)
		if value == "" {
			return Project{}, fmt.Errorf("%w: websiteUrl cannot be empty", ErrValidation)
		}
		project.WebsiteURL = value
	}
	if input.BrandName != nil {
		project.BrandName = strings.TrimSpace(*input.BrandName)
	}
	if input.BrandDescription != nil {
		project.BrandDescription = strings.TrimSpace(*input.BrandDescription)
	}
	if input.Industry != nil {
		project.Industry = strings.TrimSpace(*input.Industry)
	}
	project.UpdatedAt = s.now().UTC()

	if err := s.persistLocked(ctx); err != nil {
		*project = backup
		return Project{}, err
	}

	return copyProject(project), nil
}

func (s *Service) ActivateProject(ctx context.Context, projectID string, organizationID int64) (Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return Project{}, err
	}

	project, err := s.getProjectForOrganizationLocked(projectID, organizationID)
	if err != nil {
		return Project{}, err
	}
	backup := *project
	project.Status = "active"
	project.UpdatedAt = s.now().UTC()
	if err := s.persistLocked(ctx); err != nil {
		*project = backup
		return Project{}, err
	}
	return copyProject(project), nil
}

func (s *Service) FinalizeProject(ctx context.Context, projectID string, organizationID int64) (FinalizeResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return FinalizeResult{}, err
	}

	project, err := s.getProjectForOrganizationLocked(projectID, organizationID)
	if err != nil {
		return FinalizeResult{}, err
	}

	prompts := filterActivePromptsByProject(s.prompts, projectID)
	if len(prompts) == 0 {
		return FinalizeResult{}, fmt.Errorf("%w: at least one prompt is required", ErrValidation)
	}
	models := filterEnabledModels(s.projectModels, projectID)
	if len(models) == 0 {
		return FinalizeResult{}, fmt.Errorf("%w: at least one model must be enabled", ErrValidation)
	}
	competitors := filterActiveCompetitorsByProject(s.competitors, projectID)

	backup := s.snapshotLocked()
	now := s.now().UTC()

	project.Status = "active"
	project.UpdatedAt = now

	payload := FinalizePipelinePayload{
		Project:     copyProject(project),
		Prompts:     append([]AnalysisPromptText(nil), prompts...),
		ModelIDs:    append([]string(nil), models...),
		Competitors: append([]string(nil), competitors...),
	}
	outboxEvent := &OutboxEvent{
		ID:        s.nextID("evt"),
		EventType: OutboxEventTypeProjectFinalized,
		Status:    OutboxStatusPending,
		Payload:   payload,
		CreatedAt: now,
		UpdatedAt: now,
	}
	s.outbox[outboxEvent.ID] = outboxEvent
	s.outboxOrder = append(s.outboxOrder, outboxEvent.ID)

	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return FinalizeResult{}, err
	}

	return FinalizeResult{Project: copyProject(project), PromptCount: len(prompts), ModelCount: len(models)}, nil
}
