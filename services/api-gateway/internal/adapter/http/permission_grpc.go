package http

import (
	"context"
	"fmt"
	"time"

	permissionv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/permission/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

type permissionGRPCClient struct {
	conn   *grpc.ClientConn
	client permissionv1.PermissionServiceClient
}

func newPermissionGRPCClient(target string) (*permissionGRPCClient, error) {
	if target == "" {
		return nil, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	conn, err := grpc.DialContext(
		ctx,
		target,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		return nil, fmt.Errorf("dial permission grpc: %w", err)
	}
	return &permissionGRPCClient{
		conn:   conn,
		client: permissionv1.NewPermissionServiceClient(conn),
	}, nil
}

func (c *permissionGRPCClient) Close() error {
	if c == nil || c.conn == nil {
		return nil
	}
	return c.conn.Close()
}

func (c *permissionGRPCClient) Check(ctx context.Context, req *permissionv1.CheckRequest, bearerToken string) (*permissionv1.CheckResponse, error) {
	if c == nil || c.client == nil {
		return nil, fmt.Errorf("permission grpc client is not configured")
	}
	if bearerToken != "" {
		ctx = grpcMetadataWithBearer(ctx, bearerToken)
	}
	return c.client.Check(ctx, req)
}

func grpcMetadataWithBearer(ctx context.Context, bearerToken string) context.Context {
	return metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+bearerToken)
}
