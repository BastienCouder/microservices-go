package projectgrpc

import (
	"context"
	"fmt"
	"strings"
	"time"

	projectv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/project/v1"
	grpctls "github.com/bastiencouder/microservices-go/contracts/pkg/grpctls"
	"github.com/bastiencouder/microservices-go/contracts/pkg/internalauth"
	"github.com/bastiencouder/microservices-go/services/attribution-service/internal/usecase"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/connectivity"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const readyTimeout = 2 * time.Second

type Client struct {
	conn      *grpc.ClientConn
	client    projectv1.ProjectServiceClient
	jwtSecret string
	jwtIssuer string
}

func NewClient(target, jwtSecret, jwtIssuer string, tlsConfig grpctls.ClientConfig) (*Client, error) {
	target = strings.TrimSpace(target)
	if target == "" {
		return nil, fmt.Errorf("project grpc target is required")
	}
	dialOptions, err := grpctls.ClientDialOptions(tlsConfig)
	if err != nil {
		return nil, fmt.Errorf("configure project grpc tls: %w", err)
	}
	conn, err := grpc.Dial(target, dialOptions...)
	if err != nil {
		return nil, fmt.Errorf("dial project grpc: %w", err)
	}
	return &Client{
		conn:      conn,
		client:    projectv1.NewProjectServiceClient(conn),
		jwtSecret: strings.TrimSpace(jwtSecret),
		jwtIssuer: strings.TrimSpace(jwtIssuer),
	}, nil
}

func (c *Client) Close() error {
	if c == nil || c.conn == nil {
		return nil
	}
	return c.conn.Close()
}

func (c *Client) Ready(ctx context.Context) error {
	if c == nil || c.conn == nil {
		return fmt.Errorf("project grpc client is not configured")
	}
	readyCtx, cancel := context.WithTimeout(ctx, readyTimeout)
	defer cancel()

	for {
		state := c.conn.GetState()
		if state == connectivity.Ready {
			return nil
		}
		if state == connectivity.Shutdown {
			return fmt.Errorf("project grpc connection is shut down")
		}
		c.conn.Connect()
		if !c.conn.WaitForStateChange(readyCtx, state) {
			return fmt.Errorf("project grpc connection is not ready")
		}
	}
}

func (c *Client) GetProject(ctx context.Context, projectID string, organizationID int64) (usecase.ProjectMetadata, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return usecase.ProjectMetadata{}, fmt.Errorf("%w: projectId is required", usecase.ErrValidation)
	}
	if organizationID <= 0 {
		return usecase.ProjectMetadata{}, fmt.Errorf("%w: organizationId is required", usecase.ErrValidation)
	}

	token, err := internalauth.SignInternalJWT(
		c.jwtSecret,
		c.jwtIssuer,
		"project-service",
		"attribution-service",
		internalauth.Claims{Organization: organizationID},
	)
	if err != nil {
		return usecase.ProjectMetadata{}, fmt.Errorf("sign internal jwt: %w", err)
	}

	callCtx := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+token)
	resp, err := c.client.GetProjectImpactContext(callCtx, &projectv1.GetProjectImpactContextRequest{ProjectId: projectID})
	if err != nil {
		return usecase.ProjectMetadata{}, mapProjectGRPCError(err)
	}

	ga4 := resp.GetIntegrations().GetGa4()
	return usecase.ProjectMetadata{
		ID:             strings.TrimSpace(resp.GetProjectId()),
		OrganizationID: resp.GetOrganizationId(),
		Domain:         strings.TrimSpace(resp.GetDomain()),
		WebsiteURL:     strings.TrimSpace(resp.GetWebsiteUrl()),
		GA4: usecase.ProjectGA4Integration{
			PropertyID:         strings.TrimSpace(ga4.GetPropertyId()),
			ServiceAccountJSON: strings.TrimSpace(ga4.GetServiceAccountJson()),
			OAuthRefreshToken:  strings.TrimSpace(ga4.GetOauthRefreshToken()),
		},
	}, nil
}

func mapProjectGRPCError(err error) error {
	st, ok := status.FromError(err)
	if !ok {
		return err
	}
	switch st.Code() {
	case codes.InvalidArgument:
		return fmt.Errorf("%w: %s", usecase.ErrValidation, st.Message())
	case codes.NotFound:
		return fmt.Errorf("%w: project", usecase.ErrNotFound)
	case codes.PermissionDenied, codes.Unauthenticated:
		return fmt.Errorf("%w: project access denied", usecase.ErrUnauthorized)
	default:
		return err
	}
}
