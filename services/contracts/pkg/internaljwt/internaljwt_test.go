package internaljwt

import (
	"testing"
	"time"
)

func TestSignAndVerifyHS256(t *testing.T) {
	token, err := SignHS256(
		"super-secret",
		"api-gateway",
		"analysis-service",
		"project-service",
		TokenClaims{
			IdentityID:     "kratos-1",
			UserID:         42,
			OrganizationID: 7,
		},
		time.Minute,
	)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	claims, err := VerifyHS256(token, "super-secret", "api-gateway", "analysis-service")
	if err != nil {
		t.Fatalf("verify token: %v", err)
	}
	if claims.IdentityID != "kratos-1" {
		t.Fatalf("unexpected identity: %q", claims.IdentityID)
	}
	if claims.UserID != 42 {
		t.Fatalf("unexpected user_id: %d", claims.UserID)
	}
	if claims.OrganizationID != 7 {
		t.Fatalf("unexpected organization_id: %d", claims.OrganizationID)
	}
}

func TestVerifyHS256RejectsWrongAudience(t *testing.T) {
	token, err := SignHS256(
		"super-secret",
		"api-gateway",
		"analysis-service",
		"project-service",
		TokenClaims{UserID: 42},
		time.Minute,
	)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	if _, err := VerifyHS256(token, "super-secret", "api-gateway", "permission-service"); err == nil {
		t.Fatal("expected audience verification failure")
	}
}

func TestSignHS256RejectsNonPositiveTTL(t *testing.T) {
	if _, err := SignHS256(
		"super-secret",
		"api-gateway",
		"analysis-service",
		"project-service",
		TokenClaims{},
		0,
	); err == nil {
		t.Fatal("expected ttl validation error")
	}
}
