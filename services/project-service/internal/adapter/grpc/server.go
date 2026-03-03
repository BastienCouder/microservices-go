package grpc

import (
	"context"
	"errors"
	"strconv"

	projectv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/project/v1"
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
	if req.GetProjectId() == "" || req.GetUserId() <= 0 {
		return nil, status.Error(codes.InvalidArgument, "project_id and user_id are required")
	}

	userID := strconv.FormatInt(req.GetUserId(), 10)
	_, err := s.svc.GetProject(ctx, req.GetProjectId(), userID)
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
