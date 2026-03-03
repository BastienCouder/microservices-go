package grpc

import (
	"context"
	"errors"

	iav1 "github.com/bastiencouder/microservices-go/contracts/gen/go/ia/v1"
	"github.com/bastiencouder/microservices-go/services/ia-service/internal/usecase"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type Server struct {
	svc *usecase.Service
	iav1.UnimplementedIAServiceServer
}

func NewServer(svc *usecase.Service) *Server {
	return &Server{svc: svc}
}

func (s *Server) ExecutePrompt(ctx context.Context, req *iav1.ExecutePromptRequest) (*iav1.ExecutePromptResponse, error) {
	result, err := s.svc.ExecutePrompt(ctx, usecase.ExecutePromptInput{
		PromptID:    req.GetPromptId(),
		PromptText:  req.GetPromptText(),
		ModelID:     req.GetModelId(),
		BrandName:   req.GetBrandName(),
		Competitors: req.GetCompetitors(),
	})
	if err != nil {
		return nil, toStatus(err)
	}

	return &iav1.ExecutePromptResponse{
		RawResponse: result.RawResponse,
		Analysis: &iav1.PromptExecutionAnalysis{
			BrandMentioned: result.Analysis.BrandMentioned,
			BrandPosition:  result.Analysis.BrandPosition,
			CitationFound:  result.Analysis.CitationFound,
			CitedUrls:      result.Analysis.CitedURLs,
			Sentiment:      result.Analysis.Sentiment,
		},
		TokensUsed: int32(result.RawMetadata.TokensUsed),
		LatencyMs:  int32(result.RawMetadata.LatencyMs),
	}, nil
}

func toStatus(err error) error {
	switch {
	case errors.Is(err, usecase.ErrValidation):
		return status.Error(codes.InvalidArgument, err.Error())
	case errors.Is(err, usecase.ErrUnknownModel):
		return status.Error(codes.InvalidArgument, err.Error())
	default:
		return status.Error(codes.Internal, err.Error())
	}
}
