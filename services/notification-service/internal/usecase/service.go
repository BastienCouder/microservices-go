package usecase

import (
	"context"
	"encoding/json"
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
	RenderNotification(ctx context.Context, title, message, locale string) (subject, html, text string, err error)
	RenderInvitation(ctx context.Context, payload InvitationEmailTemplateData) (subject, html, text string, err error)
}

type DeliveryMessage struct {
	Channel   string
	Recipient string
	Subject   string
	Message   string
	Template  string
	Locale    string
	Data      json.RawMessage
}

type InvitationEmailTemplateData struct {
	OrganizationName string     `json:"organizationName"`
	Role             string     `json:"role,omitempty"`
	ProjectName      string     `json:"projectName,omitempty"`
	ProjectID        string     `json:"projectId,omitempty"`
	CustomMessage    string     `json:"customMessage,omitempty"`
	AcceptURL        string     `json:"acceptUrl,omitempty"`
	ExpiresAt        *time.Time `json:"expiresAt,omitempty"`
	Locale           string     `json:"locale"`
}

func NewService(repo domain.Repository, email EmailSender, templates TemplateRenderer) *Service {
	return &Service{repo: repo, email: email, templates: templates, now: time.Now}
}

func (s *Service) Send(ctx context.Context, channel, recipient, subject, message string) (*domain.Notification, error) {
	return s.SendMessage(ctx, DeliveryMessage{
		Channel:   channel,
		Recipient: recipient,
		Subject:   subject,
		Message:   message,
	})
}

func (s *Service) SendMessage(ctx context.Context, msg DeliveryMessage) (*domain.Notification, error) {
	notification := &domain.Notification{
		Channel:   strings.TrimSpace(strings.ToLower(msg.Channel)),
		Recipient: strings.TrimSpace(msg.Recipient),
		Subject:   strings.TrimSpace(msg.Subject),
		Message:   strings.TrimSpace(msg.Message),
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
		subject, htmlBody, textBody, err := s.renderEmailTemplate(ctx, notification, msg)
		if err != nil {
			return nil, err
		}
		if err := s.email.Send(ctx, notification.Recipient, subject, htmlBody, textBody); err != nil {
			return nil, fmt.Errorf("send notification email: %w", err)
		}
	}
	return notification, nil
}

func (s *Service) renderEmailTemplate(
	ctx context.Context,
	notification *domain.Notification,
	msg DeliveryMessage,
) (subject, htmlBody, textBody string, err error) {
	if strings.TrimSpace(msg.Template) == "invitation" {
		var payload InvitationEmailTemplateData
		if err := json.Unmarshal(msg.Data, &payload); err != nil {
			return "", "", "", fmt.Errorf("decode invitation template payload: %w", err)
		}
		if payload.Locale == "" {
			payload.Locale = normalizeLocale(msg.Locale)
		}
		subject, htmlBody, textBody, err = s.templates.RenderInvitation(ctx, payload)
		if err != nil {
			return "", "", "", fmt.Errorf("render invitation template: %w", err)
		}
		return subject, htmlBody, textBody, nil
	}

	subject, htmlBody, textBody, err = s.templates.RenderNotification(
		ctx,
		notification.Subject,
		notification.Message,
		normalizeLocale(msg.Locale),
	)
	if err != nil {
		return "", "", "", fmt.Errorf("render notification template: %w", err)
	}
	return subject, htmlBody, textBody, nil
}

func normalizeLocale(locale string) string {
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(locale)), "fr") {
		return "fr"
	}
	return "en"
}

func (s *Service) List(ctx context.Context, limit int) ([]domain.Notification, error) {
	notifications, err := s.repo.List(ctx, limit)
	if err != nil {
		return nil, fmt.Errorf("list notifications: %w", err)
	}
	return notifications, nil
}
