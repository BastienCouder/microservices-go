package usecase

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"
)

func buildPerceptionPromptTexts(project Project) []string {
	brand := strings.TrimSpace(project.BrandName)
	if brand == "" {
		brand = strings.TrimSpace(project.Name)
	}
	if brand == "" {
		brand = "the brand"
	}

	category := strings.TrimSpace(project.Industry)
	if category == "" {
		category = "its category"
	}

	if language, _ := normalizePromptLanguage(project.PrimaryLanguage); language == "fr" {
		if category == "its category" {
			category = "sa catégorie"
		}
		return []string{
			fmt.Sprintf("Qu'est-ce que %s, et comment décrirais-tu son positionnement dans %s ?", brand, category),
			fmt.Sprintf("À qui s'adresse %s, et quels problèmes ou cas d'usage résout-elle ?", brand),
			fmt.Sprintf("Comment %s se compare à ses concurrents, et quels sont ses principaux points forts, faiblesses et signaux de confiance ?", brand),
		}
	}

	return []string{
		fmt.Sprintf("What is %s, and how would you describe its positioning in %s?", brand, category),
		fmt.Sprintf("Who is %s for, and what problems or use cases does it solve?", brand),
		fmt.Sprintf("How does %s compare with its competitors, and what are its main strengths, weaknesses, and trust signals?", brand),
	}
}

func (s *Service) ensurePerceptionPromptsLocked(project Project, modelIDs []string) []AnalysisPromptText {
	now := s.now().UTC()
	texts := buildPerceptionPromptTexts(project)
	defaultLanguage := defaultPromptLanguage(project)
	existingByText := make(map[string]*Prompt)
	for _, prompt := range s.prompts {
		if prompt.ProjectID != project.ID || normalizePromptKind(prompt.Kind) != PromptKindPerception {
			continue
		}
		existingByText[strings.TrimSpace(prompt.Text)] = prompt
	}

	out := make([]AnalysisPromptText, 0, len(texts))
	for _, text := range texts {
		prompt := existingByText[text]
		if prompt == nil {
			prompt = &Prompt{
				ID:        s.nextID("prm"),
				ProjectID: project.ID,
				Text:      text,
				Language:  defaultLanguage,
				Kind:      PromptKindPerception,
				ModelIDs:  nonNilStringSlice(modelIDs),
				Schedule: PromptSchedule{
					Mode:       PromptScheduleModeGlobal,
					Cron:       "",
					Timezone:   DefaultPromptTimezone,
					ModelCrons: map[string]string{},
				},
				Status:    PromptStatusActive,
				IsActive:  true,
				CreatedAt: now,
				UpdatedAt: now,
			}
			s.prompts[prompt.ID] = prompt
		} else {
			if prompt.Language == "" {
				prompt.Language = defaultLanguage
			}
			prompt.Kind = PromptKindPerception
			prompt.ModelIDs = nonNilStringSlice(modelIDs)
			prompt.Schedule = prunePromptScheduleModelCrons(prompt.Schedule, modelIDs)
			prompt.Schedule.Mode = PromptScheduleModeGlobal
			prompt.Schedule.Cron = ""
			if prompt.Schedule.Timezone == "" {
				prompt.Schedule.Timezone = DefaultPromptTimezone
			}
			applyPromptStatus(prompt, PromptStatusActive)
			prompt.UpdatedAt = now
		}

		out = append(out, AnalysisPromptText{
			ID:       prompt.ID,
			Text:     prompt.Text,
			Kind:     PromptKindPerception,
			Language: prompt.Language,
			ModelIDs: nonNilStringSlice(modelIDs),
		})
	}
	return out
}

func (s *Service) listActivePerceptionPromptTextsLocked(projectID string, modelIDs []string) []AnalysisPromptText {
	prompts := make([]Prompt, 0)
	for _, prompt := range s.prompts {
		if prompt.ProjectID != projectID || normalizePromptKind(prompt.Kind) != PromptKindPerception {
			continue
		}
		if !prompt.IsActive || strings.TrimSpace(prompt.Text) == "" {
			continue
		}
		prompts = append(prompts, copyPrompt(prompt))
	}
	sort.Slice(prompts, func(i, j int) bool {
		return prompts[i].CreatedAt.Before(prompts[j].CreatedAt)
	})

	out := make([]AnalysisPromptText, 0, len(prompts))
	for _, prompt := range prompts {
		language := prompt.Language
		if language == "" {
			language = "fr"
		}
		out = append(out, AnalysisPromptText{
			ID:       prompt.ID,
			Text:     prompt.Text,
			Kind:     PromptKindPerception,
			Language: language,
			ModelIDs: nonNilStringSlice(modelIDs),
		})
	}
	return out
}

