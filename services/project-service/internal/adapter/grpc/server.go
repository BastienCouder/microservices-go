package grpc

import (
	"context"
	"errors"

	projectv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/project/v1"
	"github.com/bastiencouder/microservices-go/services/project-service/internal/security"
	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type Server struct {
	svc *usecase.Service
	projectv1.UnimplementedProjectServiceServer
}

func NewServer(svc *usecase.Service) *Server {
	return &Server{svc: svc}
}

func (s *Server) CheckProjectAccess(ctx context.Context, req *projectv1.CheckProjectAccessRequest) (*projectv1.CheckProjectAccessResponse, error) {
	if req.GetProjectId() == "" {
		return nil, status.Error(codes.InvalidArgument, "project_id is required")
	}

	claims, ok := security.ClaimsFromContext(ctx)
	if !ok || claims.Organization <= 0 {
		return nil, status.Error(codes.Unauthenticated, "missing organization claim")
	}

	_, err := s.svc.GetProject(ctx, req.GetProjectId(), claims.Organization)
	if err == nil {
		return &projectv1.CheckProjectAccessResponse{Allowed: true, Exists: true, Reason: "ok"}, nil
	}
	if errors.Is(err, usecase.ErrNotFound) {
		return &projectv1.CheckProjectAccessResponse{Allowed: false, Exists: false, Reason: err.Error()}, nil
	}
	if errors.Is(err, usecase.ErrUnauthorized) {
		return &projectv1.CheckProjectAccessResponse{Allowed: false, Exists: true, Reason: err.Error()}, nil
	}
	if errors.Is(err, usecase.ErrValidation) {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}
	return nil, status.Error(codes.Internal, err.Error())
}
