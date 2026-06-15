package usecase

import (
	"context"
	"fmt"
	"strings"

	"github.com/bastiencouder/microservices-go/services/permission-service/internal/domain"
)

type Service struct {
	repo          domain.Repository
	scopeResolver ScopeResolver
}

type ScopeResolver interface {
	ResolveProjectID(ctx context.Context, organizationID int64, resource, resourceID string) (string, error)
}

func NewService(repo domain.Repository, scopeResolver ScopeResolver) *Service {
	return &Service{repo: repo, scopeResolver: scopeResolver}
}

func (s *Service) Check(ctx context.Context, in domain.CheckInput) (domain.CheckResult, error) {
	if err := in.Validate(); err != nil {
		return domain.CheckResult{}, err
	}

	roles, err := s.repo.ListOrganizationRoles(ctx, in.OrganizationID, in.UserID)
	if err != nil {
		return domain.CheckResult{}, fmt.Errorf("resolve user roles: %w", err)
	}
	in.Roles = normalizeRoles(roles)

	projectID := strings.TrimSpace(in.ProjectID)
	if projectID == "" && strings.TrimSpace(in.ResourceID) != "" && s.scopeResolver != nil {
		projectID, err = s.scopeResolver.ResolveProjectID(ctx, in.OrganizationID, in.Resource, in.ResourceID)
		if err != nil {
			return domain.CheckResult{}, fmt.Errorf("resolve project scope: %w", err)
		}
	}
	in.ProjectID = projectID

	result, err := s.repo.CheckPolicy(ctx, in)
	if err != nil {
		return domain.CheckResult{}, fmt.Errorf("check permission: %w", err)
	}
	return result, nil
}

func (s *Service) ListOrganizationsByUser(ctx context.Context, userID int64) ([]domain.Membership, error) {
	if userID <= 0 {
		return nil, fmt.Errorf("%w: user id must be positive", domain.ErrInvalidPermissionCheck)
	}
	return s.repo.ListOrganizationsByUser(ctx, userID)
}

func (s *Service) ListMembers(ctx context.Context, organizationID int64) ([]domain.Member, error) {
	if organizationID <= 0 {
		return nil, fmt.Errorf("%w: organization id must be positive", domain.ErrInvalidPermissionCheck)
	}
	return s.repo.ListMembers(ctx, organizationID)
}

func (s *Service) UpsertMember(ctx context.Context, member domain.Member) (*domain.Member, error) {
	if member.OrganizationID <= 0 || member.UserID <= 0 {
		return nil, fmt.Errorf("%w: invalid organization or user id", domain.ErrInvalidPermissionCheck)
	}
	member.Roles = normalizeRoles(member.Roles)
	if len(member.Roles) == 0 {
		member.Roles = []string{"viewer"}
	}
	if err := s.repo.UpsertMember(ctx, &member); err != nil {
		return nil, fmt.Errorf("upsert member: %w", err)
	}
	return &member, nil
}

func (s *Service) UpdateMemberRoles(ctx context.Context, organizationID, userID int64, roles []string) (*domain.Member, error) {
	if organizationID <= 0 || userID <= 0 {
		return nil, fmt.Errorf("%w: invalid organization or user id", domain.ErrInvalidPermissionCheck)
	}
	normalized := normalizeRoles(roles)
	if len(normalized) == 0 {
		return nil, fmt.Errorf("%w: at least one role is required", domain.ErrInvalidPermissionCheck)
	}
	member, err := s.repo.UpdateMemberRoles(ctx, organizationID, userID, normalized)
	if err != nil {
		return nil, fmt.Errorf("update member roles: %w", err)
	}
	return member, nil
}

func (s *Service) RemoveMember(ctx context.Context, organizationID, userID int64) error {
	if organizationID <= 0 || userID <= 0 {
		return fmt.Errorf("%w: invalid organization or user id", domain.ErrInvalidPermissionCheck)
	}
	if err := s.repo.RemoveMember(ctx, organizationID, userID); err != nil {
		return fmt.Errorf("remove member: %w", err)
	}
	return nil
}

func (s *Service) ListProjectMembers(ctx context.Context, organizationID int64, projectID string) ([]domain.ProjectMember, error) {
	if organizationID <= 0 || strings.TrimSpace(projectID) == "" {
		return nil, fmt.Errorf("%w: invalid organization or project id", domain.ErrInvalidPermissionCheck)
	}
	return s.repo.ListProjectMembers(ctx, organizationID, strings.TrimSpace(projectID))
}

func (s *Service) ListProjectMembersByUser(ctx context.Context, organizationID, userID int64) ([]domain.ProjectMember, error) {
	if organizationID <= 0 || userID <= 0 {
		return nil, fmt.Errorf("%w: invalid organization or user id", domain.ErrInvalidPermissionCheck)
	}
	return s.repo.ListProjectMembersByUser(ctx, organizationID, userID)
}

func (s *Service) UpsertProjectMember(ctx context.Context, member domain.ProjectMember) (*domain.ProjectMember, error) {
	member.ProjectID = strings.TrimSpace(member.ProjectID)
	member.Role = strings.ToLower(strings.TrimSpace(member.Role))
	if member.OrganizationID <= 0 || member.UserID <= 0 || member.ProjectID == "" || member.Role == "" {
		return nil, fmt.Errorf("%w: invalid project membership", domain.ErrInvalidPermissionCheck)
	}
	if err := s.repo.UpsertProjectMember(ctx, &member); err != nil {
		return nil, fmt.Errorf("upsert project member: %w", err)
	}
	return &member, nil
}

func (s *Service) RemoveProjectMember(ctx context.Context, organizationID int64, projectID string, userID int64) error {
	projectID = strings.TrimSpace(projectID)
	if organizationID <= 0 || userID <= 0 || projectID == "" {
		return fmt.Errorf("%w: invalid project membership", domain.ErrInvalidPermissionCheck)
	}
	if err := s.repo.RemoveProjectMember(ctx, organizationID, projectID, userID); err != nil {
		return fmt.Errorf("remove project member: %w", err)
	}
	return nil
}

func (s *Service) DeleteOrganizationPermissions(ctx context.Context, organizationID int64) error {
	if organizationID <= 0 {
		return fmt.Errorf("%w: organization id must be positive", domain.ErrInvalidPermissionCheck)
	}
	if err := s.repo.DeleteOrganizationPermissions(ctx, organizationID); err != nil {
		return fmt.Errorf("delete organization permissions: %w", err)
	}
	return nil
}

func normalizeRoles(roles []string) []string {
	normalized := make([]string, 0, len(roles))
	seen := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		next := strings.ToLower(strings.TrimSpace(role))
		if next == "" {
			continue
		}
		if _, ok := seen[next]; ok {
			continue
		}
		seen[next] = struct{}{}
		normalized = append(normalized, next)
	}
	return normalized
}
