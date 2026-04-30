package postgres

import "testing"

func TestRoleGrantsFullAccess(t *testing.T) {
	for _, role := range []string{"admin", "super_admin"} {
		if !roleGrantsFullAccess(role) {
			t.Fatalf("expected %s to grant full access", role)
		}
	}

	if roleGrantsFullAccess("owner") {
		t.Fatalf("owner should not grant full access")
	}
	if roleGrantsFullAccess("member") {
		t.Fatalf("member should not grant full access")
	}
}
