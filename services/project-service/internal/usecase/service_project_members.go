package usecase

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

func (s *Service) AssignProjectMember(
	ctx context.Context,
	projectID string,
	organizationID int64,
	userID int64,
	role string,
) (ProjectMember, error) {
	normalizedRole := strings.ToLower(strings.TrimSpace(role))
	if userID <= 0 || normalizedRole == "" {
		return ProjectMember{}, fmt.Errorf("%w: userId and role are required", ErrValidation)
	}
	if !projectRoleAllowsAction(normalizedRole, "read") {
		return ProjectMember{}, fmt.Errorf("%w: unsupported project role", ErrValidation)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return ProjectMember{}, err
	}
	project, err := s.getProjectForOrganizationLocked(projectID, organizationID)
	if err != nil {
		return ProjectMember{}, err
	}

	if s.projectMembers[project.ID] == nil {
		s.projectMembers[project.ID] = make(map[int64]*ProjectMember)
	}

	now := s.now().UTC()
	if existing := s.projectMembers[project.ID][userID]; existing != nil {
		existing.Role = normalizedRole
		member := copyProjectMember(existing)
		if err := s.persistLocked(ctx); err != nil {
			return ProjectMember{}, err
		}
		return member, nil
	}

	member := &ProjectMember{
		ProjectID:      project.ID,
		OrganizationID: project.OrganizationID,
		UserID:         userID,
		Role:           normalizedRole,
		AddedAt:        now,
	}
	s.projectMembers[project.ID][userID] = member
	if err := s.persistLocked(ctx); err != nil {
		delete(s.projectMembers[project.ID], userID)
		return ProjectMember{}, err
	}
	return copyProjectMember(member), nil
}

func (s *Service) ListProjectMembers(ctx context.Context, projectID string, organizationID int64) ([]ProjectMember, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}
	project, err := s.getProjectForOrganizationLocked(projectID, organizationID)
	if err != nil {
		return nil, err
	}

	membersByUser := s.projectMembers[project.ID]
	members := make([]ProjectMember, 0, len(membersByUser))
	for _, member := range membersByUser {
		members = append(members, copyProjectMember(member))
	}
	sort.Slice(members, func(i, j int) bool {
		return members[i].UserID < members[j].UserID
	})
	return members, nil
}

func (s *Service) EnforceUserProjectAccess(ctx context.Context, projectID string, organizationID, userID int64) error {
	return s.EnforceUserProjectActionAccess(ctx, projectID, organizationID, userID, "read")
}

func (s *Service) EnforceUserProjectActionAccess(ctx context.Context, projectID string, organizationID, userID int64, action string) error {
	if userID <= 0 {
		return fmt.Errorf("%w: userId is required", ErrValidation)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return err
	}
	return s.enforceUserProjectActionAccessLocked(ctx, projectID, organizationID, userID, action)
}

func (s *Service) EnforceUserPromptAccess(ctx context.Context, promptID string, organizationID, userID int64) error {
	return s.EnforceUserPromptActionAccess(ctx, promptID, organizationID, userID, "read")
}

func (s *Service) EnforceUserPromptActionAccess(ctx context.Context, promptID string, organizationID, userID int64, action string) error {
	if userID <= 0 {
		return fmt.Errorf("%w: userId is required", ErrValidation)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return err
	}
	prompt, ok := s.prompts[strings.TrimSpace(promptID)]
	if !ok {
		return fmt.Errorf("%w: prompt", ErrNotFound)
	}
	return s.enforceUserProjectActionAccessLocked(ctx, prompt.ProjectID, organizationID, userID, action)
}

func (s *Service) EnforceUserCompetitorAccess(ctx context.Context, competitorID string, organizationID, userID int64) error {
	return s.EnforceUserCompetitorActionAccess(ctx, competitorID, organizationID, userID, "read")
}

func (s *Service) EnforceUserCompetitorActionAccess(ctx context.Context, competitorID string, organizationID, userID int64, action string) error {
	if userID <= 0 {
		return fmt.Errorf("%w: userId is required", ErrValidation)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return err
	}
	competitor, ok := s.competitors[strings.TrimSpace(competitorID)]
	if !ok {
		return fmt.Errorf("%w: competitor", ErrNotFound)
	}
	return s.enforceUserProjectActionAccessLocked(ctx, competitor.ProjectID, organizationID, userID, action)
}

func (s *Service) enforceUserProjectAccessLocked(ctx context.Context, projectID string, organizationID, userID int64) error {
	return s.enforceUserProjectActionAccessLocked(ctx, projectID, organizationID, userID, "read")
}

func (s *Service) enforceUserProjectActionAccessLocked(ctx context.Context, projectID string, organizationID, userID int64, action string) error {
	project, err := s.getProjectForOrganizationLocked(projectID, organizationID)
	if err != nil {
		return err
	}
	action = normalizeProjectAccessAction(action)

	if s.projectMembershipClient != nil {
		members, err := s.projectMembershipClient.ListProjectMembersByUser(ctx, organizationID, userID)
		if err != nil {
			return fmt.Errorf("%w: project memberships unavailable", ErrDependencyUnavailable)
		}
		for _, member := range members {
			if member.OrganizationID == organizationID && member.ProjectID == project.ID {
				if projectRoleAllowsAction(member.Role, action) {
					return nil
				}
				return fmt.Errorf("%w: project role denied", ErrUnauthorized)
			}
		}
		return fmt.Errorf("%w: project access denied", ErrUnauthorized)
	}

	hasProjectScope := false
	for scopedProjectID, members := range s.projectMembers {
		member, ok := members[userID]
		if !ok || member.OrganizationID != organizationID {
			continue
		}
		if _, err := s.getProjectForOrganizationLocked(scopedProjectID, organizationID); err != nil {
			continue
		}
		hasProjectScope = true
		if scopedProjectID == project.ID {
			if projectRoleAllowsAction(member.Role, action) {
				return nil
			}
			return fmt.Errorf("%w: project role denied", ErrUnauthorized)
		}
	}

	if hasProjectScope || s.projectMembershipClient != nil {
		return fmt.Errorf("%w: project access denied", ErrUnauthorized)
	}
	return fmt.Errorf("%w: project membership required", ErrUnauthorized)
}

func normalizeProjectAccessAction(action string) string {
	switch strings.ToLower(strings.TrimSpace(action)) {
	case "create", "update", "delete":
		return strings.ToLower(strings.TrimSpace(action))
	default:
		return "read"
	}
}

func projectRoleAllowsAction(role, action string) bool {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "editor":
		return true
	case "viewer":
		return normalizeProjectAccessAction(action) == "read"
	default:
		return false
	}
}

func (s *Service) RemoveProjectMember(ctx context.Context, projectID string, organizationID, userID int64) error {
	if userID <= 0 {
		return fmt.Errorf("%w: userId is required", ErrValidation)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return err
	}
	project, err := s.getProjectForOrganizationLocked(projectID, organizationID)
	if err != nil {
		return err
	}

	if s.projectMembers[project.ID] == nil {
		return nil
	}
	previous := s.projectMembers[project.ID][userID]
	delete(s.projectMembers[project.ID], userID)
	if err := s.persistLocked(ctx); err != nil {
		if previous != nil {
			s.projectMembers[project.ID][userID] = previous
		}
		return err
	}
	return nil
}
