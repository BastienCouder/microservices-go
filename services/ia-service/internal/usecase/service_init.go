package usecase

import (
	"context"
	"fmt"
	"strings"
)

func NewService() *Service {
	svc, _ := NewServiceWithDependencies(Dependencies{Mode: ExecutionModeMock})
	return svc
}

func NewServiceWithDependencies(deps Dependencies) (*Service, error) {
	mode := deps.Mode
	if mode == "" {
		mode = ExecutionModeMock
	}
	if mode != ExecutionModeMock && mode != ExecutionModeProvider {
		return nil, fmt.Errorf("%w: execution mode must be mock or provider", ErrValidation)
	}
	if mode == ExecutionModeProvider && deps.Provider == nil {
		return nil, fmt.Errorf("%w: provider dependency is required in provider mode", ErrValidation)
	}

	svc := &Service{
		supportedModels: map[string]struct{}{
			"gpt-4o-mini":                 {},
			"openai/gpt-4o-mini":          {},
			"gpt-4o":                      {},
			"openai/gpt-4o":               {},
			"gpt-oss-20b-free":            {},
			"openai/gpt-oss-20b:free":     {},
			"gpt-oss-120b-free":           {},
			"openai/gpt-oss-120b:free":    {},
			"claude-3-5-sonnet":           {},
			"anthropic/claude-3.5-sonnet": {},
			"gemini-2.0-flash":            {},
			"google/gemini-2.0-flash-001": {},
			"gemma-3-4b-free":             {},
			"google/gemma-3-4b-it":        {},
			"gemma-3-27b-free":            {},
			"google/gemma-3-27b-it":       {},
			"sonar":                       {},
			"perplexity/sonar":            {},
			"sonar-pro":                   {},
			"perplexity/sonar-pro":        {},
			"mistral-large":               {},
			"mistralai/mistral-large":     {},
			"glm-4.5":                     {},
			"zai/glm-4.5":                 {},
			"glm-4.5-air":                 {},
			"zai/glm-4.5-air":             {},
			"z-ai/glm-4.5-air":            {},
		},
		models:       make(map[string]AIModel),
		mode:         mode,
		provider:     deps.Provider,
		catalogStore: deps.CatalogStore,
	}
	svc.seedDefaultModels()
	if deps.CatalogStore != nil {
		if err := svc.loadCatalog(context.Background()); err != nil {
			return nil, err
		}
	}
	return svc, nil
}

func (s *Service) loadCatalog(ctx context.Context) error {
	if s.catalogStore == nil {
		return nil
	}
	models, err := s.catalogStore.LoadModels(ctx)
	if err != nil {
		return fmt.Errorf("load ai model catalog: %w", err)
	}
	if len(models) == 0 {
		s.seedDefaultModels()
		return s.catalogStore.SaveModels(ctx, s.models)
	}
	s.models = models
	s.normalizeCatalog()
	return nil
}

func (s *Service) persistCatalog(ctx context.Context) error {
	if s.catalogStore == nil {
		return nil
	}
	if err := s.catalogStore.SaveModels(ctx, s.models); err != nil {
		return fmt.Errorf("persist ai model catalog: %w", err)
	}
	return nil
}

func (s *Service) seedDefaultModels() {
	defaults := []AIModel{
		{ID: "gpt-oss-20b-free", Label: "gpt-oss-20b (free)", Provider: "openai", Group: "gpt-oss", IconKey: "openai", IconPath: "/models/openai.svg", ModelID: "openai/gpt-oss-20b:free", Source: AIModelSourceOpenRouter, IsActive: true, CreditCost: 1},
		{ID: "gpt-oss-120b-free", Label: "gpt-oss-120b (free)", Provider: "openai", Group: "gpt-oss", IconKey: "openai", IconPath: "/models/openai.svg", ModelID: "openai/gpt-oss-120b:free", Source: AIModelSourceOpenRouter, IsActive: true, CreditCost: 1},
		{ID: "gemma-3-4b-free", Label: "Gemma 3 4B", Provider: "google", Group: "gemma", IconKey: "google", IconPath: "/models/google.svg", ModelID: "google/gemma-3-4b-it", Source: AIModelSourceOpenRouter, IsActive: true, CreditCost: 1},
		{ID: "gemma-3-27b-free", Label: "Gemma 3 27B", Provider: "google", Group: "gemma", IconKey: "google", IconPath: "/models/google.svg", ModelID: "google/gemma-3-27b-it", Source: AIModelSourceOpenRouter, IsActive: true, CreditCost: 1},
	}
	for _, model := range defaults {
		s.models[model.ID] = model
	}
	s.normalizeCatalog()
}

func (s *Service) normalizeCatalog() {
	for id, model := range s.models {
		model.ID = strings.TrimSpace(model.ID)
		if model.ID == "" {
			model.ID = id
		}
		model.Provider = strings.TrimSpace(model.Provider)
		model.Label = strings.TrimSpace(model.Label)
		model.Group = strings.TrimSpace(model.Group)
		model.IconKey = strings.TrimSpace(model.IconKey)
		model.ModelID = strings.TrimSpace(model.ModelID)
		model.Source = normalizeAIModelSource(model)
		if model.IconPath == "" {
			model.IconPath = modelIconPath(model.IconKey)
		}
		if model.CreditCost <= 0 {
			model.CreditCost = 1
		}
		s.models[id] = model
	}
}
