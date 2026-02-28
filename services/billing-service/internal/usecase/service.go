package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"
)

type Service struct {
	repo domain.Repository
	now  func() time.Time
}

func NewService(repo domain.Repository) *Service {
	return &Service{repo: repo, now: time.Now}
}

func (s *Service) UpsertSubscription(ctx context.Context, organizationID int64, plan string, seats, monthlyQuota int) (*domain.Subscription, error) {
	sub := &domain.Subscription{
		OrganizationID: organizationID,
		Plan:           strings.TrimSpace(strings.ToLower(plan)),
		Seats:          seats,
		MonthlyQuota:   monthlyQuota,
		UpdatedAt:      s.now().UTC(),
	}
	if err := sub.Validate(); err != nil {
		return nil, err
	}
	if err := s.repo.Upsert(ctx, sub); err != nil {
		return nil, fmt.Errorf("upsert subscription: %w", err)
	}
	return sub, nil
}

func (s *Service) GetSubscription(ctx context.Context, organizationID int64) (*domain.Subscription, error) {
	sub, err := s.repo.GetByOrganizationID(ctx, organizationID)
	if err != nil {
		return nil, fmt.Errorf("get subscription: %w", err)
	}
	return sub, nil
}
