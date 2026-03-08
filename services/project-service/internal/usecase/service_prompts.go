package usecase

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

func (s *Service) AddPrompts(ctx context.Context, projectID string, organizationID int64, prompts []string) ([]Prompt, error) {
	if len(prompts) == 0 {
		return nil, fmt.Errorf("%w: prompts cannot be empty", ErrValidation)
	}

	normalized := make([]string, 0, len(prompts))
	for _, raw := range prompts {
		text := strings.TrimSpace(raw)
		if text == "" {
			return nil, fmt.Errorf("%w: prompt text cannot be empty", ErrValidation)
		}
		normalized = append(normalized, text)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return nil, err
	}

	now := s.now().UTC()
	created := make([]*Prompt, 0, len(normalized))
	for _, text := range normalized {
		prompt := &Prompt{ID: s.nextID("prm"), ProjectID: projectID, Text: text, IsActive: true, CreatedAt: now, UpdatedAt: now}
		s.prompts[prompt.ID] = prompt
		created = append(created, prompt)
	}
	if err := s.persistLocked(ctx); err != nil {
		for _, item := range created {
			delete(s.prompts, item.ID)
		}
		return nil, err
	}

	out := make([]Prompt, 0, len(created))
	for _, item := range created {
		out = append(out, copyPrompt(item))
	}
	return out, nil
}

func normalizePromptPage(input ListPromptsInput) ListPromptsInput {
	if input.Page <= 0 {
		input.Page = 1
	}
	if input.PageSize <= 0 {
		input.PageSize = 25
	}
	if input.PageSize > 100 {
		input.PageSize = 100
	}
	input.Search = strings.TrimSpace(input.Search)
	return input
}

func (s *Service) ListPrompts(ctx context.Context, projectID string, organizationID int64, input ListPromptsInput) (PromptPage, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return PromptPage{}, err
	}

	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return PromptPage{}, err
	}

	input = normalizePromptPage(input)
	search := strings.ToLower(input.Search)
	prompts := make([]Prompt, 0)
	for _, prompt := range s.prompts {
		if prompt.ProjectID != projectID {
			continue
		}
		if search != "" && !strings.Contains(strings.ToLower(prompt.Text), search) {
			continue
		}
		prompts = append(prompts, copyPrompt(prompt))
	}
	sort.Slice(prompts, func(i, j int) bool {
		return prompts[i].CreatedAt.After(prompts[j].CreatedAt)
	})

	total := len(prompts)
	if total == 0 {
		return PromptPage{
			Items:       []Prompt{},
			Total:       0,
			Page:        input.Page,
			PageSize:    input.PageSize,
			TotalPages:  0,
			HasNext:     false,
			HasPrevious: input.Page > 1,
		}, nil
	}

	totalPages := (total + input.PageSize - 1) / input.PageSize
	if input.Page > totalPages {
		input.Page = totalPages
	}

	start := (input.Page - 1) * input.PageSize
	if start < 0 {
		start = 0
	}
	end := start + input.PageSize
	if end > total {
		end = total
	}

	items := make([]Prompt, 0, end-start)
	for _, prompt := range prompts[start:end] {
		items = append(items, prompt)
	}

	return PromptPage{
		Items:       items,
		Total:       total,
		Page:        input.Page,
		PageSize:    input.PageSize,
		TotalPages:  totalPages,
		HasNext:     input.Page < totalPages,
		HasPrevious: input.Page > 1,
	}, nil
}

func (s *Service) UpdatePrompt(ctx context.Context, promptID string, organizationID int64, input UpdatePromptInput) (Prompt, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return Prompt{}, err
	}

	prompt, ok := s.prompts[strings.TrimSpace(promptID)]
	if !ok {
		return Prompt{}, fmt.Errorf("%w: prompt", ErrNotFound)
	}
	project, ok := s.projects[prompt.ProjectID]
	if !ok {
		return Prompt{}, fmt.Errorf("%w: project", ErrNotFound)
	}
	if project.OrganizationID != organizationID {
		return Prompt{}, fmt.Errorf("%w: project access denied", ErrUnauthorized)
	}
	backup := *prompt

	if input.Text != nil {
		value := strings.TrimSpace(*input.Text)
		if value == "" {
			return Prompt{}, fmt.Errorf("%w: prompt text cannot be empty", ErrValidation)
		}
		prompt.Text = value
	}
	if input.Intent != nil {
		prompt.Intent = strings.TrimSpace(*input.Intent)
	}
	if input.IsActive != nil {
		prompt.IsActive = *input.IsActive
	}
	prompt.UpdatedAt = s.now().UTC()
	if err := s.persistLocked(ctx); err != nil {
		*prompt = backup
		return Prompt{}, err
	}
	return copyPrompt(prompt), nil
}

func (s *Service) DeletePrompt(ctx context.Context, promptID string, organizationID int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return err
	}

	prompt, ok := s.prompts[strings.TrimSpace(promptID)]
	if !ok {
		return fmt.Errorf("%w: prompt", ErrNotFound)
	}
	project, ok := s.projects[prompt.ProjectID]
	if !ok {
		return fmt.Errorf("%w: project", ErrNotFound)
	}
	if project.OrganizationID != organizationID {
		return fmt.Errorf("%w: project access denied", ErrUnauthorized)
	}
	delete(s.prompts, prompt.ID)
	if err := s.persistLocked(ctx); err != nil {
		s.prompts[prompt.ID] = prompt
		return err
	}
	return nil
}