func normalizePromptIDs(promptIDs []string) []string {
	seen := make(map[string]struct{}, len(promptIDs))
	out := make([]string, 0, len(promptIDs))
	for _, raw := range promptIDs {
		promptID := strings.TrimSpace(raw)
		if promptID == "" {
			continue
		}
		if _, exists := seen[promptID]; exists {
			continue
		}
		seen[promptID] = struct{}{}
		out = append(out, promptID)
	}
	return out
}

func (s *Service) selectedPerceptionPromptTextsLocked(projectID string, promptIDs []string, modelIDs []string) ([]AnalysisPromptText, error) {
	normalizedPromptIDs := normalizePromptIDs(promptIDs)
	if len(normalizedPromptIDs) == 0 {
		return nil, fmt.Errorf("%w: promptIds cannot be empty", ErrValidation)
	}

	out := make([]AnalysisPromptText, 0, len(normalizedPromptIDs))
	for _, promptID := range normalizedPromptIDs {
		prompt, ok := s.prompts[promptID]
		if !ok || prompt.ProjectID != projectID {
			return nil, fmt.Errorf("%w: prompt %s", ErrNotFound, promptID)
		}
		if normalizePromptKind(prompt.Kind) != PromptKindPerception {
			return nil, fmt.Errorf("%w: prompt %s is not a perception prompt", ErrValidation, promptID)
		}
		if !prompt.IsActive {
			return nil, fmt.Errorf("%w: prompt %s is not active", ErrValidation, promptID)
		}
		text := strings.TrimSpace(prompt.Text)
		if text == "" {
			return nil, fmt.Errorf("%w: prompt text is required", ErrValidation)
		}
		language := prompt.Language
		if language == "" {
			language = "fr"
		}
		out = append(out, AnalysisPromptText{
			ID:       prompt.ID,
			Text:     text,
			Kind:     PromptKindPerception,
			Language: language,
			ModelIDs: nonNilStringSlice(modelIDs),
		})
	}
	return out, nil
}

func (s *Service) RunPerceptionAnalysis(ctx context.Context, projectID string, organizationID int64, createdBy int64, input RunPerceptionAnalysisInput) (AnalysisStartResponse, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return AnalysisStartResponse{}, fmt.Errorf("%w: projectId is required", ErrValidation)
	}

	s.mu.Lock()
	if err := s.reloadLocked(ctx); err != nil {
		s.mu.Unlock()
		return AnalysisStartResponse{}, err
	}

	project, err := s.getProjectForOrganizationLocked(projectID, organizationID)
	if err != nil {
		s.mu.Unlock()
		return AnalysisStartResponse{}, err
	}
	projectCopy := s.effectiveProjectLocked(project)
	if createdBy > 0 {
		projectCopy.CreatedBy = createdBy
	}

	modelIDs := filterEnabledModels(s.projectModels, s.models, projectID)
	if len(modelIDs) == 0 {
		s.mu.Unlock()
		return AnalysisStartResponse{}, fmt.Errorf("%w: at least one model must be enabled", ErrValidation)
	}
	if len(input.ModelIDs) > 0 {
		var err error
		modelIDs, err = validatePromptModelIDs(input.ModelIDs, modelIDs)
		if err != nil {
			s.mu.Unlock()
			return AnalysisStartResponse{}, err
		}
	}

	backup := s.snapshotLocked()
	prompts := make([]AnalysisPromptText, 0)
	var promptErr error
	if len(input.PromptIDs) > 0 {
		prompts, promptErr = s.selectedPerceptionPromptTextsLocked(projectID, input.PromptIDs, modelIDs)
	} else {
		prompts = s.listActivePerceptionPromptTextsLocked(projectID, modelIDs)
		if len(prompts) == 0 {
			prompts = s.ensurePerceptionPromptsLocked(projectCopy, modelIDs)
		}
	}
	if promptErr != nil {
		s.restoreLocked(backup)
		s.mu.Unlock()
		return AnalysisStartResponse{}, promptErr
	}
	if len(prompts) == 0 {
		s.restoreLocked(backup)
		s.mu.Unlock()
		return AnalysisStartResponse{}, fmt.Errorf("%w: perception prompts cannot be empty", ErrValidation)
	}
	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		s.mu.Unlock()
		return AnalysisStartResponse{}, err
	}
	competitors := filterActiveCompetitorsByProject(s.competitors, projectID)
	s.mu.Unlock()

	requestID := strings.TrimSpace(input.RequestID)
	if requestID == "" {
		requestID = fmt.Sprintf("%s-perception-%s", projectID, time.Now().UTC().Format("20060102"))
	}
	return s.runAnalysis(ctx, projectCopy, prompts, modelIDs, competitors, requestID, "manual", input.Force)
}
