package usecase

import (
	"context"
	"fmt"
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

	return []string{
		fmt.Sprintf("What is %s, and how would you describe its positioning in %s?", brand, category),
		fmt.Sprintf("Who is %s for, and what problems or use cases does it solve?", brand),
		fmt.Sprintf("How does %s compare with its competitors, and what are its main strengths, weaknesses, and trust signals?", brand),
	}
}

func (s *Service) ensurePerceptionPromptsLocked(project Project, modelIDs []string) []AnalysisPromptText {
	now := s.now().UTC()
	texts := buildPerceptionPromptTexts(project)
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
			ModelIDs: nonNilStringSlice(modelIDs),
		})
	}
	return out
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
	projectCopy := copyProject(project)
	if createdBy > 0 {
		projectCopy.CreatedBy = createdBy
	}

	modelIDs := filterEnabledModels(s.projectModels, s.models, projectID)
	if len(modelIDs) == 0 {
		s.mu.Unlock()
		return AnalysisStartResponse{}, fmt.Errorf("%w: at least one model must be enabled", ErrValidation)
	}

	backup := s.snapshotLocked()
	prompts := s.ensurePerceptionPromptsLocked(projectCopy, modelIDs)
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
	return s.runAnalysis(ctx, projectCopy, prompts, modelIDs, competitors, requestID, PromptKindPerception, input.Force)
}
