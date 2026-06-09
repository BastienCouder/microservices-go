package usecase

import (
	"context"
	"fmt"
	"strings"

	"github.com/bastiencouder/microservices-go/services/permission-service/internal/domain"
)

type Service struct {
	repo         domain.Repository
	roleResolver RoleResolver
}

type RoleResolver interface {
	RolesForUser(ctx context.Context, organizationID, userID int64) ([]string, error)
}

func NewService(repo domain.Repository, roleResolver RoleResolver) *Service {
	return &Service{repo: repo, roleResolver: roleResolver}
}

func (s *Service) Check(ctx context.Context, in domain.CheckInput) (domain.CheckResult, error) {
	roles, err := s.roleResolver.RolesForUser(ctx, in.OrganizationID, in.UserID)
	if err != nil {
		return domain.CheckResult{}, fmt.Errorf("resolve user roles: %w", err)
	}

	in.Roles = roles
	for i := range in.Roles {
		in.Roles[i] = strings.TrimSpace(strings.ToLower(in.Roles[i]))
	}
	if err := in.Validate(); err != nil {
		return domain.CheckResult{}, err
	}
	result, err := s.repo.Check(ctx, in)
	if err != nil {
		return domain.CheckResult{}, fmt.Errorf("check permission: %w", err)
	}
	return result, nil
}
