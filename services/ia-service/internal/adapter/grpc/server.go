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
		PromptID:       req.GetPromptId(),
		PromptText:     req.GetPromptText(),
		ModelID:        req.GetModelId(),
		ProviderID:     req.GetProviderId(),
		ProviderAPIKey: req.GetProviderApiKey(),
		PromptMode:     usecase.PromptMode(req.GetPromptMode()),
		BrandName:      req.GetBrandName(),
		Competitors:    req.GetCompetitors(),
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

func (s *Server) ListModels(ctx context.Context, req *iav1.ListModelsRequest) (*iav1.ListModelsResponse, error) {
	models, err := s.svc.ListModels(ctx, req.GetActiveOnly())
	if err != nil {
		return nil, toStatus(err)
	}
	resp := &iav1.ListModelsResponse{
		Models: make([]*iav1.AIModel, 0, len(models)),
	}
	for _, model := range models {
		resp.Models = append(resp.Models, &iav1.AIModel{
			Id:                 model.ID,
			DisplayName:        model.Label,
			Provider:           model.Provider,
			GroupName:          model.Group,
			IconKey:            model.IconKey,
			ProviderModelId:    model.ModelID,
			IsActive:           model.IsActive,
			SupportsLiveSearch: model.SupportsLiveSearch,
			Source:             model.Source,
			CreditCost:         int32(model.CreditCost),
		})
	}
	return resp, nil
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
