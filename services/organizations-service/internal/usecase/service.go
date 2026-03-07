package usecase

import (
	"context"
	"crypto/rand"
	"encoding/hex"
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

func (s *Service) ListOrganizationsByUser(ctx context.Context, userID int64) ([]domain.Membership, error) {
	if userID <= 0 {
		return nil, fmt.Errorf("%w: user id must be positive", domain.ErrInvalidMember)
	}
	memberships, err := s.repo.ListOrganizationsByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list organizations by user: %w", err)
	}
	return memberships, nil
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

func (s *Service) CreateInvitation(
	ctx context.Context,
	organizationID, invitedByUserID int64,
	email, role, message string,
	expiresAt *time.Time,
) (*domain.Invitation, error) {
	normalizedEmail, err := domain.NormalizeInvitationEmail(email)
	if err != nil {
		return nil, err
	}

	normalizedRole := "member"
	if strings.TrimSpace(role) != "" {
		normalizedRole, err = domain.NormalizeRole(role)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", domain.ErrInvalidInvitation, err)
		}
	}

	token, err := generateSecureTokenHex(24)
	if err != nil {
		return nil, fmt.Errorf("generate invitation token: %w", err)
	}

	now := s.now().UTC()
	invitation := &domain.Invitation{
		OrganizationID:  organizationID,
		Email:           normalizedEmail,
		Role:            normalizedRole,
		Token:           token,
		Message:         strings.TrimSpace(message),
		Status:          domain.InvitationStatusPending,
		InvitedByUserID: invitedByUserID,
		CreatedAt:       now,
		ExpiresAt:       copyTimePtrUTC(expiresAt),
	}
	if err := invitation.ValidateForCreate(); err != nil {
		return nil, err
	}

	if err := s.repo.CreateInvitation(ctx, invitation); err != nil {
		return nil, fmt.Errorf("create invitation: %w", err)
	}
	return invitation, nil
}

func (s *Service) ListInvitations(ctx context.Context, organizationID int64) ([]domain.Invitation, error) {
	if organizationID <= 0 {
		return nil, fmt.Errorf("%w: organization id must be positive", domain.ErrInvalidInvitation)
	}
	invitations, err := s.repo.ListInvitations(ctx, organizationID)
	if err != nil {
		return nil, fmt.Errorf("list invitations: %w", err)
	}
	return invitations, nil
}

func (s *Service) GetInvitation(ctx context.Context, organizationID, invitationID int64) (*domain.Invitation, error) {
	if organizationID <= 0 || invitationID <= 0 {
		return nil, fmt.Errorf("%w: invalid organization or invitation id", domain.ErrInvalidInvitation)
	}
	invitation, err := s.repo.GetInvitationByID(ctx, organizationID, invitationID)
	if err != nil {
		return nil, fmt.Errorf("get invitation: %w", err)
	}
	return invitation, nil
}

func (s *Service) UpdateInvitation(
	ctx context.Context,
	organizationID, invitationID int64,
	email, role, message string,
	expiresAt *time.Time,
) (*domain.Invitation, error) {
	if organizationID <= 0 || invitationID <= 0 {
		return nil, fmt.Errorf("%w: invalid organization or invitation id", domain.ErrInvalidInvitation)
	}
	normalizedEmail, err := domain.NormalizeInvitationEmail(email)
	if err != nil {
		return nil, err
	}
	normalizedRole, err := domain.NormalizeRole(role)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", domain.ErrInvalidInvitation, err)
	}

	invitation := &domain.Invitation{
		ID:             invitationID,
		OrganizationID: organizationID,
		Email:          normalizedEmail,
		Role:           normalizedRole,
		Message:        strings.TrimSpace(message),
		ExpiresAt:      copyTimePtrUTC(expiresAt),
	}
	updated, err := s.repo.UpdateInvitation(ctx, invitation)
	if err != nil {
		return nil, fmt.Errorf("update invitation: %w", err)
	}
	return updated, nil
}

func (s *Service) DeleteInvitation(ctx context.Context, organizationID, invitationID int64) error {
	if organizationID <= 0 || invitationID <= 0 {
		return fmt.Errorf("%w: invalid organization or invitation id", domain.ErrInvalidInvitation)
	}
	if err := s.repo.DeleteInvitation(ctx, organizationID, invitationID); err != nil {
		return fmt.Errorf("delete invitation: %w", err)
	}
	return nil
}

func (s *Service) AcceptInvitation(ctx context.Context, token string, userID int64) (*domain.Invitation, *domain.Member, error) {
	trimmedToken := strings.TrimSpace(token)
	if trimmedToken == "" || userID <= 0 {
		return nil, nil, fmt.Errorf("%w: token and user id are required", domain.ErrInvalidInvitation)
	}
	invitation, member, err := s.repo.AcceptInvitationByToken(ctx, trimmedToken, userID, s.now().UTC())
	if err != nil {
		return nil, nil, fmt.Errorf("accept invitation: %w", err)
	}
	return invitation, member, nil
}

func (s *Service) RefuseInvitation(ctx context.Context, token string, userID int64) (*domain.Invitation, error) {
	trimmedToken := strings.TrimSpace(token)
	if trimmedToken == "" || userID <= 0 {
		return nil, fmt.Errorf("%w: token and user id are required", domain.ErrInvalidInvitation)
	}
	invitation, err := s.repo.RefuseInvitationByToken(ctx, trimmedToken, userID, s.now().UTC())
	if err != nil {
		return nil, fmt.Errorf("refuse invitation: %w", err)
	}
	return invitation, nil
}

func copyTimePtrUTC(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	clone := value.UTC()
	return &clone
}

func generateSecureTokenHex(size int) (string, error) {
	if size <= 0 {
		return "", fmt.Errorf("invalid token size")
	}
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
