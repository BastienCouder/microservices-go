package internalauth

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	internaljwt "github.com/bastiencouder/microservices-go/contracts/pkg/internaljwt"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type Claims struct {
	IdentityID   string
	UserID       int64
	Organization int64
}

type contextKey string

const claimsContextKey contextKey = "internal-jwt-claims"

type apiErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type apiErrorResponse struct {
	Error apiErrorBody `json:"error"`
}

func SignInternalJWT(secret, issuer, audience, subject string, claims Claims) (string, error) {
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

func VerifyInternalJWT(token, secret, expectedIssuer, expectedAudience string) (Claims, error) {
	verified, err := internaljwt.VerifyHS256(token, secret, expectedIssuer, expectedAudience)
	if err != nil {
		return Claims{}, fmt.Errorf("invalid internal authorization: %w", err)
	}
	return Claims{
		IdentityID:   verified.IdentityID,
		UserID:       verified.UserID,
		Organization: verified.OrganizationID,
	}, nil
}

func NewHTTPMiddleware(secret, issuer, audience string) func(http.Handler) http.Handler {
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
			claims, err := VerifyInternalJWT(token, secret, issuer, audience)
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

func NewUnaryAuthInterceptor(secret, issuer, audience string) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, _ *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, status.Error(codes.Unauthenticated, "missing metadata")
		}
		values := md.Get("authorization")
		if len(values) == 0 {
			return nil, status.Error(codes.Unauthenticated, "missing authorization")
		}
		raw := strings.TrimSpace(values[0])
		if !strings.HasPrefix(raw, "Bearer ") {
			return nil, status.Error(codes.Unauthenticated, "invalid authorization format")
		}
		token := strings.TrimSpace(strings.TrimPrefix(raw, "Bearer "))
		claims, err := VerifyInternalJWT(token, secret, issuer, audience)
		if err != nil {
			return nil, status.Error(codes.Unauthenticated, fmt.Sprintf("invalid token: %v", err))
		}
		return handler(context.WithValue(ctx, claimsContextKey, claims), req)
	}
}

func ClaimsFromContext(ctx context.Context) (Claims, bool) {
	claims, ok := ctx.Value(claimsContextKey).(Claims)
	return claims, ok
}

func writeUnauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(apiErrorResponse{Error: apiErrorBody{Code: "unauthorized", Message: "invalid internal authorization"}})
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
	return path == "/health" || path == "/ready"
}
