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

func (s *Service) CreateUser(ctx context.Context, authIdentityID, email, firstName, lastName string) (*domain.User, error) {
	user := &domain.User{
		AuthIdentityID: strings.TrimSpace(authIdentityID),
		Email:          strings.TrimSpace(strings.ToLower(email)),
		FirstName:      strings.TrimSpace(firstName),
		LastName:       strings.TrimSpace(lastName),
		CreatedAt:      s.now().UTC(),
	}
	if err := user.Validate(); err != nil {
		return nil, err
	}
	if err := s.repo.Create(ctx, user); err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return user, nil
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
	if err := s.repo.SoftDelete(ctx, id, s.now().UTC()); err != nil {
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
