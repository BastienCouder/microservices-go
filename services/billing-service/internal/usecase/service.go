package usecase

import (
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"
)

type Service struct {
	repo              domain.Repository
	stripe            StripeProvider
	stripeCatalog     StripeCatalog
	attribution       AttributionClient
	projectResolver   ProjectResolver
	defaultSuccessURL string
	defaultCancelURL  string
	defaultPortalURL  string
	now               func() time.Time
}

func NewService(repo domain.Repository) *Service {
	return &Service{repo: repo, now: time.Now}
}

func (s *Service) EnableStripe(provider StripeProvider, catalog StripeCatalog, defaultSuccessURL, defaultCancelURL, defaultPortalURL string) {
	s.stripe = provider
	s.stripeCatalog = catalog
	s.defaultSuccessURL = strings.TrimSpace(defaultSuccessURL)
	s.defaultCancelURL = strings.TrimSpace(defaultCancelURL)
	s.defaultPortalURL = strings.TrimSpace(defaultPortalURL)
}

func (s *Service) EnableAttribution(attribution AttributionClient, projectResolver ProjectResolver) {
	s.attribution = attribution
	s.projectResolver = projectResolver
}

func (s *Service) stripeEnabled() bool {
	return s.stripe != nil
}
