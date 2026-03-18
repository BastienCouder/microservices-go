package usecase

import "fmt"

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

	return &Service{
		supportedModels: map[string]struct{}{
			"gpt-4o-mini":                 {},
			"openai/gpt-4o-mini":          {},
			"gpt-4o":                      {},
			"openai/gpt-4o":               {},
			"claude-3-5-sonnet":           {},
			"anthropic/claude-3.5-sonnet": {},
			"gemini-2.0-flash":            {},
			"google/gemini-2.0-flash-001": {},
			"sonar":                       {},
			"perplexity/sonar":            {},
			"sonar-pro":                   {},
			"perplexity/sonar-pro":        {},
			"mistral-large":               {},
			"mistralai/mistral-large":     {},
		},
		mode:     mode,
		provider: deps.Provider,
	}, nil
}
