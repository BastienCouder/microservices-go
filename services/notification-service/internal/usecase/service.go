package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/notification-service/internal/domain"
)

type Service struct {
	repo domain.Repository
	now  func() time.Time
}

func NewService(repo domain.Repository) *Service {
	return &Service{repo: repo, now: time.Now}
}

func (s *Service) Send(ctx context.Context, channel, recipient, subject, message string) (*domain.Notification, error) {
	notification := &domain.Notification{
		Channel:   strings.TrimSpace(strings.ToLower(channel)),
		Recipient: strings.TrimSpace(recipient),
		Subject:   strings.TrimSpace(subject),
		Message:   strings.TrimSpace(message),
		CreatedAt: s.now().UTC(),
	}
	if err := notification.Validate(); err != nil {
		return nil, err
	}
	if err := s.repo.Create(ctx, notification); err != nil {
		return nil, fmt.Errorf("create notification: %w", err)
	}
	return notification, nil
}

func (s *Service) List(ctx context.Context, limit int) ([]domain.Notification, error) {
	notifications, err := s.repo.List(ctx, limit)
	if err != nil {
		return nil, fmt.Errorf("list notifications: %w", err)
	}
	return notifications, nil
}
