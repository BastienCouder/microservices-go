package usecase

import (
	"context"
	"sort"
)

func (s *Service) ListScheduledAnalysisJobs(ctx context.Context) ([]ScheduledAnalysisJob, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	projectIDs := make([]string, 0, len(s.projects))
	for projectID, project := range s.projects {
		if project == nil || isProjectDeleted(project) {
			continue
		}
		projectIDs = append(projectIDs, projectID)
	}
	sort.Slice(projectIDs, func(i, j int) bool {
		left := s.projects[projectIDs[i]]
		right := s.projects[projectIDs[j]]
		if left == nil || right == nil {
			return projectIDs[i] < projectIDs[j]
		}
		if left.CreatedAt.Equal(right.CreatedAt) {
			return left.ID < right.ID
		}
		return left.CreatedAt.Before(right.CreatedAt)
	})

	jobs := make([]ScheduledAnalysisJob, 0)
	for _, projectID := range projectIDs {
		project := s.projects[projectID]
		if project == nil || isProjectDeleted(project) {
			continue
		}
		effectiveProject := s.effectiveProjectLocked(project)

		enabledModelIDs := filterEnabledModels(s.projectModels, s.models, projectID)
		if len(enabledModelIDs) == 0 {
			continue
		}

		competitors := filterActiveCompetitorsByProject(s.competitors, projectID)
		promptIDs := make([]string, 0)
		for promptID, prompt := range s.prompts {
			if prompt == nil || prompt.ProjectID != projectID || !prompt.IsActive {
				continue
			}
			promptIDs = append(promptIDs, promptID)
		}
		sort.Strings(promptIDs)

		for _, promptID := range promptIDs {
			prompt := s.prompts[promptID]
			if prompt == nil {
				continue
			}

			modelIDs := effectivePromptModelIDs(prompt, enabledModelIDs)
			if len(modelIDs) == 0 {
				continue
			}
			providerCredentials := make(map[string]ScheduledModelProviderCredential, len(modelIDs))
			for _, modelID := range modelIDs {
				credential, err := s.resolveProviderCredentialForModelLocked(projectID, modelID)
				if err != nil {
					continue
				}
				providerCredentials[modelID] = ScheduledModelProviderCredential(credential)
			}

			jobs = append(jobs, ScheduledAnalysisJob{
				ProjectID:           effectiveProject.ID,
				ProjectName:         effectiveProject.Name,
				OrganizationID:      effectiveProject.OrganizationID,
				CreatedBy:           effectiveProject.CreatedBy,
				BrandName:           effectiveProject.BrandName,
				Competitors:         append([]string(nil), competitors...),
				PromptID:            prompt.ID,
				PromptText:          prompt.Text,
				ModelIDs:            append([]string(nil), modelIDs...),
				ProviderCredentials: providerCredentials,
				Schedule:            copyPromptSchedule(prompt.Schedule),
			})
		}
	}

	return jobs, nil
}
