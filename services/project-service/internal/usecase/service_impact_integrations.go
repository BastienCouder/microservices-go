package usecase

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/url"
	"strings"
	"time"
)

const stripeWebhookPathPrefix = "/attribution/stripe/webhook/"
const ingestionPathPrefix = "/attribution/ingest/"

func (s *Service) GetProjectImpactIntegrations(
	ctx context.Context,
	projectID string,
	organizationID int64,
) (ProjectImpactIntegrationsView, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return ProjectImpactIntegrationsView{}, err
	}
	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return ProjectImpactIntegrationsView{}, err
	}

	integrations := normalizeProjectImpactIntegrations(projectID, s.impactIntegrations[projectID])
	return buildProjectImpactIntegrationsView(integrations, ""), nil
}

func (s *Service) UpdateProjectImpactIntegrations(
	ctx context.Context,
	projectID string,
	organizationID int64,
	input UpdateProjectImpactIntegrationsInput,
) (ProjectImpactIntegrationsView, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return ProjectImpactIntegrationsView{}, err
	}
	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return ProjectImpactIntegrationsView{}, err
	}

	current := normalizeProjectImpactIntegrations(projectID, s.impactIntegrations[projectID])
	updated, generatedIngestionToken, err := applyProjectImpactIntegrationUpdate(current, input, s.now().UTC())
	if err != nil {
		return ProjectImpactIntegrationsView{}, err
	}

	if updated.GA4.PropertyID == "" && updated.GA4.ServiceAccountJSON == "" && updated.GA4.OAuthRefreshToken == "" &&
		updated.Stripe.WebhookSecret == "" &&
		updated.Ingestion.SigningToken == "" {
		delete(s.impactIntegrations, projectID)
	} else {
		value := updated
		s.impactIntegrations[projectID] = &value
	}

	if err := s.persistLocked(ctx); err != nil {
		return ProjectImpactIntegrationsView{}, err
	}
	return buildProjectImpactIntegrationsView(updated, generatedIngestionToken), nil
}

func (s *Service) GetProjectImpactContext(ctx context.Context, projectID string) (ProjectImpactContext, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return ProjectImpactContext{}, err
	}

	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return ProjectImpactContext{}, fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	project := s.projects[projectID]
	if project == nil {
		return ProjectImpactContext{}, fmt.Errorf("%w: project", ErrNotFound)
	}

	return ProjectImpactContext{
		ProjectID:      project.ID,
		OrganizationID: project.OrganizationID,
		Domain:         project.Domain,
		WebsiteURL:     project.WebsiteURL,
		Integrations:   normalizeProjectImpactIntegrations(projectID, s.impactIntegrations[projectID]),
	}, nil
}

func applyProjectImpactIntegrationUpdate(
	current ProjectImpactIntegrations,
	input UpdateProjectImpactIntegrationsInput,
	now time.Time,
) (ProjectImpactIntegrations, string, error) {
	updated := current
	currentTime := now
	generatedIngestionToken := ""

	if input.GA4 != nil {
		if input.GA4.Disconnect {
			updated.GA4 = ProjectGA4Integration{}
		} else {
			if input.GA4.PropertyID != nil {
				updated.GA4.PropertyID = strings.TrimSpace(*input.GA4.PropertyID)
			}
			if input.GA4.ServiceAccountJSON != nil {
				updated.GA4.ServiceAccountJSON = strings.TrimSpace(*input.GA4.ServiceAccountJSON)
				if updated.GA4.ServiceAccountJSON != "" {
					updated.GA4.OAuthRefreshToken = ""
				}
			}
			hasProperty := updated.GA4.PropertyID != ""
			hasServiceAccount := updated.GA4.ServiceAccountJSON != ""
			hasOAuthToken := updated.GA4.OAuthRefreshToken != ""
			if !hasProperty && !hasServiceAccount && !hasOAuthToken {
				updated.GA4 = ProjectGA4Integration{}
			} else if hasServiceAccount && !hasProperty {
				return ProjectImpactIntegrations{}, "", fmt.Errorf("%w: ga4 requires propertyId and serviceAccountJSON", ErrValidation)
			} else if !hasServiceAccount && !hasOAuthToken {
				return ProjectImpactIntegrations{}, "", fmt.Errorf("%w: ga4 requires propertyId and serviceAccountJSON", ErrValidation)
			} else {
				if updated.GA4.ConnectedAt.IsZero() {
					updated.GA4.ConnectedAt = currentTime
				}
				updated.GA4.UpdatedAt = currentTime
			}
		}
	}

	if input.Stripe != nil {
		if input.Stripe.Disconnect {
			updated.Stripe = ProjectStripeIntegration{}
		} else {
			if input.Stripe.WebhookSecret != nil {
				updated.Stripe.WebhookSecret = strings.TrimSpace(*input.Stripe.WebhookSecret)
			}
			if updated.Stripe.WebhookSecret == "" {
				updated.Stripe = ProjectStripeIntegration{}
			} else {
				if updated.Stripe.ConnectedAt.IsZero() {
					updated.Stripe.ConnectedAt = currentTime
				}
				updated.Stripe.UpdatedAt = currentTime
			}
		}
	}

	if input.Ingestion != nil {
		if input.Ingestion.Disconnect {
			updated.Ingestion = ProjectIngestionIntegration{}
		} else if input.Ingestion.Rotate || strings.TrimSpace(updated.Ingestion.SigningToken) == "" {
			token, err := generateImpactSigningToken()
			if err != nil {
				return ProjectImpactIntegrations{}, "", fmt.Errorf("generate ingestion signing token: %w", err)
			}
			updated.Ingestion.SigningToken = token
			generatedIngestionToken = token
			if updated.Ingestion.ConnectedAt.IsZero() {
				updated.Ingestion.ConnectedAt = currentTime
			}
			updated.Ingestion.UpdatedAt = currentTime
		}
	}

	return updated, generatedIngestionToken, nil
}

