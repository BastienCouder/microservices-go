package usecase

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

func (s *Service) AddPrompts(ctx context.Context, projectID, userID string, prompts []string) ([]Prompt, error) {
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

	if _, err := s.getOwnedProjectLocked(projectID, userID); err != nil {
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

func (s *Service) ListPrompts(_ context.Context, projectID, userID string) ([]Prompt, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if _, err := s.getOwnedProjectLocked(projectID, userID); err != nil {
		return nil, err
	}

	prompts := make([]Prompt, 0)
	for _, prompt := range s.prompts {
		if prompt.ProjectID == projectID {
			prompts = append(prompts, copyPrompt(prompt))
		}
	}
	sort.Slice(prompts, func(i, j int) bool {
		return prompts[i].CreatedAt.Before(prompts[j].CreatedAt)
	})
	return prompts, nil
}

func (s *Service) UpdatePrompt(ctx context.Context, promptID, userID string, input UpdatePromptInput) (Prompt, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	prompt, ok := s.prompts[strings.TrimSpace(promptID)]
	if !ok {
		return Prompt{}, fmt.Errorf("%w: prompt", ErrNotFound)
	}
	project, ok := s.projects[prompt.ProjectID]
	if !ok {
		return Prompt{}, fmt.Errorf("%w: project", ErrNotFound)
	}
	if project.UserID != strings.TrimSpace(userID) {
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

func (s *Service) DeletePrompt(ctx context.Context, promptID, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	prompt, ok := s.prompts[strings.TrimSpace(promptID)]
	if !ok {
		return fmt.Errorf("%w: prompt", ErrNotFound)
	}
	project, ok := s.projects[prompt.ProjectID]
	if !ok {
		return fmt.Errorf("%w: project", ErrNotFound)
	}
	if project.UserID != strings.TrimSpace(userID) {
		return fmt.Errorf("%w: project access denied", ErrUnauthorized)
	}
	delete(s.prompts, prompt.ID)
	if err := s.persistLocked(ctx); err != nil {
		s.prompts[prompt.ID] = prompt
		return err
	}
	return nil
}
