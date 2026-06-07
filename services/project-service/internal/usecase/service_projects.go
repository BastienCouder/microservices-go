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
	if err := s.reloadLocked(ctx); err != nil {
		s.mu.Unlock()
		return Project{}, err
	}
	entitlements, err := s.resolveBillingEntitlementsLocked(ctx, input.OrganizationID)
	if err != nil {
		s.mu.Unlock()
		return Project{}, err
	}
	if entitlements.MaxProjects > 0 && countProjectsForOrganization(s.projects, input.OrganizationID) >= entitlements.MaxProjects {
		s.mu.Unlock()
		return Project{}, fmt.Errorf(
			"%w: plan %s allows up to %d projects",
			ErrValidation,
			strings.TrimSpace(entitlements.Plan),
			entitlements.MaxProjects,
		)
	}

	now := s.now().UTC()
	project := &Project{
		ID:                s.nextID("prj"),
		OrganizationID:    input.OrganizationID,
		CreatedBy:         input.CreatedBy,
		Name:              name,
		Domain:            domain,
		WebsiteURL:        websiteURL,
		AttributionSource: normalizeAttributionSource(input.AttributionSource),
		BrandName:         strings.TrimSpace(input.BrandName),
		BrandDescription:  strings.TrimSpace(input.BrandDescription),
		Industry:          strings.TrimSpace(input.Industry),
		PrimaryLanguage:   primaryLanguage,
		Country:           country,
		CreatedAt:         now,
		UpdatedAt:         now,
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
		s.mu.Unlock()
		return Project{}, err
	}

	created := copyProject(project)
	s.mu.Unlock()

	s.emitProjectSignupAttribution(ctx, created)
	return created, nil
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

	return listProjectsFromMap(s.projects, organizationID), nil
}

func (s *Service) ListProjectsForUser(ctx context.Context, organizationID, userID int64) ([]Project, error) {
	if organizationID <= 0 || userID <= 0 {
		return nil, fmt.Errorf("%w: organizationId and userId must be positive", ErrValidation)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	if s.projectMembershipClient != nil {
		members, err := s.projectMembershipClient.ListProjectMembersByUser(ctx, organizationID, userID)
		if err != nil {
			return nil, fmt.Errorf("%w: project memberships unavailable", ErrDependencyUnavailable)
		}
		return s.listProjectsForMembershipsLocked(organizationID, members), nil
	}

	assignedProjectIDs := make(map[string]struct{})
	for projectID, members := range s.projectMembers {
		member, ok := members[userID]
		if !ok || member.OrganizationID != organizationID {
			continue
		}
		if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err == nil {
			assignedProjectIDs[projectID] = struct{}{}
		}
	}
	if len(assignedProjectIDs) == 0 {
		return listProjectsFromMap(s.projects, organizationID), nil
	}

	projects := make([]Project, 0, len(assignedProjectIDs))
	for projectID := range assignedProjectIDs {
		if project, ok := s.projects[projectID]; ok && project.OrganizationID == organizationID {
			projects = append(projects, copyProject(project))
		}
	}
	sort.Slice(projects, func(i, j int) bool {
		return projects[i].CreatedAt.Before(projects[j].CreatedAt)
	})
	return projects, nil
}

func (s *Service) listProjectsForMembershipsLocked(organizationID int64, members []ProjectMember) []Project {
	if len(members) == 0 {
		return listProjectsFromMap(s.projects, organizationID)
	}
	assignedProjectIDs := make(map[string]struct{}, len(members))
	for _, member := range members {
		if member.OrganizationID == organizationID {
			assignedProjectIDs[member.ProjectID] = struct{}{}
		}
	}
	if len(assignedProjectIDs) == 0 {
		return listProjectsFromMap(s.projects, organizationID)
	}
	projects := make([]Project, 0, len(assignedProjectIDs))
	for projectID := range assignedProjectIDs {
		if project, ok := s.projects[projectID]; ok && project.OrganizationID == organizationID {
			projects = append(projects, copyProject(project))
		}
	}
	sort.Slice(projects, func(i, j int) bool {
		return projects[i].CreatedAt.Before(projects[j].CreatedAt)
	})
	return projects
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
	if input.AttributionSource != nil {
		project.AttributionSource = normalizeAttributionSource(*input.AttributionSource)
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

func (s *Service) DeleteProject(ctx context.Context, projectID string, organizationID int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return err
	}
	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return err
	}

	backup := s.snapshotLocked()
	delete(s.projects, projectID)
	delete(s.projectModels, projectID)
	delete(s.projectMembers, projectID)
	delete(s.modelSelectionChanges, projectID)
	delete(s.impactIntegrations, projectID)
	delete(s.providerCredentials, projectID)
	for promptID, prompt := range s.prompts {
		if prompt.ProjectID == projectID {
			delete(s.prompts, promptID)
		}
	}
	for competitorID, competitor := range s.competitors {
		if competitor.ProjectID == projectID {
			delete(s.competitors, competitorID)
		}
	}

	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return err
	}
	return nil
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

	prompts := filterActivePromptsByProject(s.prompts, s.projectModels, s.models, projectID)
	if len(prompts) == 0 {
		return FinalizeResult{}, fmt.Errorf("%w: at least one prompt is required", ErrValidation)
	}
	models := filterEnabledModels(s.projectModels, s.models, projectID)
	if len(models) == 0 {
		return FinalizeResult{}, fmt.Errorf("%w: at least one model must be enabled", ErrValidation)
	}
	competitors := filterActiveCompetitorsByProject(s.competitors, projectID)

	backup := s.snapshotLocked()
	now := s.now().UTC()

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

func listProjectsFromMap(projectsByID map[string]*Project, organizationID int64) []Project {
	projects := make([]Project, 0)
	for _, project := range projectsByID {
		if project.OrganizationID == organizationID {
			projects = append(projects, copyProject(project))
		}
	}
	sort.Slice(projects, func(i, j int) bool {
		return projects[i].CreatedAt.Before(projects[j].CreatedAt)
	})
	return projects
}

func countProjectsForOrganization(projectsByID map[string]*Project, organizationID int64) int {
	count := 0
	for _, project := range projectsByID {
		if project.OrganizationID == organizationID {
			count++
		}
	}
	return count
}
