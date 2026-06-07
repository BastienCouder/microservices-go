package usecase

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/domain"
)

func (s *Service) AssignProjectMember(ctx context.Context, projectID string, organizationID, userID int64, role string) (domain.ProjectMember, error) {
	projectID = strings.TrimSpace(projectID)
	normalizedRole, err := domain.NormalizeRole(role)
	if err != nil {
		return domain.ProjectMember{}, err
	}
	if projectID == "" || organizationID <= 0 || userID <= 0 {
		return domain.ProjectMember{}, fmt.Errorf("%w: project id, organization id and user id are required", domain.ErrInvalidMember)
	}
	if err := s.ensureProjectBelongsToOrganization(ctx, projectID, organizationID); err != nil {
		return domain.ProjectMember{}, err
	}

	member := &domain.ProjectMember{
		ProjectID:      projectID,
		OrganizationID: organizationID,
		UserID:         userID,
		Role:           normalizedRole,
		AddedAt:        s.now().UTC(),
	}
	if err := s.repo.UpsertProjectMember(ctx, member); err != nil {
		return domain.ProjectMember{}, fmt.Errorf("assign project member: %w", err)
	}
	return *member, nil
}

func (s *Service) ListProjectMembers(ctx context.Context, projectID string, organizationID int64) ([]domain.ProjectMember, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" || organizationID <= 0 {
		return nil, fmt.Errorf("%w: project id and organization id are required", domain.ErrInvalidMember)
	}
	if err := s.ensureProjectBelongsToOrganization(ctx, projectID, organizationID); err != nil {
		return nil, err
	}
	members, err := s.repo.ListProjectMembers(ctx, organizationID, projectID)
	if err != nil {
		return nil, fmt.Errorf("list project members: %w", err)
	}
	sort.Slice(members, func(i, j int) bool { return members[i].UserID < members[j].UserID })
	return members, nil
}

func (s *Service) ListProjectMembersByUser(ctx context.Context, organizationID, userID int64) ([]domain.ProjectMember, error) {
	if organizationID <= 0 || userID <= 0 {
		return nil, fmt.Errorf("%w: organization id and user id are required", domain.ErrInvalidMember)
	}
	members, err := s.repo.ListProjectMembersByUser(ctx, organizationID, userID)
	if err != nil {
		return nil, fmt.Errorf("list project members by user: %w", err)
	}
	sort.Slice(members, func(i, j int) bool { return members[i].ProjectID < members[j].ProjectID })
	return members, nil
}

func (s *Service) RemoveProjectMember(ctx context.Context, projectID string, organizationID, userID int64) error {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" || organizationID <= 0 || userID <= 0 {
		return fmt.Errorf("%w: project id, organization id and user id are required", domain.ErrInvalidMember)
	}
	if err := s.ensureProjectBelongsToOrganization(ctx, projectID, organizationID); err != nil {
		return err
	}
	if err := s.repo.RemoveProjectMember(ctx, organizationID, projectID, userID); err != nil {
		return fmt.Errorf("remove project member: %w", err)
	}
	return nil
}

func (s *Service) ensureProjectBelongsToOrganization(ctx context.Context, projectID string, organizationID int64) error {
	if s.projectLister == nil {
		return nil
	}
	projects, err := s.projectLister.ListProjectsByOrganization(ctx, organizationID)
	if err != nil {
		return fmt.Errorf("list organization projects: %w", err)
	}
	for _, project := range projects {
		if strings.TrimSpace(project.ID) == projectID && project.OrganizationID == organizationID {
			return nil
		}
	}
	return fmt.Errorf("%w: project", domain.ErrOrganizationNotFound)
}
