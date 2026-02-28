package usecase

import (
	"context"
	"errors"
	"testing"

	"github.com/bastiencouder/microservices-go/services/notification-service/internal/domain"
)

type fakeRepo struct {
	notifications []domain.Notification
}

type fakeEmailSender struct {
	sent int
}

func (f *fakeEmailSender) Send(_ context.Context, _, _, _, _ string) error {
	f.sent++
	return nil
}

type fakeTemplateRenderer struct{}

func (f *fakeTemplateRenderer) RenderNotification(_ context.Context, title, message string) (string, string, string, error) {
	return title, "<p>" + message + "</p>", message, nil
}

func (f *fakeRepo) Create(_ context.Context, notification *domain.Notification) error {
	notification.ID = int64(len(f.notifications) + 1)
	f.notifications = append(f.notifications, *notification)
	return nil
}

func (f *fakeRepo) List(_ context.Context, limit int) ([]domain.Notification, error) {
	if limit > len(f.notifications) {
		limit = len(f.notifications)
	}
	out := make([]domain.Notification, limit)
	copy(out, f.notifications[:limit])
	return out, nil
}

func TestSend(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo, &fakeEmailSender{}, &fakeTemplateRenderer{})
	_, err := svc.Send(context.Background(), "email", "john@example.com", "subject", "hello")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	_, err = svc.Send(context.Background(), "", "", "", "")
	if !errors.Is(err, domain.ErrInvalidNotification) {
		t.Fatalf("expected invalid notification error, got %v", err)
	}
}
