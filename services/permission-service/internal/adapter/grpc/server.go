package grpc

import (
	"context"
	"fmt"
	"log"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	permissionv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/permission/v1"
	"github.com/bastiencouder/microservices-go/services/permission-service/internal/domain"
	"github.com/bastiencouder/microservices-go/services/permission-service/internal/usecase"
)

type Server struct {
	svc *usecase.Service
	permissionv1.UnimplementedPermissionServiceServer
}

func NewServer(svc *usecase.Service) *Server {
	return &Server{svc: svc}
}

func (s *Server) Check(ctx context.Context, req *permissionv1.CheckRequest) (*permissionv1.CheckResponse, error) {
	result, err := s.svc.Check(ctx, domain.CheckInput{
		OrganizationID: req.GetOrganizationId(),
		UserID:         req.GetUserId(),
		Action:         req.Action,
		Resource:       req.Resource,
	})
	if err != nil {
		log.Printf("permission grpc check failed: organization_id=%d user_id=%d action=%s resource=%s err=%v", req.GetOrganizationId(), req.GetUserId(), req.GetAction(), req.GetResource(), err)
		if isInvalidPermissionInput(err) {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		return nil, status.Error(codes.Internal, fmt.Sprintf("check permission: %v", err))
	}

	return &permissionv1.CheckResponse{
		Allowed: result.Allowed,
		Reason:  result.Reason,
	}, nil
}

func isInvalidPermissionInput(err error) bool {
	return err != nil && containsInvalidPermission(err)
}

func containsInvalidPermission(err error) bool {
	type unwrapper interface {
		Unwrap() error
	}
	if err == domain.ErrInvalidPermissionCheck {
		return true
	}
	uw, ok := err.(unwrapper)
	if !ok {
		return false
	}
	next := uw.Unwrap()
	if next == nil {
		return false
	}
	return containsInvalidPermission(next)
}
