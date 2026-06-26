package internaljwt

import (
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type TokenClaims struct {
	IdentityID     string `json:"identity_id,omitempty"`
	UserID         int64  `json:"user_id,omitempty"`
	OrganizationID int64  `json:"organization_id,omitempty"`
}

type claims struct {
	TokenClaims
	jwt.RegisteredClaims
}

func SignHS256(secret, issuer, audience, subject string, tokenClaims TokenClaims, ttl time.Duration) (string, error) {
	secret = strings.TrimSpace(secret)
	issuer = strings.TrimSpace(issuer)
	audience = strings.TrimSpace(audience)
	subject = strings.TrimSpace(subject)

	if secret == "" {
		return "", fmt.Errorf("jwt secret is required")
	}
	if issuer == "" {
		return "", fmt.Errorf("jwt issuer is required")
	}
	if audience == "" {
		return "", fmt.Errorf("jwt audience is required")
	}
	if subject == "" {
		return "", fmt.Errorf("jwt subject is required")
	}
	if ttl <= 0 {
		return "", fmt.Errorf("jwt ttl must be positive")
	}

	now := time.Now().UTC()
	registered := jwt.RegisteredClaims{
		Issuer:    issuer,
		Subject:   subject,
		Audience:  jwt.ClaimStrings{audience},
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
	}

	unsigned := claims{
		TokenClaims:      tokenClaims,
		RegisteredClaims: registered,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, unsigned)
	return token.SignedString([]byte(secret))
}

func VerifyHS256(tokenString, secret, expectedIssuer, expectedAudience string) (TokenClaims, error) {
	var parsedClaims claims
	token, err := jwt.ParseWithClaims(
		tokenString,
		&parsedClaims,
		func(token *jwt.Token) (any, error) {
			if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
				return nil, fmt.Errorf("unexpected signing algorithm")
			}
			return []byte(secret), nil
		},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(strings.TrimSpace(expectedIssuer)),
		jwt.WithAudience(strings.TrimSpace(expectedAudience)),
		jwt.WithLeeway(5*time.Second),
	)
	if err != nil {
		return TokenClaims{}, fmt.Errorf("verify internal jwt: %w", err)
	}
	if token == nil || !token.Valid {
		return TokenClaims{}, fmt.Errorf("verify internal jwt: invalid token")
	}
	if parsedClaims.ExpiresAt == nil || parsedClaims.ExpiresAt.Before(time.Now().UTC()) {
		return TokenClaims{}, fmt.Errorf("verify internal jwt: token expired")
	}
	return parsedClaims.TokenClaims, nil
}
