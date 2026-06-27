package http

import (
	"context"
	"fmt"
	"time"

	permissionv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/permission/v1"
	grpctls "github.com/bastiencouder/microservices-go/contracts/pkg/grpctls"
	"google.golang.org/grpc"
	"google.golang.org/grpc/connectivity"
	"google.golang.org/grpc/metadata"
)

type permissionGRPCClient struct {
	conn   *grpc.ClientConn
	client permissionv1.PermissionServiceClient
}

func newPermissionGRPCClient(target string, tlsConfig grpctls.ClientConfig) (*permissionGRPCClient, error) {
	if target == "" {
		return nil, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	dialOptions, err := grpctls.ClientDialOptions(tlsConfig)
	if err != nil {
		return nil, fmt.Errorf("configure permission grpc tls: %w", err)
	}
	conn, err := grpc.NewClient(target, dialOptions...)
	if err != nil {
		return nil, fmt.Errorf("dial permission grpc: %w", err)
	}
	if err := waitForGRPCReady(ctx, conn); err != nil {
		_ = conn.Close()
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

func waitForGRPCReady(ctx context.Context, conn *grpc.ClientConn) error {
	for {
		state := conn.GetState()
		if state == connectivity.Ready {
			return nil
		}
		if state == connectivity.Shutdown {
			return fmt.Errorf("grpc connection is shut down")
		}
		conn.Connect()
		if !conn.WaitForStateChange(ctx, state) {
			return fmt.Errorf("grpc connection is not ready")
		}
	}
}
