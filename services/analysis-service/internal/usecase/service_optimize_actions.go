package usecase

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

const optimizeActionBriefCreditCost = 1

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
	if actionType == "" || title == "" || issue == "" {
		return OptimizeAction{}, fmt.Errorf("%w: type, title and issue are required", ErrValidation)
	}
	sourceErrorID := strings.TrimSpace(input.SourceErrorID)
	metadata := copyMetadata(input.Metadata)
	if metadata == nil {
		metadata = make(map[string]any)
	}
	if status == "processing" {
		if s.optimizeActionBriefGenerator == nil {
			return OptimizeAction{}, fmt.Errorf("%w: optimize action brief generator is not configured", ErrDependencyUnavailable)
		}
		if err := s.ensureOptimizeActionBriefPlanAccess(ctx, organizationID); err != nil {
			return OptimizeAction{}, err
		}
		reservation, err := s.ReserveCreditUsage(ctx, CreditUsageInput{
			RequestID:      optimizeActionBriefRequestID(sourceErrorID, title),
			OrganizationID: organizationID,
			CreatedBy:      input.CreatedBy,
			ProjectID:      projectID,
			RunType:        RunTypeOptimizeActionBrief,
			Credits:        optimizeActionBriefCreditCost,
		})
		if err != nil {
			return OptimizeAction{}, err
		}

		brief, err := s.optimizeActionBriefGenerator.GenerateOptimizeActionBrief(ctx, OptimizeActionBriefInput{
			ProjectID:        projectID,
			OrganizationID:   organizationID,
			Priority:         priority,
			Type:             actionType,
			Title:            title,
			Issue:            issue,
			Impact:           strings.TrimSpace(input.Impact),
			GeneratedContent: generatedContent,
			SourceErrorID:    sourceErrorID,
			Source:           metadataString(metadata, "source"),
			DetectedInModels: metadataStringSlice(metadata, "detectedInModels"),
			Metadata:         metadata,
		})
		if err != nil {
			_, _ = s.ReleaseCreditUsage(ctx, reservation.ID)
			return OptimizeAction{}, fmt.Errorf("%w: generate optimize action brief: %v", ErrDependencyUnavailable, err)
		} else if strings.TrimSpace(brief) != "" {
			generatedContent = strings.TrimSpace(brief)
			metadata["briefSource"] = "ai"
			_, _ = s.CompleteCreditUsage(ctx, reservation.ID)
		} else {
			_, _ = s.ReleaseCreditUsage(ctx, reservation.ID)
			return OptimizeAction{}, fmt.Errorf("%w: generate optimize action brief returned empty content", ErrDependencyUnavailable)
		}
	}
	if generatedContent == "" {
		return OptimizeAction{}, fmt.Errorf("%w: generatedContent is required", ErrValidation)
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
		SourceErrorID:    sourceErrorID,
		Metadata:         metadata,
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

func (s *Service) ensureOptimizeActionBriefPlanAccess(ctx context.Context, organizationID int64) error {
	if s.billingQuota == nil {
		return nil
	}
	provider, ok := s.billingQuota.(BillingEntitlementsProvider)
	if !ok {
		return nil
	}
	entitlements, found, err := provider.GetOrganizationEntitlements(ctx, organizationID)
	if err != nil {
		return err
	}
	if !found || !entitlements.AllowAIBriefs {
		return fmt.Errorf("%w: optimize action brief is not enabled for this plan", ErrUnauthorized)
	}
	return nil
}

func optimizeActionBriefRequestID(sourceErrorID, title string) string {
	sourceErrorID = strings.TrimSpace(sourceErrorID)
	if sourceErrorID != "" {
		return "optimize-action-brief:" + sourceErrorID
	}
	title = strings.TrimSpace(title)
	if title != "" {
		return "optimize-action-brief:title:" + title
	}
	return ""
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

func metadataString(input map[string]any, key string) string {
	if input == nil {
		return ""
	}
	if value, ok := input[key].(string); ok {
		return strings.TrimSpace(value)
	}
	return ""
}

func metadataStringSlice(input map[string]any, key string) []string {
	if input == nil {
		return nil
	}
	values, ok := input[key].([]string)
	if ok {
		out := make([]string, 0, len(values))
		for _, value := range values {
			if trimmed := strings.TrimSpace(value); trimmed != "" {
				out = append(out, trimmed)
			}
		}
		return out
	}
	rawValues, ok := input[key].([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(rawValues))
	for _, raw := range rawValues {
		if value, ok := raw.(string); ok {
			if trimmed := strings.TrimSpace(value); trimmed != "" {
				out = append(out, trimmed)
			}
		}
	}
	return out
}
