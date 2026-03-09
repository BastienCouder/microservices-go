package usecase

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"unicode"
)

func normalizePromptStatus(raw string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case PromptStatusActive:
		return PromptStatusActive, true
	case PromptStatusDisabled:
		return PromptStatusDisabled, true
	case PromptStatusArchived:
		return PromptStatusArchived, true
	default:
		return "", false
	}
}

func applyPromptStatus(prompt *Prompt, status string) {
	prompt.Status = status
	prompt.IsActive = status == PromptStatusActive
}

func validatePromptModelIDs(rawModelIDs []string, enabledModelIDs []string) ([]string, error) {
	modelIDs := normalizeModelIDs(rawModelIDs)
	if len(modelIDs) == 0 {
		return nil, fmt.Errorf("%w: modelIds cannot be empty", ErrValidation)
	}

	enabled := make(map[string]struct{}, len(enabledModelIDs))
	for _, modelID := range enabledModelIDs {
		enabled[modelID] = struct{}{}
	}

	for _, modelID := range modelIDs {
		if _, ok := enabled[modelID]; !ok {
			return nil, fmt.Errorf("%w: model %s is not enabled for project", ErrValidation, modelID)
		}
	}

	return modelIDs, nil
}

func defaultPromptSchedule() PromptSchedule {
	return PromptSchedule{
		Mode:       PromptScheduleModeGlobal,
		Cron:       DefaultPromptCron,
		Timezone:   DefaultPromptTimezone,
		ModelCrons: map[string]string{},
	}
}

func isValidCronExpression(raw string) bool {
	fields := strings.Fields(strings.TrimSpace(raw))
	if len(fields) != 5 {
		return false
	}
	for _, field := range fields {
		if field == "" {
			return false
		}
		for _, r := range field {
			if unicode.IsDigit(r) || r == '*' || r == '/' || r == ',' || r == '-' {
				continue
			}
			return false
		}
	}
	return true
}

func normalizePromptSchedule(raw PromptSchedule, allowedModelIDs []string) (PromptSchedule, error) {
	mode := strings.TrimSpace(raw.Mode)
	if mode == "" {
		mode = PromptScheduleModeGlobal
	}
	if mode != PromptScheduleModeGlobal && mode != PromptScheduleModePerModel {
		return PromptSchedule{}, fmt.Errorf("%w: unsupported schedule mode", ErrValidation)
	}

	cron := strings.TrimSpace(raw.Cron)
	if cron == "" {
		cron = DefaultPromptCron
	}
	if !isValidCronExpression(cron) {
		return PromptSchedule{}, fmt.Errorf("%w: invalid cron expression", ErrValidation)
	}

	timezone := strings.TrimSpace(raw.Timezone)
	if timezone == "" {
		timezone = DefaultPromptTimezone
	}

	allowed := make(map[string]struct{}, len(allowedModelIDs))
	for _, modelID := range allowedModelIDs {
		allowed[modelID] = struct{}{}
	}

	modelCrons := make(map[string]string)
	for modelID, modelCron := range raw.ModelCrons {
		trimmedModelID := strings.TrimSpace(modelID)
		if trimmedModelID == "" {
			return PromptSchedule{}, fmt.Errorf("%w: schedule model id cannot be empty", ErrValidation)
		}
		if _, ok := allowed[trimmedModelID]; !ok {
			return PromptSchedule{}, fmt.Errorf("%w: schedule model %s is not enabled for prompt", ErrValidation, trimmedModelID)
		}
		trimmedCron := strings.TrimSpace(modelCron)
		if trimmedCron == "" {
			continue
		}
		if !isValidCronExpression(trimmedCron) {
			return PromptSchedule{}, fmt.Errorf("%w: invalid model cron expression", ErrValidation)
		}
		modelCrons[trimmedModelID] = trimmedCron
	}

	if mode == PromptScheduleModeGlobal {
		modelCrons = map[string]string{}
	}

	return PromptSchedule{
		Mode:       mode,
		Cron:       cron,
		Timezone:   timezone,
		ModelCrons: modelCrons,
	}, nil
}

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

	defaultModelIDs := filterEnabledModels(s.projectModels, projectID)
	if len(defaultModelIDs) == 0 {
		return nil, fmt.Errorf("%w: at least one model must be enabled", ErrValidation)
	}

	now := s.now().UTC()
	created := make([]*Prompt, 0, len(normalized))
	for _, text := range normalized {
		prompt := &Prompt{
			ID:        s.nextID("prm"),
			ProjectID: projectID,
			Text:      text,
			ModelIDs:  nonNilStringSlice(defaultModelIDs),
			Schedule:  defaultPromptSchedule(),
			Status:    PromptStatusActive,
			IsActive:  true,
			CreatedAt: now,
			UpdatedAt: now,
		}
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
	if input.ModelIDs != nil {
		enabledModelIDs := filterEnabledModels(s.projectModels, project.ID)
		modelIDs, err := validatePromptModelIDs(*input.ModelIDs, enabledModelIDs)
		if err != nil {
			return Prompt{}, err
		}
		prompt.ModelIDs = modelIDs
	}
	if input.Schedule != nil {
		schedule, err := normalizePromptSchedule(*input.Schedule, effectivePromptModelIDs(prompt, filterEnabledModels(s.projectModels, project.ID)))
		if err != nil {
			return Prompt{}, err
		}
		prompt.Schedule = schedule
	} else {
		schedule, err := normalizePromptSchedule(prompt.Schedule, effectivePromptModelIDs(prompt, filterEnabledModels(s.projectModels, project.ID)))
		if err != nil {
			return Prompt{}, err
		}
		prompt.Schedule = schedule
	}
	if input.Status != nil {
		status, ok := normalizePromptStatus(*input.Status)
		if !ok {
			return Prompt{}, fmt.Errorf("%w: unsupported prompt status", ErrValidation)
		}
		applyPromptStatus(prompt, status)
	} else if input.IsActive != nil {
		if *input.IsActive {
			applyPromptStatus(prompt, PromptStatusActive)
		} else {
			applyPromptStatus(prompt, PromptStatusDisabled)
		}
	}
	prompt.UpdatedAt = s.now().UTC()
	if err := s.persistLocked(ctx); err != nil {
		*prompt = backup
		return Prompt{}, err
	}
	return copyPrompt(prompt), nil
}

