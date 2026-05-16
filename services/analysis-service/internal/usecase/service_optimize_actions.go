package usecase

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

func (s *Service) CreateOptimizeAction(ctx context.Context, projectID string, organizationID int64, input CreateOptimizeActionInput) (OptimizeAction, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return OptimizeAction{}, fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return OptimizeAction{}, err
	}

	priority := normalizeOptimizeActionPriority(input.Priority)
	actionType := strings.TrimSpace(input.Type)
	title := strings.TrimSpace(input.Title)
	issue := strings.TrimSpace(input.Issue)
	generatedContent := strings.TrimSpace(input.GeneratedContent)
	status, err := normalizeOptimizeActionStatus(input.Status)
	if err != nil {
		return OptimizeAction{}, err
	}
	if actionType == "" || title == "" || issue == "" || generatedContent == "" {
		return OptimizeAction{}, fmt.Errorf("%w: type, title, issue and generatedContent are required", ErrValidation)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return OptimizeAction{}, err
	}

	backup := s.snapshotLocked()
	now := s.now().UTC()
	action := &OptimizeAction{
		ID:               s.nextID("optact"),
		ProjectID:        projectID,
		Priority:         priority,
		Type:             actionType,
		Title:            title,
		Issue:            issue,
		Impact:           strings.TrimSpace(input.Impact),
		GeneratedContent: generatedContent,
		Status:           status,
		SourceErrorID:    strings.TrimSpace(input.SourceErrorID),
		Metadata:         copyMetadata(input.Metadata),
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	s.optimizeActions[action.ID] = action
	s.actionsByProject[projectID] = append(s.actionsByProject[projectID], action.ID)

	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return OptimizeAction{}, err
	}
	return copyOptimizeAction(action), nil
}

func (s *Service) ListOptimizeActions(ctx context.Context, projectID string, organizationID int64) ([]OptimizeAction, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return nil, fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return nil, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	ids := s.actionsByProject[projectID]
	out := make([]OptimizeAction, 0, len(ids))
	for i := len(ids) - 1; i >= 0; i-- {
		action := s.optimizeActions[ids[i]]
		if action == nil {
			continue
		}
		out = append(out, copyOptimizeAction(action))
	}
	sort.SliceStable(out, func(i, j int) bool {
		return out[i].CreatedAt.After(out[j].CreatedAt)
	})
	return out, nil
}

func (s *Service) UpdateOptimizeActionStatus(ctx context.Context, projectID string, organizationID int64, actionID string, status string) (OptimizeAction, error) {
	projectID = strings.TrimSpace(projectID)
	actionID = strings.TrimSpace(actionID)
	if projectID == "" || actionID == "" {
		return OptimizeAction{}, fmt.Errorf("%w: projectId and actionId are required", ErrValidation)
	}
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return OptimizeAction{}, err
	}
	normalizedStatus, err := normalizeOptimizeActionStatus(status)
	if err != nil {
		return OptimizeAction{}, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return OptimizeAction{}, err
	}

	backup := s.snapshotLocked()
	action, ok := s.optimizeActions[actionID]
	if !ok || action.ProjectID != projectID {
		return OptimizeAction{}, fmt.Errorf("%w: optimize action", ErrNotFound)
	}
	action.Status = normalizedStatus
	action.UpdatedAt = s.now().UTC()

	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return OptimizeAction{}, err
	}
	return copyOptimizeAction(action), nil
}

func (s *Service) DeleteOptimizeAction(ctx context.Context, projectID string, organizationID int64, actionID string) error {
	projectID = strings.TrimSpace(projectID)
	actionID = strings.TrimSpace(actionID)
	if projectID == "" || actionID == "" {
		return fmt.Errorf("%w: projectId and actionId are required", ErrValidation)
	}
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return err
	}

	backup := s.snapshotLocked()
	action, ok := s.optimizeActions[actionID]
	if !ok || action.ProjectID != projectID {
		return fmt.Errorf("%w: optimize action", ErrNotFound)
	}
	delete(s.optimizeActions, actionID)
	s.actionsByProject[projectID] = removeID(s.actionsByProject[projectID], actionID)

	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return err
	}
	return nil
}

func normalizeOptimizeActionPriority(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "high", "medium", "low":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "medium"
	}
}

func normalizeOptimizeActionStatus(value string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "draft":
		return "draft", nil
	case "processing", "in_progress", "in-progress", "en cours":
		return "processing", nil
	case "done", "fait", "termine", "terminée":
		return "done", nil
	case "published":
		return "published", nil
	default:
		return "", fmt.Errorf("%w: status must be draft, processing, done or published", ErrValidation)
	}
}

func copyMetadata(input map[string]any) map[string]any {
	if input == nil {
		return nil
	}
	out := make(map[string]any, len(input))
	for key, value := range input {
		out[key] = value
	}
	return out
}
