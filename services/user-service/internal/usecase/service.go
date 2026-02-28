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
