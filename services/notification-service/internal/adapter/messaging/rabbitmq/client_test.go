package rabbitmq

import "testing"

func TestDecodeNotificationMessage(t *testing.T) {
	message, err := decodeNotificationMessage([]byte(`{
		"channel": "email",
		"recipient": "invitee@example.com",
		"subject": "Invitation",
		"message": "Welcome",
		"template": "invitation",
		"locale": "en",
		"data": {"organizationName":"Acme"}
	}`))
	if err != nil {
		t.Fatalf("decode notification message: %v", err)
	}

	if message.Channel != "email" {
		t.Fatalf("expected email channel, got %q", message.Channel)
	}
	if message.Recipient != "invitee@example.com" {
		t.Fatalf("expected recipient invitee@example.com, got %q", message.Recipient)
	}
	if message.Subject != "Invitation" {
		t.Fatalf("expected subject Invitation, got %q", message.Subject)
	}
	if message.Message != "Welcome" {
		t.Fatalf("expected message Welcome, got %q", message.Message)
	}
	if message.Template != "invitation" {
		t.Fatalf("expected template invitation, got %q", message.Template)
	}
	if message.Locale != "en" {
		t.Fatalf("expected locale en, got %q", message.Locale)
	}
}
