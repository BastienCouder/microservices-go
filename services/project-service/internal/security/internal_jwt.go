package security

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
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
			r2.Header.Del("X-Authenticated-Identity-ID")
			r2.Header.Del("X-Authenticated-User-ID")
			r2.Header.Del("X-Organization-ID")
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
