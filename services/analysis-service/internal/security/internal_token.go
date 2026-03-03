package security

import (
	"time"

	internaljwt "github.com/bastiencouder/microservices-go/contracts/pkg/internaljwt"
)

type OutboundTokenClaims struct {
	IdentityID   string
	UserID       int64
	Organization int64
}

func SignInternalJWT(secret, issuer, audience, subject string, claims OutboundTokenClaims) (string, error) {
	return internaljwt.SignHS256(
		secret,
		issuer,
		audience,
		subject,
		internaljwt.TokenClaims{
			IdentityID:     claims.IdentityID,
			UserID:         claims.UserID,
			OrganizationID: claims.Organization,
		},
		60*time.Second,
	)
}
