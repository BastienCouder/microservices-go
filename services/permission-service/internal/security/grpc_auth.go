package security

import (
	"context"
	"fmt"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

func NewUnaryAuthInterceptor(secret, issuer, audience string) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
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
		if _, err := verifyInternalJWT(token, secret, issuer, audience); err != nil {
			return nil, status.Error(codes.Unauthenticated, fmt.Sprintf("invalid token: %v", err))
		}
		return handler(ctx, req)
	}
}
