package usecase

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

const ga4OAuthStateTTL = 30 * time.Minute

type ga4OAuthStatePayload struct {
	ProjectID      string `json:"projectId"`
	OrganizationID int64  `json:"organizationId"`
	IssuedAt       int64  `json:"iat"`
}

func (s *Service) ConfigureGA4OAuth(provider GA4OAuthProvider, stateSecret string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ga4OAuthProvider = provider
	s.ga4OAuthStateKey = strings.TrimSpace(stateSecret)
}

func (s *Service) StartProjectGA4OAuth(
	ctx context.Context,
	projectID string,
	organizationID int64,
	input StartProjectGA4OAuthInput,
) (StartProjectGA4OAuthResult, error) {
	redirectURI := strings.TrimSpace(input.RedirectURI)
	if redirectURI == "" {
		return StartProjectGA4OAuthResult{}, fmt.Errorf("%w: redirectUri is required", ErrValidation)
	}
	provider, stateSecret, err := s.ga4OAuthConfig()
	if err != nil {
		return StartProjectGA4OAuthResult{}, err
	}

	s.mu.Lock()
	if err := s.reloadLocked(ctx); err != nil {
		s.mu.Unlock()
		return StartProjectGA4OAuthResult{}, err
	}
	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		s.mu.Unlock()
		return StartProjectGA4OAuthResult{}, err
	}
	state, err := signGA4OAuthState(ga4OAuthStatePayload{
		ProjectID:      strings.TrimSpace(projectID),
		OrganizationID: organizationID,
		IssuedAt:       s.now().UTC().Unix(),
	}, stateSecret)
	s.mu.Unlock()
	if err != nil {
		return StartProjectGA4OAuthResult{}, err
	}

	authorizationURL, err := provider.AuthorizationURL(state, redirectURI)
	if err != nil {
		return StartProjectGA4OAuthResult{}, ga4OAuthDependencyError("build ga4 oauth authorization url", err)
	}
	return StartProjectGA4OAuthResult{AuthorizationURL: authorizationURL, State: state}, nil
}

func (s *Service) CompleteProjectGA4OAuth(
	ctx context.Context,
	projectID string,
	organizationID int64,
	input CompleteProjectGA4OAuthInput,
) (CompleteProjectGA4OAuthResult, error) {
	code := strings.TrimSpace(input.Code)
	redirectURI := strings.TrimSpace(input.RedirectURI)
	propertyID := strings.TrimSpace(input.PropertyID)
	if code == "" || redirectURI == "" {
		return CompleteProjectGA4OAuthResult{}, fmt.Errorf("%w: code and redirectUri are required", ErrValidation)
	}
	provider, stateSecret, err := s.ga4OAuthConfig()
	if err != nil {
		return CompleteProjectGA4OAuthResult{}, err
	}
	if err := validateGA4OAuthState(input.State, projectID, organizationID, stateSecret, s.now().UTC()); err != nil {
		return CompleteProjectGA4OAuthResult{}, err
	}

	token, err := provider.ExchangeCode(ctx, code, redirectURI)
	if err != nil {
		return CompleteProjectGA4OAuthResult{}, ga4OAuthDependencyError("exchange ga4 oauth code", err)
	}
	token.RefreshToken = strings.TrimSpace(token.RefreshToken)
	if token.RefreshToken == "" {
		return CompleteProjectGA4OAuthResult{}, fmt.Errorf("%w: google did not return a refresh token", ErrValidation)
	}

	properties := []GA4OAuthProperty(nil)
	if propertyID == "" {
		var err error
		properties, err = provider.ListProperties(ctx, token.RefreshToken)
		if err != nil {
			return CompleteProjectGA4OAuthResult{}, ga4OAuthDependencyError("list ga4 properties", err)
		}
	}
	llmSetup := GA4LLMSetupResult{}
	if propertyID != "" {
		var err error
		llmSetup, err = provider.SetupLLMTracking(ctx, token.RefreshToken, propertyID)
		if err != nil {
			return CompleteProjectGA4OAuthResult{}, ga4OAuthDependencyError("setup ga4 llm tracking", err)
		}
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.reloadLocked(ctx); err != nil {
		return CompleteProjectGA4OAuthResult{}, err
	}
	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return CompleteProjectGA4OAuthResult{}, err
	}

	current := normalizeProjectImpactIntegrations(projectID, s.impactIntegrations[projectID])
	now := s.now().UTC()
	current.GA4.OAuthRefreshToken = token.RefreshToken
	current.GA4.ServiceAccountJSON = ""
	current.GA4.PropertyID = propertyID
	if current.GA4.ConnectedAt.IsZero() {
		current.GA4.ConnectedAt = now
	}
	current.GA4.UpdatedAt = now
	s.impactIntegrations[projectID] = &current

	if err := s.persistLocked(ctx); err != nil {
		return CompleteProjectGA4OAuthResult{}, err
	}
	return CompleteProjectGA4OAuthResult{
		Integration: buildProjectImpactIntegrationsView(current, ""),
		Properties:  normalizeGA4OAuthProperties(properties),
		LLMSetup:    llmSetup,
	}, nil
}

