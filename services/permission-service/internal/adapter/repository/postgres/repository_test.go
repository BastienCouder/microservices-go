package postgres

import "testing"

func TestRoleGrantsFullAccess(t *testing.T) {
	for _, role := range []string{"editor", "super_admin"} {
		if !roleGrantsFullAccess(role) {
			t.Fatalf("expected %s to grant full access", role)
		}
	}

	for _, role := range []string{"owner", "viewer"} {
		if roleGrantsFullAccess(role) {
			t.Fatalf("%s should not grant product full access", role)
		}
	}
}

func TestRoleGrantsAdminAccess(t *testing.T) {
	if !roleGrantsAdminAccess("super_admin") {
		t.Fatalf("super_admin should grant admin access")
	}
	if roleGrantsAdminAccess("owner") || roleGrantsAdminAccess("editor") {
		t.Fatalf("product roles should not grant admin access")
	}
}
