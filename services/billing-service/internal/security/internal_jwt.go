package security

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
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

func NewInternalAuthMiddleware(secret, issuer, audience string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodOptions || isPublicPath(r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}

			authz := strings.TrimSpace(r.Header.Get("Authorization"))
			if !strings.HasPrefix(authz, "Bearer ") {
				writeUnauthorized(w)
				auditDenied(r, "missing bearer token")
				return
			}

			token := strings.TrimSpace(strings.TrimPrefix(authz, "Bearer "))
			claims, err := verifyInternalJWT(token, secret, issuer, audience)
			if err != nil {
				writeUnauthorized(w)
				auditDenied(r, err.Error())
				return
			}

			r2 := r.Clone(r.Context())
			r2.Header = r.Header.Clone()
			if claims.IdentityID != "" {
				r2.Header.Set("X-Authenticated-Identity-ID", claims.IdentityID)
			}
			if claims.UserID > 0 {
				r2.Header.Set("X-Authenticated-User-ID", strconv.FormatInt(claims.UserID, 10))
			}
			if claims.Organization > 0 {
				r2.Header.Set("X-Organization-ID", strconv.FormatInt(claims.Organization, 10))
			}
			next.ServeHTTP(w, r2)
		})
	}
}

func writeUnauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid internal authorization"})
}

func auditDenied(r *http.Request, reason string) {
	payload := map[string]any{
		"event":     "internal_auth_denied",
		"component": "service-middleware",
		"ts":        time.Now().UTC().Format(time.RFC3339Nano),
		"path":      r.URL.Path,
		"method":    r.Method,
		"reason":    reason,
	}
	raw, _ := json.Marshal(payload)
	log.Printf("audit %s", string(raw))
}

func isPublicPath(path string) bool {
	return path == "/health" || path == "/ready" || path == "/metrics"
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