func (s *Service) ListProjectGA4OAuthProperties(
	ctx context.Context,
	projectID string,
	organizationID int64,
) ([]GA4OAuthProperty, error) {
	provider, _, err := s.ga4OAuthConfig()
	if err != nil {
		return nil, err
	}

	s.mu.Lock()
	if err := s.reloadLocked(ctx); err != nil {
		s.mu.Unlock()
		return nil, err
	}
	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		s.mu.Unlock()
		return nil, err
	}
	current := normalizeProjectImpactIntegrations(projectID, s.impactIntegrations[projectID])
	refreshToken := current.GA4.OAuthRefreshToken
	s.mu.Unlock()

	if refreshToken == "" {
		return nil, fmt.Errorf("%w: ga4 oauth is not connected for project", ErrValidation)
	}
	properties, err := provider.ListProperties(ctx, refreshToken)
	if err != nil {
		return nil, ga4OAuthDependencyError("list ga4 properties", err)
	}
	return normalizeGA4OAuthProperties(properties), nil
}

func ga4OAuthDependencyError(operation string, err error) error {
	return fmt.Errorf("%w: %s: %v", ErrDependencyUnavailable, operation, err)
}

func (s *Service) SelectProjectGA4OAuthProperty(
	ctx context.Context,
	projectID string,
	organizationID int64,
	input SelectProjectGA4OAuthPropertyInput,
) (SelectProjectGA4OAuthPropertyResult, error) {
	propertyID := strings.TrimSpace(input.PropertyID)
	if propertyID == "" {
		return SelectProjectGA4OAuthPropertyResult{}, fmt.Errorf("%w: propertyId is required", ErrValidation)
	}
	provider, _, err := s.ga4OAuthConfig()
	if err != nil {
		return SelectProjectGA4OAuthPropertyResult{}, err
	}

	s.mu.Lock()
	if err := s.reloadLocked(ctx); err != nil {
		s.mu.Unlock()
		return SelectProjectGA4OAuthPropertyResult{}, err
	}
	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		s.mu.Unlock()
		return SelectProjectGA4OAuthPropertyResult{}, err
	}
	current := normalizeProjectImpactIntegrations(projectID, s.impactIntegrations[projectID])
	if current.GA4.OAuthRefreshToken == "" {
		s.mu.Unlock()
		return SelectProjectGA4OAuthPropertyResult{}, fmt.Errorf("%w: ga4 oauth is not connected for project", ErrValidation)
	}
	refreshToken := current.GA4.OAuthRefreshToken
	s.mu.Unlock()

	llmSetup, err := provider.SetupLLMTracking(ctx, refreshToken, propertyID)
	if err != nil {
		return SelectProjectGA4OAuthPropertyResult{}, ga4OAuthDependencyError("setup ga4 llm tracking", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.reloadLocked(ctx); err != nil {
		return SelectProjectGA4OAuthPropertyResult{}, err
	}
	current = normalizeProjectImpactIntegrations(projectID, s.impactIntegrations[projectID])
	if current.GA4.OAuthRefreshToken == "" {
		return SelectProjectGA4OAuthPropertyResult{}, fmt.Errorf("%w: ga4 oauth is not connected for project", ErrValidation)
	}
	now := s.now().UTC()
	current.GA4.PropertyID = propertyID
	current.GA4.ServiceAccountJSON = ""
	if current.GA4.ConnectedAt.IsZero() {
		current.GA4.ConnectedAt = now
	}
	current.GA4.UpdatedAt = now
	s.impactIntegrations[projectID] = &current
	if err := s.persistLocked(ctx); err != nil {
		return SelectProjectGA4OAuthPropertyResult{}, err
	}
	return SelectProjectGA4OAuthPropertyResult{
		Integration: buildProjectImpactIntegrationsView(current, ""),
		LLMSetup:    llmSetup,
	}, nil
}

func (s *Service) ga4OAuthConfig() (GA4OAuthProvider, string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.ga4OAuthProvider == nil || strings.TrimSpace(s.ga4OAuthStateKey) == "" {
		return nil, "", fmt.Errorf("%w: ga4 oauth is not configured", ErrValidation)
	}
	return s.ga4OAuthProvider, s.ga4OAuthStateKey, nil
}

func signGA4OAuthState(payload ga4OAuthStatePayload, secret string) (string, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal ga4 oauth state: %w", err)
	}
	encodedPayload := base64.RawURLEncoding.EncodeToString(raw)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(encodedPayload))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return encodedPayload + "." + signature, nil
}

