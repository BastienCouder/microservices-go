package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"
)

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
) (UpdateProjectImpactIntegrationsResult, error) {
	s.mu.Lock()

	if err := s.reloadLocked(ctx); err != nil {
		s.mu.Unlock()
		return UpdateProjectImpactIntegrationsResult{}, err
	}
	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		s.mu.Unlock()
		return UpdateProjectImpactIntegrationsResult{}, err
	}

	current := normalizeProjectImpactIntegrations(projectID, s.impactIntegrations[projectID])
	updated, err := applyProjectImpactIntegrationUpdate(current, input, s.now().UTC())
	if err != nil {
		s.mu.Unlock()
		return UpdateProjectImpactIntegrationsResult{}, err
	}

	shouldSetupLLM := updated.GA4.PropertyID != "" &&
		updated.GA4.ServiceAccountJSON != "" &&
		updated.GA4.OAuthRefreshToken == "" &&
		input.GA4 != nil &&
		!input.GA4.Disconnect
	llmSetupProvider := s.ga4LLMSetupProvider
	serviceAccountJSON := updated.GA4.ServiceAccountJSON
	propertyID := updated.GA4.PropertyID
	s.mu.Unlock()

	llmSetup := GA4LLMSetupResult{}
	if shouldSetupLLM {
		if llmSetupProvider == nil {
			return UpdateProjectImpactIntegrationsResult{}, fmt.Errorf("%w: ga4 llm setup is not configured", ErrDependencyUnavailable)
		}
		llmSetup, err = llmSetupProvider.SetupLLMTrackingWithServiceAccount(ctx, serviceAccountJSON, propertyID)
		if err != nil {
			return UpdateProjectImpactIntegrationsResult{}, fmt.Errorf("%w: setup ga4 llm tracking: %v", ErrDependencyUnavailable, err)
		}
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.reloadLocked(ctx); err != nil {
		return UpdateProjectImpactIntegrationsResult{}, err
	}
	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return UpdateProjectImpactIntegrationsResult{}, err
	}
	current = normalizeProjectImpactIntegrations(projectID, s.impactIntegrations[projectID])
	updated, err = applyProjectImpactIntegrationUpdate(current, input, s.now().UTC())
	if err != nil {
		return UpdateProjectImpactIntegrationsResult{}, err
	}
	if updated.GA4.PropertyID == "" && updated.GA4.ServiceAccountJSON == "" && updated.GA4.OAuthRefreshToken == "" {
		delete(s.impactIntegrations, projectID)
	} else {
		value := updated
		s.impactIntegrations[projectID] = &value
	}

	if err := s.persistLocked(ctx); err != nil {
		return UpdateProjectImpactIntegrationsResult{}, err
	}
	return UpdateProjectImpactIntegrationsResult{
		Integration: buildProjectImpactIntegrationsView(updated, ""),
		LLMSetup:    llmSetup,
	}, nil
}

func (s *Service) GetProjectImpactContext(ctx context.Context, projectID string, organizationID int64) (ProjectImpactContext, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return ProjectImpactContext{}, err
	}

	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return ProjectImpactContext{}, fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if organizationID <= 0 {
		return ProjectImpactContext{}, fmt.Errorf("%w: organizationId is required", ErrValidation)
	}
	project, err := s.getProjectForOrganizationLocked(projectID, organizationID)
	if err != nil {
		return ProjectImpactContext{}, err
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
) (ProjectImpactIntegrations, error) {
	updated := current
	currentTime := now

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
				return ProjectImpactIntegrations{}, fmt.Errorf("%w: ga4 requires propertyId and serviceAccountJSON", ErrValidation)
			} else if !hasServiceAccount && !hasOAuthToken {
				return ProjectImpactIntegrations{}, fmt.Errorf("%w: ga4 requires propertyId and serviceAccountJSON", ErrValidation)
			} else {
				if updated.GA4.ConnectedAt.IsZero() {
					updated.GA4.ConnectedAt = currentTime
				}
				updated.GA4.UpdatedAt = currentTime
			}
		}
	}

	return updated, nil
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
	return out
}

func buildProjectImpactIntegrationsView(input ProjectImpactIntegrations, _ string) ProjectImpactIntegrationsView {
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
	}
}
