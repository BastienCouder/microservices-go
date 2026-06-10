package organizations

import (
	"context"
	"fmt"
	"strings"
	"time"

	organizationsv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/organizations/v1"
	grpctls "github.com/bastiencouder/microservices-go/contracts/pkg/grpctls"
	"github.com/bastiencouder/microservices-go/contracts/pkg/internalauth"
	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

type Client struct {
	conn      *grpc.ClientConn
	client    organizationsv1.OrganizationsServiceClient
	jwtSecret string
	jwtIssuer string
}

func NewClient(target, jwtSecret, jwtIssuer string, tlsConfig grpctls.ClientConfig) (*Client, error) {
	target = strings.TrimSpace(target)
	if target == "" {
		return nil, fmt.Errorf("organizations grpc target is required")
	}
	dialOptions, err := grpctls.ClientDialOptions(tlsConfig)
	if err != nil {
		return nil, fmt.Errorf("configure organizations grpc tls: %w", err)
	}
	conn, err := grpc.Dial(target, dialOptions...)
	if err != nil {
		return nil, fmt.Errorf("dial organizations grpc: %w", err)
	}
	return &Client{
		conn:      conn,
		client:    organizationsv1.NewOrganizationsServiceClient(conn),
		jwtSecret: jwtSecret,
		jwtIssuer: jwtIssuer,
	}, nil
}

func (c *Client) Close() error {
	if c == nil || c.conn == nil {
		return nil
	}
	return c.conn.Close()
}

func (c *Client) ListProjectMembersByUser(ctx context.Context, organizationID, userID int64) ([]usecase.ProjectMember, error) {
	if organizationID <= 0 || userID <= 0 {
		return nil, fmt.Errorf("organization id and user id must be positive")
	}
	token, err := internalauth.SignInternalJWT(
		c.jwtSecret,
		c.jwtIssuer,
		"organizations-service",
		"project-service",
		internalauth.Claims{Organization: organizationID, UserID: userID},
	)
	if err != nil {
		return nil, fmt.Errorf("sign internal jwt: %w", err)
	}

	callCtx, cancel := context.WithTimeout(ctx, 700*time.Millisecond)
	defer cancel()
	callCtx = metadata.AppendToOutgoingContext(callCtx, "authorization", "Bearer "+token)

	resp, err := c.client.ListProjectMembersByUser(callCtx, &organizationsv1.ListProjectMembersByUserRequest{})
	if err != nil {
		return nil, fmt.Errorf("list project memberships grpc: %w", err)
	}

	members := make([]usecase.ProjectMember, 0, len(resp.GetMembers()))
	for _, item := range resp.GetMembers() {
		var addedAt time.Time
		if strings.TrimSpace(item.GetAddedAt()) != "" {
			if parsed, err := time.Parse(time.RFC3339Nano, item.GetAddedAt()); err == nil {
				addedAt = parsed.UTC()
			}
		}
		members = append(members, usecase.ProjectMember{
			ProjectID:      strings.TrimSpace(item.GetProjectId()),
			OrganizationID: item.GetOrganizationId(),
			UserID:         item.GetUserId(),
			Role:           strings.TrimSpace(item.GetRole()),
			AddedAt:        addedAt,
		})
	}
	return members, nil
}
