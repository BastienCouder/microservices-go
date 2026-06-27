package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/user-service/internal/domain"
)

type Service struct {
	repo domain.Repository
	now  func() time.Time
}

func NewService(repo domain.Repository) *Service {
	return &Service{repo: repo, now: time.Now}
}

func (s *Service) CreateUser(ctx context.Context, authIdentityID, email, firstName, lastName string, consentAccepted bool, consentType, consentVersion string) (*domain.User, error) {
	consentType = strings.TrimSpace(consentType)
	consentVersion = strings.TrimSpace(consentVersion)
	if !consentAccepted || consentType != domain.ConsentTypePrivacyPolicy || consentVersion != domain.ConsentVersionV1 {
		return nil, domain.ErrConsentRequired
	}
	acceptedAt := s.now().UTC()
	user := &domain.User{
		AuthIdentityID: strings.TrimSpace(authIdentityID),
		Email:          strings.TrimSpace(strings.ToLower(email)),
		FirstName:      strings.TrimSpace(firstName),
		LastName:       strings.TrimSpace(lastName),
		CreatedAt:      acceptedAt,
	}
	if err := user.Validate(); err != nil {
		return nil, err
	}
	consent := domain.UserConsent{Type: consentType, Version: consentVersion, AcceptedAt: acceptedAt}
	if err := s.repo.Create(ctx, user, consent); err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return user, nil
}

func (s *Service) HasValidConsent(ctx context.Context, authIdentityID, consentType, version string) (bool, error) {
	authIdentityID = strings.TrimSpace(authIdentityID)
	if authIdentityID == "" || strings.TrimSpace(consentType) == "" || strings.TrimSpace(version) == "" {
		return false, domain.ErrConsentRequired
	}
	ok, err := s.repo.HasConsentByAuthIdentityID(ctx, authIdentityID, consentType, version)
	if err != nil {
		return false, fmt.Errorf("check user consent: %w", err)
	}
	return ok, nil
}

func (s *Service) AcceptConsent(ctx context.Context, authIdentityID, consentType, version string) error {
	if strings.TrimSpace(authIdentityID) == "" || consentType != domain.ConsentTypePrivacyPolicy || version != domain.ConsentVersionV1 {
		return domain.ErrConsentRequired
	}
	consent := domain.UserConsent{Type: consentType, Version: version, AcceptedAt: s.now().UTC()}
	if err := s.repo.AddConsentByAuthIdentityID(ctx, strings.TrimSpace(authIdentityID), consent); err != nil {
		return fmt.Errorf("accept user consent: %w", err)
	}
	return nil
}

func (s *Service) ListUsers(ctx context.Context) ([]domain.User, error) {
	users, err := s.repo.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	return users, nil
}

func (s *Service) GetUser(ctx context.Context, id int64) (*domain.User, error) {
	user, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get user %d: %w", id, err)
	}
	return user, nil
}

func (s *Service) GetUserByAuthIdentityID(ctx context.Context, authIdentityID string) (*domain.User, error) {
	user, err := s.repo.GetByAuthIdentityID(ctx, strings.TrimSpace(authIdentityID))
	if err != nil {
		return nil, fmt.Errorf("get user by auth identity id: %w", err)
	}
	return user, nil
}

func (s *Service) UpdateUserProfile(ctx context.Context, id int64, firstName, lastName string) (*domain.User, error) {
	if id <= 0 {
		return nil, fmt.Errorf("%w: user id must be positive", domain.ErrInvalidUser)
	}
	firstName = strings.TrimSpace(firstName)
	lastName = strings.TrimSpace(lastName)
	if firstName == "" {
		return nil, fmt.Errorf("%w: first name is required", domain.ErrInvalidUser)
	}
	if lastName == "" {
		return nil, fmt.Errorf("%w: last name is required", domain.ErrInvalidUser)
	}
	user, err := s.repo.UpdateProfile(ctx, id, firstName, lastName)
	if err != nil {
		return nil, fmt.Errorf("update user profile %d: %w", id, err)
	}
	return user, nil
}

func (s *Service) BanUser(ctx context.Context, id int64) error {
	if id <= 0 {
		return fmt.Errorf("%w: user id must be positive", domain.ErrInvalidUser)
	}
	if err := s.repo.SetBanned(ctx, id, true, s.now().UTC()); err != nil {
		return fmt.Errorf("ban user %d: %w", id, err)
	}
	return nil
}

func (s *Service) UnbanUser(ctx context.Context, id int64) error {
	if id <= 0 {
		return fmt.Errorf("%w: user id must be positive", domain.ErrInvalidUser)
	}
	if err := s.repo.SetBanned(ctx, id, false, time.Time{}); err != nil {
		return fmt.Errorf("unban user %d: %w", id, err)
	}
	return nil
}

func (s *Service) DeleteUser(ctx context.Context, id int64) error {
	if id <= 0 {
		return fmt.Errorf("%w: user id must be positive", domain.ErrInvalidUser)
	}
	anonymized := domain.AnonymizedUser{
		AuthIdentityID: fmt.Sprintf("deleted-user-%d", id),
		Email:          fmt.Sprintf("deleted-user-%d@anonymized.local", id),
		FirstName:      "Deleted",
		LastName:       "User",
	}
	if err := s.repo.SoftDelete(ctx, id, s.now().UTC(), anonymized); err != nil {
		return fmt.Errorf("delete user %d: %w", id, err)
	}
	return nil
}

func (s *Service) RestoreUser(ctx context.Context, id int64) error {
	if id <= 0 {
		return fmt.Errorf("%w: user id must be positive", domain.ErrInvalidUser)
	}
	if err := s.repo.Restore(ctx, id); err != nil {
		return fmt.Errorf("restore user %d: %w", id, err)
	}
	return nil
}
