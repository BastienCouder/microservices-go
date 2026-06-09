package http

import (
	"fmt"
	"time"

	internaljwt "github.com/bastiencouder/microservices-go/contracts/pkg/internaljwt"
)

type internalTokenClaims struct {
	Issuer       string `json:"iss"`
	Subject      string `json:"sub"`
	Audience     string `json:"aud"`
	IssuedAt     int64  `json:"iat"`
	ExpiresAt    int64  `json:"exp"`
	IdentityID   string `json:"identity_id,omitempty"`
	UserID       int64  `json:"user_id,omitempty"`
	Organization int64  `json:"organization_id,omitempty"`
}

func signInternalJWT(secret, issuer, audience string, claims internalTokenClaims) (string, error) {
	return internaljwt.SignHS256(
		secret,
		issuer,
		audience,
		"api-gateway",
		internaljwt.TokenClaims{
			IdentityID:     claims.IdentityID,
			UserID:         claims.UserID,
			OrganizationID: claims.Organization,
		},
		60*time.Second,
	)
}

func verifyInternalJWT(token, secret, expectedIssuer, expectedAudience string) (internalTokenClaims, error) {
	verified, err := internaljwt.VerifyHS256(token, secret, expectedIssuer, expectedAudience)
	if err != nil {
		return internalTokenClaims{}, fmt.Errorf("invalid internal authorization: %w", err)
	}
	return internalTokenClaims{
		Issuer:       expectedIssuer,
		Audience:     expectedAudience,
		IdentityID:   verified.IdentityID,
		UserID:       verified.UserID,
		Organization: verified.OrganizationID,
	}, nil
}
