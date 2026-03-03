package http

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"
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
	headerBytes, err := json.Marshal(map[string]string{
		"alg": "HS256",
		"typ": "JWT",
	})
	if err != nil {
		return "", err
	}

	now := time.Now().UTC()
	claims.Issuer = issuer
	claims.Audience = audience
	claims.Subject = "api-gateway"
	claims.IssuedAt = now.Unix()
	claims.ExpiresAt = now.Add(60 * time.Second).Unix()

	payloadBytes, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	hb := base64.RawURLEncoding.EncodeToString(headerBytes)
	pb := base64.RawURLEncoding.EncodeToString(payloadBytes)
	unsigned := hb + "." + pb

	mac := hmac.New(sha256.New, []byte(secret))
	if _, err := mac.Write([]byte(unsigned)); err != nil {
		return "", err
	}
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return unsigned + "." + sig, nil
}

func verifyInternalJWT(token, secret, expectedIssuer, expectedAudience string) (internalTokenClaims, error) {
	var claims internalTokenClaims
	parts := splitJWT(token)
	if len(parts) != 3 {
		return claims, fmt.Errorf("invalid jwt format")
	}

	unsigned := parts[0] + "." + parts[1]
	mac := hmac.New(sha256.New, []byte(secret))
	if _, err := mac.Write([]byte(unsigned)); err != nil {
		return claims, err
	}
	expectedSig := mac.Sum(nil)
	actualSig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return claims, fmt.Errorf("invalid jwt signature encoding")
	}
	if !hmac.Equal(actualSig, expectedSig) {
		return claims, fmt.Errorf("invalid jwt signature")
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return claims, fmt.Errorf("invalid jwt payload encoding")
	}
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return claims, fmt.Errorf("invalid jwt payload")
	}

	now := time.Now().UTC().Unix()
	if claims.ExpiresAt < now {
		return claims, fmt.Errorf("jwt expired")
	}
	if claims.Issuer != expectedIssuer {
		return claims, fmt.Errorf("invalid jwt issuer")
	}
	if claims.Audience != expectedAudience {
		return claims, fmt.Errorf("invalid jwt audience")
	}
	return claims, nil
}

func splitJWT(token string) []string {
	parts := make([]string, 0, 3)
	start := 0
	for i := 0; i < len(token); i++ {
		if token[i] == '.' {
			parts = append(parts, token[start:i])
			start = i + 1
		}
	}
	parts = append(parts, token[start:])
	return parts
}
