package usecase

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

func (s *Service) AddCompetitors(ctx context.Context, projectID string, organizationID int64, competitors []AddCompetitorInput) ([]Competitor, error) {
	if len(competitors) == 0 {
		return nil, fmt.Errorf("%w: competitors cannot be empty", ErrValidation)
	}
	normalized := make([]AddCompetitorInput, 0, len(competitors))
	for _, item := range competitors {
		name := strings.TrimSpace(item.Name)
		if name == "" {
			return nil, fmt.Errorf("%w: competitor name is required", ErrValidation)
		}
		normalized = append(normalized, AddCompetitorInput{Name: name, Domain: strings.TrimSpace(item.Domain), WebsiteURL: strings.TrimSpace(item.WebsiteURL)})
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
	created := make([]*Competitor, 0, len(normalized))
	for _, item := range normalized {
		competitor := &Competitor{ID: s.nextID("cmp"), ProjectID: projectID, Name: item.Name, Domain: item.Domain, WebsiteURL: item.WebsiteURL, IsActive: true, CreatedAt: now, UpdatedAt: now}
		s.competitors[competitor.ID] = competitor
		created = append(created, competitor)
	}
	if err := s.persistLocked(ctx); err != nil {
		for _, item := range created {
			delete(s.competitors, item.ID)
		}
		return nil, err
	}

	out := make([]Competitor, 0, len(created))
	for _, item := range created {
		out = append(out, copyCompetitor(item))
	}
	return out, nil
}

func (s *Service) ListCompetitors(ctx context.Context, projectID string, organizationID int64) ([]Competitor, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return nil, err
	}

	competitors := make([]Competitor, 0)
	for _, competitor := range s.competitors {
		if competitor.ProjectID == projectID {
			competitors = append(competitors, copyCompetitor(competitor))
		}
	}
	sort.Slice(competitors, func(i, j int) bool {
		return competitors[i].CreatedAt.Before(competitors[j].CreatedAt)
	})
	return competitors, nil
}

func (s *Service) ListActiveCompetitors(ctx context.Context, projectID string, organizationID int64) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return nil, err
	}

	return filterActiveCompetitorsByProject(s.competitors, projectID), nil
}

func (s *Service) UpdateCompetitor(ctx context.Context, competitorID string, organizationID int64, input UpdateCompetitorInput) (Competitor, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return Competitor{}, err
	}

	competitor, ok := s.competitors[strings.TrimSpace(competitorID)]
	if !ok {
		return Competitor{}, fmt.Errorf("%w: competitor", ErrNotFound)
	}
	project, ok := s.projects[competitor.ProjectID]
	if !ok {
		return Competitor{}, fmt.Errorf("%w: project", ErrNotFound)
	}
	if isProjectDeleted(project) {
		return Competitor{}, fmt.Errorf("%w: project", ErrNotFound)
	}
	if project.OrganizationID != organizationID {
		return Competitor{}, fmt.Errorf("%w: project access denied", ErrUnauthorized)
	}
	backup := *competitor

	if input.Name != nil {
		value := strings.TrimSpace(*input.Name)
		if value == "" {
			return Competitor{}, fmt.Errorf("%w: competitor name cannot be empty", ErrValidation)
		}
		competitor.Name = value
	}
	if input.Domain != nil {
		competitor.Domain = strings.TrimSpace(*input.Domain)
	}
	if input.WebsiteURL != nil {
		competitor.WebsiteURL = strings.TrimSpace(*input.WebsiteURL)
	}
	if input.IsActive != nil {
		competitor.IsActive = *input.IsActive
	}
	competitor.UpdatedAt = s.now().UTC()
	if err := s.persistLocked(ctx); err != nil {
		*competitor = backup
		return Competitor{}, err
	}
	return copyCompetitor(competitor), nil
}

func (s *Service) DeleteCompetitor(ctx context.Context, competitorID string, organizationID int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return err
	}

	competitor, ok := s.competitors[strings.TrimSpace(competitorID)]
	if !ok {
		return fmt.Errorf("%w: competitor", ErrNotFound)
	}
	project, ok := s.projects[competitor.ProjectID]
	if !ok {
		return fmt.Errorf("%w: project", ErrNotFound)
	}
	if isProjectDeleted(project) {
		return fmt.Errorf("%w: project", ErrNotFound)
	}
	if project.OrganizationID != organizationID {
		return fmt.Errorf("%w: project access denied", ErrUnauthorized)
	}
	delete(s.competitors, competitor.ID)
	if err := s.persistLocked(ctx); err != nil {
		s.competitors[competitor.ID] = competitor
		return err
	}
	return nil
}
