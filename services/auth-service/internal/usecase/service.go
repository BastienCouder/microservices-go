package usecase

import (
	"context"

	"github.com/bastiencouder/microservices-go/services/auth-service/internal/domain"
)

type KratosClient interface {
	WhoAmI(ctx context.Context, cookieHeader, sessionToken string) (*domain.Session, int, error)
	InitFlow(ctx context.Context, mode, returnTo, cookieHeader string) (*domain.BrowserFlow, []string, int, error)
	SubmitFlow(ctx context.Context, mode, flowID string, payload any, cookieHeader string) (domain.RawJSON, []string, int, error)
	InitLogout(ctx context.Context, cookieHeader string) (*domain.LogoutInitResponse, []string, int, error)
	CompleteLogout(ctx context.Context, logoutURL, cookieHeader string) ([]string, int, error)
}

type UserProfileProvisioner interface {
	EnsureProfile(ctx context.Context, identity domain.Identity, consentAccepted bool) error
}

type Service struct {
	kratosClient     KratosClient
	profileProvision UserProfileProvisioner
}

func NewService(kratosClient KratosClient, profileProvision UserProfileProvisioner) *Service {
	return &Service{kratosClient: kratosClient, profileProvision: profileProvision}
}

func (s *Service) WhoAmI(ctx context.Context, cookieHeader, sessionToken string) (*domain.Session, int, error) {
	return s.kratosClient.WhoAmI(ctx, cookieHeader, sessionToken)
}

func (s *Service) InitFlow(ctx context.Context, mode, returnTo, cookieHeader string) (*domain.BrowserFlow, []string, int, error) {
	return s.kratosClient.InitFlow(ctx, mode, returnTo, cookieHeader)
}

func (s *Service) EnsureUserProfile(ctx context.Context, session *domain.Session, consentAccepted bool) error {
	if s.profileProvision == nil || session == nil {
		return nil
	}
	return s.profileProvision.EnsureProfile(ctx, session.Identity, consentAccepted)
}

func (s *Service) SubmitFlow(ctx context.Context, mode, flowID string, payload any, cookieHeader string) (domain.RawJSON, []string, int, error) {
	return s.kratosClient.SubmitFlow(ctx, mode, flowID, payload, cookieHeader)
}

func (s *Service) InitLogout(ctx context.Context, cookieHeader string) (*domain.LogoutInitResponse, []string, int, error) {
	return s.kratosClient.InitLogout(ctx, cookieHeader)
}

func (s *Service) CompleteLogout(ctx context.Context, logoutURL, cookieHeader string) ([]string, int, error) {
	return s.kratosClient.CompleteLogout(ctx, logoutURL, cookieHeader)
}
