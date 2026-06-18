package grpc

import (
	"context"
	"errors"
	"strconv"
	"strings"

	analysisv1 "github.com/bastiencouder/microservices-go/contracts/gen/go/analysis/v1"
	"github.com/bastiencouder/microservices-go/contracts/pkg/internalauth"
	"github.com/bastiencouder/microservices-go/services/analysis-service/internal/usecase"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
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
	claims, ok := internalauth.ClaimsFromContext(ctx)
	if !ok || claims.Organization <= 0 || claims.UserID <= 0 {
		return nil, status.Error(codes.Unauthenticated, "missing organization or user claims")
	}

	promptTexts := make([]usecase.PromptText, 0, len(req.GetPromptTexts()))
	for _, prompt := range req.GetPromptTexts() {
		promptTexts = append(promptTexts, usecase.PromptText{
			ID:   prompt.GetId(),
			Text: prompt.GetText(),
			Kind: prompt.GetKind(),
		})
	}

	result, err := s.svc.StartAnalysis(ctx, usecase.StartAnalysisInput{
		RequestID:          req.GetRequestId(),
		OrganizationID:     claims.Organization,
		CreatedBy:          claims.UserID,
		ProjectID:          req.GetProjectId(),
		PromptTexts:        promptTexts,
		ModelIDs:           req.GetModelIds(),
		ModelCreditCostSum: modelCreditCostSumFromMetadata(ctx),
		RequestedCredits:   requestedCreditsFromMetadata(ctx),
		RunType:            req.GetRunType(),
		Force:              forceAnalysisFromMetadata(ctx),
	})
	if err != nil {
		return nil, toStatus(err)
	}

	resp := &analysisv1.StartAnalysisResponse{
		AnalysisRun: &analysisv1.AnalysisRun{
			Id:     result.AnalysisRun.ID,
			Status: result.AnalysisRun.Status,
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

func (s *Server) GetAnalysisRun(ctx context.Context, req *analysisv1.GetAnalysisRunRequest) (*analysisv1.GetAnalysisRunResponse, error) {
	if strings.TrimSpace(req.GetRunId()) == "" {
		return nil, status.Error(codes.InvalidArgument, "run_id is required")
	}
	claims, ok := internalauth.ClaimsFromContext(ctx)
	if !ok || claims.Organization <= 0 {
		return nil, status.Error(codes.Unauthenticated, "missing organization claims")
	}

	details, err := s.svc.GetAnalysisRun(ctx, req.GetRunId(), claims.Organization)
	if err != nil {
		return nil, toStatus(err)
	}
	return &analysisv1.GetAnalysisRunResponse{
		AnalysisRun: &analysisv1.AnalysisRun{
			Id:     details.AnalysisRun.ID,
			Status: details.AnalysisRun.Status,
		},
	}, nil
}

func forceAnalysisFromMetadata(ctx context.Context) bool {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return false
	}
	for _, value := range md.Get("x-force-analysis") {
		parsed, err := strconv.ParseBool(strings.TrimSpace(value))
		if err == nil {
			return parsed
		}
	}
	return false
}

func requestedCreditsFromMetadata(ctx context.Context) int {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return 0
	}
	for _, value := range md.Get("x-requested-credits") {
		parsed, err := strconv.Atoi(strings.TrimSpace(value))
		if err == nil && parsed > 0 {
			return parsed
		}
	}
	return 0
}

func modelCreditCostSumFromMetadata(ctx context.Context) int {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return 0
	}
	for _, value := range md.Get("x-model-credit-cost-sum") {
		parsed, err := strconv.Atoi(strings.TrimSpace(value))
		if err == nil && parsed > 0 {
			return parsed
		}
	}
	return 0
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
	case errors.Is(err, usecase.ErrQuotaExceeded):
		return status.Error(codes.ResourceExhausted, err.Error())
	case errors.Is(err, usecase.ErrUnauthorized):
		return status.Error(codes.PermissionDenied, err.Error())
	case errors.Is(err, usecase.ErrNotFound):
		return status.Error(codes.NotFound, err.Error())
	default:
		return status.Error(codes.Internal, err.Error())
	}
}