func normalizeProjectImpactIntegrations(
	projectID string,
	input *ProjectImpactIntegrations,
) ProjectImpactIntegrations {
	if input == nil {
		return ProjectImpactIntegrations{ProjectID: strings.TrimSpace(projectID)}
	}
	out := *input
	out.ProjectID = strings.TrimSpace(projectID)
	out.GA4.PropertyID = strings.TrimSpace(out.GA4.PropertyID)
	out.GA4.ServiceAccountJSON = strings.TrimSpace(out.GA4.ServiceAccountJSON)
	out.GA4.OAuthRefreshToken = strings.TrimSpace(out.GA4.OAuthRefreshToken)
	out.Stripe.WebhookSecret = strings.TrimSpace(out.Stripe.WebhookSecret)
	out.Ingestion.SigningToken = strings.TrimSpace(out.Ingestion.SigningToken)
	return out
}

func buildProjectImpactIntegrationsView(
	input ProjectImpactIntegrations,
	generatedIngestionToken string,
) ProjectImpactIntegrationsView {
	projectID := strings.TrimSpace(input.ProjectID)
	authMode := ""
	if input.GA4.OAuthRefreshToken != "" {
		authMode = "oauth"
	} else if input.GA4.ServiceAccountJSON != "" {
		authMode = "service_account"
	}
	isGA4Connected := input.GA4.PropertyID != "" && (input.GA4.ServiceAccountJSON != "" || input.GA4.OAuthRefreshToken != "")
	return ProjectImpactIntegrationsView{
		ProjectID: projectID,
		GA4: ProjectGA4IntegrationView{
			PropertyID:        input.GA4.PropertyID,
			AuthMode:          authMode,
			HasServiceAccount: input.GA4.ServiceAccountJSON != "",
			HasOAuthToken:     input.GA4.OAuthRefreshToken != "",
			IsConnected:       isGA4Connected,
			ConnectedAt:       input.GA4.ConnectedAt,
			UpdatedAt:         input.GA4.UpdatedAt,
		},
		Stripe: ProjectStripeIntegrationView{
			HasWebhookSecret: input.Stripe.WebhookSecret != "",
			IsConnected:      input.Stripe.WebhookSecret != "",
			WebhookPath:      stripeWebhookPathPrefix + url.PathEscape(projectID),
			ConnectedAt:      input.Stripe.ConnectedAt,
			UpdatedAt:        input.Stripe.UpdatedAt,
		},
		Ingestion: ProjectIngestionIntegrationView{
			HasSigningToken: input.Ingestion.SigningToken != "",
			IsConnected:     input.Ingestion.SigningToken != "",
			IngestPath:      ingestionPathPrefix + url.PathEscape(projectID),
			ConnectedAt:     input.Ingestion.ConnectedAt,
			UpdatedAt:       input.Ingestion.UpdatedAt,
			GeneratedToken:  strings.TrimSpace(generatedIngestionToken),
		},
	}
}

func generateImpactSigningToken() (string, error) {
	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return "iat_" + hex.EncodeToString(raw), nil
}
