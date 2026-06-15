package rabbitmq

import (
	"strings"
	"testing"

	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/usecase"
)

func TestBuildInvitationNotificationMessage(t *testing.T) {
	message := buildInvitationNotificationMessage(usecase.InvitationNotification{
		Email:            "invitee@example.com",
		OrganizationName: "Acme",
		Locale:           "en",
		Role:             "viewer",
		Message:          "Welcome aboard",
		AcceptURL:        "http://localhost:30004/invitations/token-123",
	})

	if message.Channel != "email" {
		t.Fatalf("expected email channel, got %q", message.Channel)
	}
	if message.Recipient != "invitee@example.com" {
		t.Fatalf("expected recipient invitee@example.com, got %q", message.Recipient)
	}
	if message.Subject != "Invitation à rejoindre Acme" {
		t.Fatalf("unexpected subject: %q", message.Subject)
	}
	if message.Template != "invitation" {
		t.Fatalf("expected invitation template, got %q", message.Template)
	}
	if message.Locale != "en" {
		t.Fatalf("expected locale en, got %q", message.Locale)
	}
	if !strings.Contains(message.Message, "http://localhost:30004/invitations/token-123") {
		t.Fatalf("expected message to include accept URL, got %q", message.Message)
	}
}
