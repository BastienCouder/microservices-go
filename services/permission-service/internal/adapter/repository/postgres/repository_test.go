package postgres

import "testing"

func TestRoleGrantsFullAccess(t *testing.T) {
	for _, role := range []string{"owner", "admin", "super_admin"} {
		if !roleGrantsFullAccess(role) {
			t.Fatalf("expected %s to grant full access", role)
		}
	}

	if roleGrantsFullAccess("member") {
		t.Fatalf("member should not grant full access")
	}
}
