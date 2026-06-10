package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/notification-service/internal/domain"
)

type Service struct {
	repo      domain.Repository
	email     EmailSender
	templates TemplateRenderer
	now       func() time.Time
}

type EmailSender interface {
	Send(ctx context.Context, toEmail, subject, htmlBody, textBody string) error
}

type TemplateRenderer interface {
	RenderNotification(ctx context.Context, title, message string) (subject, html, text string, err error)
}

func NewService(repo domain.Repository, email EmailSender, templates TemplateRenderer) *Service {
	return &Service{repo: repo, email: email, templates: templates, now: time.Now}
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
	if notification.Channel == "email" {
		if s.email == nil || s.templates == nil {
			return nil, fmt.Errorf("email delivery is not configured")
		}
		subject, htmlBody, textBody, err := s.templates.RenderNotification(ctx, notification.Subject, notification.Message)
		if err != nil {
			return nil, fmt.Errorf("render notification template: %w", err)
		}
		if err := s.email.Send(ctx, notification.Recipient, subject, htmlBody, textBody); err != nil {
			return nil, fmt.Errorf("send notification email: %w", err)
		}
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
