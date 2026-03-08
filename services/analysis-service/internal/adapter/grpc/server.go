package grpc

import (
	"context"
	"errors"

	analysisv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/analysis/v1"
	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/security"
	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/usecase"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type Server struct {
	svc *usecase.Service
	analysisv1.UnimplementedAnalysisServiceServer
}

func NewServer(svc *usecase.Service) *Server {
	return &Server{svc: svc}
}

func (s *Server) StartAnalysis(ctx context.Context, req *analysisv1.StartAnalysisRequest) (*analysisv1.StartAnalysisResponse, error) {
	if req.GetProjectId() == "" {
		return nil, status.Error(codes.InvalidArgument, "project_id is required")
	}
	claims, ok := security.ClaimsFromContext(ctx)
	if !ok || claims.Organization <= 0 || claims.UserID <= 0 {
		return nil, status.Error(codes.Unauthenticated, "missing organization or user claims")
	}

	promptTexts := make([]usecase.PromptText, 0, len(req.GetPromptTexts()))
	for _, prompt := range req.GetPromptTexts() {
		promptTexts = append(promptTexts, usecase.PromptText{
			ID:   prompt.GetId(),
			Text: prompt.GetText(),
		})
	}

	result, err := s.svc.StartAnalysis(ctx, usecase.StartAnalysisInput{
		RequestID:      req.GetRequestId(),
		OrganizationID: claims.Organization,
		CreatedBy:      claims.UserID,
		ProjectID:      req.GetProjectId(),
		PromptTexts:    promptTexts,
		ModelIDs:       req.GetModelIds(),
		RunType:        req.GetRunType(),
	})
	if err != nil {
		return nil, toStatus(err)
	}

	resp := &analysisv1.StartAnalysisResponse{
		AnalysisRun: &analysisv1.AnalysisRun{
			Id: result.AnalysisRun.ID,
		},
		PromptRuns: make([]*analysisv1.PromptRun, 0, len(result.PromptRuns)),
	}
	for _, promptRun := range result.PromptRuns {
		resp.PromptRuns = append(resp.PromptRuns, &analysisv1.PromptRun{
			Id:         promptRun.ID,
			PromptId:   promptRun.PromptID,
			PromptText: promptRun.PromptText,
		})
	}
	return resp, nil
}

func (s *Server) RecordResponse(ctx context.Context, req *analysisv1.RecordResponseRequest) (*analysisv1.RecordResponseResponse, error) {
	err := s.svc.RecordResponse(ctx, usecase.ResponseInput{
		RunID:          req.GetRunId(),
		PromptRunID:    req.GetPromptRunId(),
		ModelID:        req.GetModelId(),
		RawResponse:    req.GetRawResponse(),
		BrandMentioned: req.GetBrandMentioned(),
		BrandPosition:  req.GetBrandPosition(),
		CitationFound:  req.GetCitationFound(),
		CitedURLs:      req.GetCitedUrls(),
		Sentiment:      req.GetSentiment(),
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &analysisv1.RecordResponseResponse{Recorded: true}, nil
}

func toStatus(err error) error {
	switch {
	case errors.Is(err, usecase.ErrValidation):
		return status.Error(codes.InvalidArgument, err.Error())
	case errors.Is(err, usecase.ErrUnauthorized):
		return status.Error(codes.PermissionDenied, err.Error())
	case errors.Is(err, usecase.ErrNotFound):
		return status.Error(codes.NotFound, err.Error())
	default:
		return status.Error(codes.Internal, err.Error())
	}
}