func (s *Service) UpdatePromptsStatus(ctx context.Context, projectID string, organizationID int64, input UpdatePromptsStatusInput) ([]Prompt, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return nil, err
	}

	status, ok := normalizePromptStatus(input.Status)
	if !ok {
		return nil, fmt.Errorf("%w: unsupported prompt status", ErrValidation)
	}

	if len(input.PromptIDs) == 0 {
		return nil, fmt.Errorf("%w: promptIds cannot be empty", ErrValidation)
	}

	uniqueIDs := make([]string, 0, len(input.PromptIDs))
	seen := make(map[string]struct{}, len(input.PromptIDs))
	for _, rawID := range input.PromptIDs {
		promptID := strings.TrimSpace(rawID)
		if promptID == "" {
			return nil, fmt.Errorf("%w: promptId cannot be empty", ErrValidation)
		}
		if _, exists := seen[promptID]; exists {
			continue
		}
		prompt, exists := s.prompts[promptID]
		if !exists {
			return nil, fmt.Errorf("%w: prompt", ErrNotFound)
		}
		if prompt.ProjectID != projectID {
			return nil, fmt.Errorf("%w: prompt does not belong to project", ErrValidation)
		}
		seen[promptID] = struct{}{}
		uniqueIDs = append(uniqueIDs, promptID)
	}

	backups := make(map[string]Prompt, len(uniqueIDs))
	now := s.now().UTC()
	for _, promptID := range uniqueIDs {
		prompt := s.prompts[promptID]
		backups[promptID] = *prompt
		applyPromptStatus(prompt, status)
		prompt.UpdatedAt = now
	}

	if err := s.persistLocked(ctx); err != nil {
		for promptID, backup := range backups {
			restored := backup
			s.prompts[promptID] = &restored
		}
		return nil, err
	}

	updated := make([]Prompt, 0, len(uniqueIDs))
	for _, promptID := range uniqueIDs {
		updated = append(updated, copyPrompt(s.prompts[promptID]))
	}
	return updated, nil
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
