package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/domain"
)

type Service struct {
	repo domain.Repository
	now  func() time.Time
}

func NewService(repo domain.Repository) *Service {
	return &Service{repo: repo, now: time.Now}
}

func (s *Service) CreateOrganization(ctx context.Context, name string, ownerIdentityID int64) (*domain.Organization, error) {
	org := &domain.Organization{
		Name:            strings.TrimSpace(name),
		OwnerIdentityID: ownerIdentityID,
		CreatedAt:       s.now().UTC(),
	}
	if err := org.Validate(); err != nil {
		return nil, err
	}

	if err := s.repo.Create(ctx, org); err != nil {
		return nil, fmt.Errorf("create organization: %w", err)
	}

	return org, nil
}

func (s *Service) GetOrganization(ctx context.Context, id int64) (*domain.Organization, error) {
	org, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get organization %d: %w", id, err)
	}
	return org, nil
}

func (s *Service) CreateTeam(ctx context.Context, organizationID int64, name string) (*domain.Team, error) {
	team := &domain.Team{
		OrganizationID: organizationID,
		Name:           strings.TrimSpace(name),
		CreatedAt:      s.now().UTC(),
	}
	if err := team.Validate(); err != nil {
		return nil, err
	}

	if err := s.repo.CreateTeam(ctx, team); err != nil {
		return nil, fmt.Errorf("create team: %w", err)
	}

	return team, nil
}

func (s *Service) ListTeams(ctx context.Context, organizationID int64) ([]domain.Team, error) {
	if organizationID <= 0 {
		return nil, fmt.Errorf("%w: organization id must be positive", domain.ErrInvalidTeam)
	}
	teams, err := s.repo.ListTeams(ctx, organizationID)
	if err != nil {
		return nil, fmt.Errorf("list teams: %w", err)
	}
	return teams, nil
}

func (s *Service) AddMember(ctx context.Context, organizationID, userID, teamID int64) (*domain.Member, error) {
	member := &domain.Member{
		OrganizationID: organizationID,
		UserID:         userID,
		TeamID:         teamID,
		Roles:          []string{"member"},
		AddedAt:        s.now().UTC(),
	}
	if err := member.Validate(); err != nil {
		return nil, err
	}

	if err := s.repo.UpsertMember(ctx, member); err != nil {
		return nil, fmt.Errorf("add member: %w", err)
	}

	return member, nil
}

func (s *Service) ListMembers(ctx context.Context, organizationID int64) ([]domain.Member, error) {
	if organizationID <= 0 {
		return nil, fmt.Errorf("%w: organization id must be positive", domain.ErrInvalidMember)
	}
	members, err := s.repo.ListMembers(ctx, organizationID)
	if err != nil {
		return nil, fmt.Errorf("list members: %w", err)
	}
	return members, nil
}

func (s *Service) AssignRole(ctx context.Context, organizationID, userID int64, role string) (*domain.Member, error) {
	normalizedRole, err := domain.NormalizeRole(role)
	if err != nil {
		return nil, err
	}
	if organizationID <= 0 || userID <= 0 {
		return nil, fmt.Errorf("%w: invalid organization or user id", domain.ErrInvalidMember)
	}

	member, err := s.repo.AssignRole(ctx, organizationID, userID, normalizedRole)
	if err != nil {
		return nil, fmt.Errorf("assign role: %w", err)
	}
	return member, nil
}
