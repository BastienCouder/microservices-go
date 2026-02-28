package usecase

import (
	"context"

	"github.com/bastiencouder/microservices-go/services/auth-service/internal/domain"
)

type KratosClient interface {
	WhoAmI(ctx context.Context, cookieHeader, sessionToken string) (*domain.Session, int, error)
}

type Service struct {
	kratosClient KratosClient
}

func NewService(kratosClient KratosClient) *Service {
	return &Service{kratosClient: kratosClient}
}

func (s *Service) WhoAmI(ctx context.Context, cookieHeader, sessionToken string) (*domain.Session, int, error) {
	return s.kratosClient.WhoAmI(ctx, cookieHeader, sessionToken)
}