func validateGA4OAuthState(rawState, projectID string, organizationID int64, secret string, now time.Time) error {
	rawState = strings.TrimSpace(rawState)
	parts := strings.Split(rawState, ".")
	if len(parts) != 2 {
		return fmt.Errorf("%w: invalid ga4 oauth state", ErrValidation)
	}
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(parts[0]))
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(parts[1])) {
		return fmt.Errorf("%w: invalid ga4 oauth state", ErrValidation)
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return fmt.Errorf("%w: invalid ga4 oauth state", ErrValidation)
	}
	var payload ga4OAuthStatePayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return fmt.Errorf("%w: invalid ga4 oauth state", ErrValidation)
	}
	if payload.ProjectID != strings.TrimSpace(projectID) || payload.OrganizationID != organizationID {
		return fmt.Errorf("%w: ga4 oauth state does not match project", ErrUnauthorized)
	}
	issuedAt := time.Unix(payload.IssuedAt, 0).UTC()
	if issuedAt.IsZero() || issuedAt.After(now.Add(time.Minute)) || now.Sub(issuedAt) > ga4OAuthStateTTL {
		return fmt.Errorf("%w: ga4 oauth state expired", ErrValidation)
	}
	return nil
}

func normalizeGA4OAuthProperties(input []GA4OAuthProperty) []GA4OAuthProperty {
	out := make([]GA4OAuthProperty, 0, len(input))
	seen := make(map[string]struct{}, len(input))
	for _, property := range input {
		property.PropertyID = strings.TrimSpace(property.PropertyID)
		property.DisplayName = strings.TrimSpace(property.DisplayName)
		property.AccountName = strings.TrimSpace(property.AccountName)
		if property.PropertyID == "" {
			continue
		}
		if property.DisplayName == "" {
			property.DisplayName = property.PropertyID
		}
		if _, ok := seen[property.PropertyID]; ok {
			continue
		}
		seen[property.PropertyID] = struct{}{}
		out = append(out, property)
	}
	return out
}
