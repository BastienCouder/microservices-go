package usecase

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

type resolvedModelProviderCredential struct {
	ProviderID      string
	ProviderModelID string
	ProviderAPIKey  string
}

func (s *Service) ListLLMProviderCredentials(ctx context.Context, projectID string, organizationID int64) ([]LLMProviderCredentialStatus, error) {
	projectID = strings.TrimSpace(projectID)
	if organizationID <= 0 {
		return nil, fmt.Errorf("%w: organizationId must be positive", ErrValidation)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}
	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return nil, err
	}

	credentials := s.providerCredentials[projectID]
	if len(credentials) == 0 {
		return []LLMProviderCredentialStatus{}, nil
	}

	providers := make([]string, 0, len(credentials))
	for provider := range credentials {
		providers = append(providers, provider)
	}
	sort.Strings(providers)

	out := make([]LLMProviderCredentialStatus, 0, len(providers))
	for _, provider := range providers {
		record := credentials[provider]
		if record == nil {
			continue
		}
		out = append(out, LLMProviderCredentialStatus{
			ProjectID: projectID,
			Provider:  provider,
			HasAPIKey: hasProviderAPIKey(record),
			UpdatedAt: record.UpdatedAt,
		})
	}
	return out, nil
}

func (s *Service) SaveLLMProviderCredential(ctx context.Context, projectID string, organizationID int64, provider, apiKey string) (LLMProviderCredentialStatus, error) {
	projectID = strings.TrimSpace(projectID)
	if organizationID <= 0 {
		return LLMProviderCredentialStatus{}, fmt.Errorf("%w: organizationId must be positive", ErrValidation)
	}

	provider = normalizeOpenRouterProvider(provider)
	if provider == "" {
		return LLMProviderCredentialStatus{}, fmt.Errorf("%w: provider is required", ErrValidation)
	}
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return LLMProviderCredentialStatus{}, fmt.Errorf("%w: apiKey is required", ErrValidation)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return LLMProviderCredentialStatus{}, err
	}
	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return LLMProviderCredentialStatus{}, err
	}

	backup := s.snapshotLocked()
	if s.providerCredentials[projectID] == nil {
		s.providerCredentials[projectID] = make(map[string]*LLMProviderCredentialRecord)
	}

	now := s.now().UTC()
	s.providerCredentials[projectID][provider] = &LLMProviderCredentialRecord{
		APIKey:    apiKey,
		HasAPIKey: true,
		UpdatedAt: now,
	}

	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return LLMProviderCredentialStatus{}, err
	}

	return LLMProviderCredentialStatus{
		ProjectID: projectID,
		Provider:  provider,
		HasAPIKey: true,
		UpdatedAt: now,
	}, nil
}

func (s *Service) DeleteLLMProviderCredential(ctx context.Context, projectID string, organizationID int64, provider string) (LLMProviderCredentialStatus, error) {
	projectID = strings.TrimSpace(projectID)
	if organizationID <= 0 {
		return LLMProviderCredentialStatus{}, fmt.Errorf("%w: organizationId must be positive", ErrValidation)
	}

	provider = normalizeOpenRouterProvider(provider)
	if provider == "" {
		return LLMProviderCredentialStatus{}, fmt.Errorf("%w: provider is required", ErrValidation)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return LLMProviderCredentialStatus{}, err
	}
	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return LLMProviderCredentialStatus{}, err
	}

	backup := s.snapshotLocked()
	if credentials := s.providerCredentials[projectID]; credentials != nil {
		delete(credentials, provider)
		if len(credentials) == 0 {
			delete(s.providerCredentials, projectID)
		}
	}

	now := s.now().UTC()
	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return LLMProviderCredentialStatus{}, err
	}

	return LLMProviderCredentialStatus{
		ProjectID: projectID,
		Provider:  provider,
		HasAPIKey: false,
		UpdatedAt: now,
	}, nil
}

func (s *Service) resolveProviderCredentialForModel(ctx context.Context, projectID string, organizationID int64, modelID string) (resolvedModelProviderCredential, error) {
	projectID = strings.TrimSpace(projectID)
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return resolvedModelProviderCredential{}, err
	}
	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return resolvedModelProviderCredential{}, err
	}
	return s.resolveProviderCredentialForModelLocked(projectID, modelID)
}

func (s *Service) resolveProviderCredentialForModelLocked(projectID, modelID string) (resolvedModelProviderCredential, error) {
	modelID = strings.TrimSpace(modelID)
	if modelID == "" {
		return resolvedModelProviderCredential{}, fmt.Errorf("%w: modelId is required", ErrValidation)
	}

	model, exists := s.models[modelID]
	if !exists {
		return resolvedModelProviderCredential{}, fmt.Errorf("%w: model %s", ErrNotFound, modelID)
	}

	providerModelID := strings.TrimSpace(model.ModelID)
	if providerModelID == "" {
		providerModelID = modelID
	}

	providerID := normalizeOpenRouterProvider(model.Provider)
	if providerID == "" {
		return resolvedModelProviderCredential{}, fmt.Errorf("%w: provider is required for model %s", ErrValidation, modelID)
	}

	credentials := s.providerCredentials[projectID]
	if credential, ok := credentials[providerID]; ok && strings.TrimSpace(credential.APIKey) != "" && supportsDirectProviderCredential(providerID) {
		return resolvedModelProviderCredential{
			ProviderID:      providerID,
			ProviderModelID: providerModelID,
			ProviderAPIKey:  strings.TrimSpace(credential.APIKey),
		}, nil
	}

	if providerID != "openrouter" {
		if credential, ok := credentials["openrouter"]; ok && strings.TrimSpace(credential.APIKey) != "" {
			return resolvedModelProviderCredential{
				ProviderID:      "openrouter",
				ProviderModelID: providerModelID,
				ProviderAPIKey:  strings.TrimSpace(credential.APIKey),
			}, nil
		}
	}

	return resolvedModelProviderCredential{}, fmt.Errorf("%w: API key is required for provider %s on project %s", ErrValidation, providerID, projectID)
}

func hasProviderAPIKey(record *LLMProviderCredentialRecord) bool {
	return record != nil && (strings.TrimSpace(record.APIKey) != "" || record.HasAPIKey)
}

func supportsDirectProviderCredential(providerID string) bool {
	switch normalizeOpenRouterProvider(providerID) {
	case "openai", "google", "deepseek", "groq", "mistral", "perplexity", "qwen", "xai", "zai", "openrouter":
		return true
	default:
		return false
	}
}
