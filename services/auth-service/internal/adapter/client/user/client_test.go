package user

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bastiencouder/microservices-go/services/auth-service/internal/domain"
)

func TestEnsureProfileChecksConsentForExistingUser(t *testing.T) {
	tests := []struct {
		name          string
		consentStatus int
		wantErr       error
	}{
		{name: "accepted", consentStatus: http.StatusOK},
		{name: "missing", consentStatus: http.StatusForbidden, wantErr: ErrConsentRequired},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch r.URL.Path {
				case "/users/by-auth/kratos-id":
					w.WriteHeader(http.StatusOK)
				case "/users/consent/check":
					w.WriteHeader(tt.consentStatus)
				default:
					http.NotFound(w, r)
				}
			}))
			defer server.Close()

			client := NewClient(server.URL, "test-secret-at-least-32-characters", "auth-service")
			err := client.EnsureProfile(context.Background(), domain.Identity{ID: "kratos-id", Traits: domain.Traits{Email: "ada@example.com"}}, false)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("expected error %v, got %v", tt.wantErr, err)
			}
		})
	}
}

func TestDeriveNames(t *testing.T) {
	t.Run("full name", func(t *testing.T) {
		first, last := deriveNames("Ada Lovelace", "ada@example.com")
		if first != "Ada" || last != "Lovelace" {
			t.Fatalf("unexpected names: %q %q", first, last)
		}
	})

	t.Run("single token", func(t *testing.T) {
		first, last := deriveNames("Plato", "plato@example.com")
		if first != "Plato" || last != "Plato" {
			t.Fatalf("unexpected names: %q %q", first, last)
		}
	})

	t.Run("fallback to email local part", func(t *testing.T) {
		first, last := deriveNames("", "john.doe+test@example.com")
		if first != "John Doe Test" || last != "John Doe Test" {
			t.Fatalf("unexpected names: %q %q", first, last)
		}
	})
}
