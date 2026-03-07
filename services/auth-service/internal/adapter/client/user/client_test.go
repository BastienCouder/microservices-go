package user

import "testing"

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
