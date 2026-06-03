package grpc

import (
	"context"
	"errors"

	projectv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/project/v1"
	"github.com/bastiencouder/microservices-go/contracts/pkg/internalauth"
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

	claims, ok := internalauth.ClaimsFromContext(ctx)
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

func (s *Server) ListProjectCompetitors(ctx context.Context, req *projectv1.ListProjectCompetitorsRequest) (*projectv1.ListProjectCompetitorsResponse, error) {
	if req.GetProjectId() == "" {
		return nil, status.Error(codes.InvalidArgument, "project_id is required")
	}

	claims, ok := internalauth.ClaimsFromContext(ctx)
	if !ok || claims.Organization <= 0 {
		return nil, status.Error(codes.Unauthenticated, "missing organization claim")
	}

	competitors, err := s.svc.ListActiveCompetitors(ctx, req.GetProjectId(), claims.Organization)
	if err != nil {
		if errors.Is(err, usecase.ErrNotFound) {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		if errors.Is(err, usecase.ErrUnauthorized) {
			return nil, status.Error(codes.PermissionDenied, err.Error())
		}
		if errors.Is(err, usecase.ErrValidation) {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &projectv1.ListProjectCompetitorsResponse{
		Competitors: append([]string(nil), competitors...),
	}, nil
}

func (s *Server) ListProjectEnabledModels(ctx context.Context, req *projectv1.ListProjectEnabledModelsRequest) (*projectv1.ListProjectEnabledModelsResponse, error) {
	if req.GetProjectId() == "" {
		return nil, status.Error(codes.InvalidArgument, "project_id is required")
	}

	claims, ok := internalauth.ClaimsFromContext(ctx)
	if !ok || claims.Organization <= 0 {
		return nil, status.Error(codes.Unauthenticated, "missing organization claim")
	}

	modelIDs, err := s.svc.ListEnabledProjectModelIDs(ctx, req.GetProjectId(), claims.Organization)
	if err != nil {
		if errors.Is(err, usecase.ErrNotFound) {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		if errors.Is(err, usecase.ErrUnauthorized) {
			return nil, status.Error(codes.PermissionDenied, err.Error())
		}
		if errors.Is(err, usecase.ErrValidation) {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &projectv1.ListProjectEnabledModelsResponse{
		ModelIds: append([]string(nil), modelIDs...),
	}, nil
}

func (s *Server) ListScheduledAnalysisJobs(ctx context.Context, _ *projectv1.ListScheduledAnalysisJobsRequest) (*projectv1.ListScheduledAnalysisJobsResponse, error) {
	jobs, err := s.svc.ListScheduledAnalysisJobs(ctx)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	response := &projectv1.ListScheduledAnalysisJobsResponse{
		Jobs: make([]*projectv1.ScheduledAnalysisJob, 0, len(jobs)),
	}
	for _, job := range jobs {
		providerCredentials := make(map[string]*projectv1.ScheduledModelProviderCredential, len(job.ProviderCredentials))
		for modelID, credential := range job.ProviderCredentials {
			providerCredentials[modelID] = &projectv1.ScheduledModelProviderCredential{
				ProviderId:      credential.ProviderID,
				ProviderModelId: credential.ProviderModelID,
				ProviderApiKey:  credential.ProviderAPIKey,
			}
		}
		response.Jobs = append(response.Jobs, &projectv1.ScheduledAnalysisJob{
			ProjectId:           job.ProjectID,
			ProjectName:         job.ProjectName,
			OrganizationId:      job.OrganizationID,
			CreatedBy:           job.CreatedBy,
			BrandName:           job.BrandName,
			Competitors:         append([]string(nil), job.Competitors...),
			PromptId:            job.PromptID,
			PromptText:          job.PromptText,
			ModelIds:            append([]string(nil), job.ModelIDs...),
			ProviderCredentials: providerCredentials,
			Schedule: &projectv1.PromptSchedule{
				Mode:       job.Schedule.Mode,
				Cron:       job.Schedule.Cron,
				Timezone:   job.Schedule.Timezone,
				ModelCrons: copyStringMap(job.Schedule.ModelCrons),
			},
		})
	}

	return response, nil
}

func copyStringMap(input map[string]string) map[string]string {
	if len(input) == 0 {
		return nil
	}
	cloned := make(map[string]string, len(input))
	for key, value := range input {
		cloned[key] = value
	}
	return cloned
}
