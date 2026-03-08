package usecase

import (
	"context"
	"fmt"
	"strings"
)

func (s *Service) CreateAlert(ctx context.Context, projectID string, organizationID int64, input CreateAlertInput) (Alert, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return Alert{}, fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return Alert{}, err
	}

	alertType := strings.TrimSpace(input.AlertType)
	severity := strings.ToLower(strings.TrimSpace(input.Severity))
	title := strings.TrimSpace(input.Title)
	description := strings.TrimSpace(input.Description)
	if alertType == "" || title == "" || description == "" {
		return Alert{}, fmt.Errorf("%w: alertType, title and description are required", ErrValidation)
	}
	if severity != "high" && severity != "medium" && severity != "low" {
		return Alert{}, fmt.Errorf("%w: severity must be high, medium or low", ErrValidation)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return Alert{}, err
	}

	backup := s.snapshotLocked()
	now := s.now().UTC()
	alert := &Alert{
		ID:          s.nextID("alt"),
		ProjectID:   projectID,
		AlertType:   alertType,
		Severity:    severity,
		Title:       title,
		Description: description,
		IsRead:      false,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	s.alerts[alert.ID] = alert
	s.alertsByProject[projectID] = append(s.alertsByProject[projectID], alert.ID)

	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return Alert{}, err
	}
	return copyAlert(alert), nil
}

func (s *Service) ListAlerts(ctx context.Context, projectID string, organizationID int64, unreadOnly bool) ([]Alert, error) {
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

	ids := s.alertsByProject[projectID]
	out := make([]Alert, 0, len(ids))
	for i := len(ids) - 1; i >= 0; i-- {
		alert := s.alerts[ids[i]]
		if alert == nil {
			continue
		}
		if unreadOnly && alert.IsRead {
			continue
		}
		out = append(out, copyAlert(alert))
	}
	return out, nil
}

func (s *Service) MarkAlertRead(ctx context.Context, alertID string, organizationID int64) (Alert, error) {
	alertID = strings.TrimSpace(alertID)
	if alertID == "" {
		return Alert{}, fmt.Errorf("%w: alertId is required", ErrValidation)
	}

	s.mu.Lock()
	if err := s.reloadLocked(ctx); err != nil {
		s.mu.Unlock()
		return Alert{}, err
	}
	alert, ok := s.alerts[alertID]
	if !ok {
		s.mu.Unlock()
		return Alert{}, fmt.Errorf("%w: alert", ErrNotFound)
	}
	projectID := alert.ProjectID
	s.mu.Unlock()

	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return Alert{}, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return Alert{}, err
	}

	backup := s.snapshotLocked()
	alert, ok = s.alerts[alertID]
	if !ok {
		return Alert{}, fmt.Errorf("%w: alert", ErrNotFound)
	}
	alert.IsRead = true
	alert.UpdatedAt = s.now().UTC()
	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return Alert{}, err
	}
	return copyAlert(alert), nil
}

func (s *Service) MarkAllAlertsRead(ctx context.Context, projectID string, organizationID int64) error {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return fmt.Errorf("%w: projectId is required", ErrValidation)
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
	for _, alertID := range s.alertsByProject[projectID] {
		if alert, ok := s.alerts[alertID]; ok {
			alert.IsRead = true
			alert.UpdatedAt = s.now().UTC()
		}
	}
	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return err
	}
	return nil
}

func (s *Service) DeleteAlert(ctx context.Context, alertID string, organizationID int64) error {
	alertID = strings.TrimSpace(alertID)
	if alertID == "" {
		return fmt.Errorf("%w: alertId is required", ErrValidation)
	}

	s.mu.Lock()
	if err := s.reloadLocked(ctx); err != nil {
		s.mu.Unlock()
		return err
	}
	alert, ok := s.alerts[alertID]
	if !ok {
		s.mu.Unlock()
		return fmt.Errorf("%w: alert", ErrNotFound)
	}
	projectID := alert.ProjectID
	s.mu.Unlock()

	if err := s.verifyProjectAccess(ctx, projectID, organizationID); err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return err
	}

	backup := s.snapshotLocked()
	alert, ok = s.alerts[alertID]
	if !ok {
		return fmt.Errorf("%w: alert", ErrNotFound)
	}

	delete(s.alerts, alertID)
	s.alertsByProject[alert.ProjectID] = removeID(s.alertsByProject[alert.ProjectID], alertID)
	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return err
	}
	return nil
}
