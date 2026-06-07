package grpc

import (
	"context"
	"errors"
	"time"

	organizationsv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/organizations/v1"
	"github.com/bastiencouder/microservices-go/contracts/pkg/internalauth"
	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/domain"
	"github.com/bastiencouder/microservices-go/services/organizations-service/internal/usecase"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type Server struct {
	svc *usecase.Service
	organizationsv1.UnimplementedOrganizationsServiceServer
}

func NewServer(svc *usecase.Service) *Server {
	return &Server{svc: svc}
}

func (s *Server) ListProjectMembersByUser(ctx context.Context, _ *organizationsv1.ListProjectMembersByUserRequest) (*organizationsv1.ListProjectMembersByUserResponse, error) {
	claims, ok := internalauth.ClaimsFromContext(ctx)
	if !ok || claims.Organization <= 0 || claims.UserID <= 0 {
		return nil, status.Error(codes.Unauthenticated, "missing organization or user claim")
	}

	members, err := s.svc.ListProjectMembersByUser(ctx, claims.Organization, claims.UserID)
	if err != nil {
		return nil, toStatus(err)
	}

	resp := &organizationsv1.ListProjectMembersByUserResponse{
		Members: make([]*organizationsv1.ProjectMember, 0, len(members)),
	}
	for _, member := range members {
		resp.Members = append(resp.Members, &organizationsv1.ProjectMember{
			ProjectId:      member.ProjectID,
			OrganizationId: member.OrganizationID,
			UserId:         member.UserID,
			Role:           member.Role,
			AddedAt:        member.AddedAt.UTC().Format(time.RFC3339Nano),
		})
	}
	return resp, nil
}

func toStatus(err error) error {
	switch {
	case errors.Is(err, domain.ErrInvalidMember),
		errors.Is(err, domain.ErrInvalidOrganization),
		errors.Is(err, domain.ErrInvalidRole):
		return status.Error(codes.InvalidArgument, err.Error())
	case errors.Is(err, domain.ErrOrganizationNotFound),
		errors.Is(err, domain.ErrMemberNotFound):
		return status.Error(codes.NotFound, err.Error())
	default:
		return status.Error(codes.Internal, err.Error())
	}
}
