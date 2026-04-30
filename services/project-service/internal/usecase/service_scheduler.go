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
		if project == nil {
			continue
		}
		projectIDs = append(projectIDs, projectID)
	}
	sort.Strings(projectIDs)

	jobs := make([]ScheduledAnalysisJob, 0)
	for _, projectID := range projectIDs {
		project := s.projects[projectID]
		if project == nil {
			continue
		}

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
				providerCredentials[modelID] = ScheduledModelProviderCredential{
					ProviderID:      credential.ProviderID,
					ProviderModelID: credential.ProviderModelID,
					ProviderAPIKey:  credential.ProviderAPIKey,
				}
			}

			jobs = append(jobs, ScheduledAnalysisJob{
				ProjectID:           project.ID,
				ProjectName:         project.Name,
				OrganizationID:      project.OrganizationID,
				CreatedBy:           project.CreatedBy,
				BrandName:           project.BrandName,
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
