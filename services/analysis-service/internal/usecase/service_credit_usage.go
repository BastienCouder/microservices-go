package usecase

import (
	"context"
	"fmt"
	"strings"
)

const (
	RunTypeContentSelectedAnalysis = "content_selected_analysis"
	RunTypeAgentReadyScan          = "agent_ready_scan"
	RunTypeOptimizeActionBrief     = "optimize_action_brief"
)

type CreditUsageInput struct {
	RequestID      string
	OrganizationID int64
	CreatedBy      int64
	ProjectID      string
	RunType        string
	Credits        int
}

func (s *Service) ConsumeCreditUsage(ctx context.Context, input CreditUsageInput) (AnalysisRun, error) {
	run, err := s.ReserveCreditUsage(ctx, input)
	if err != nil {
		return AnalysisRun{}, err
	}
	return s.CompleteCreditUsage(ctx, run.ID)
}

func (s *Service) ReserveCreditUsage(ctx context.Context, input CreditUsageInput) (AnalysisRun, error) {
	projectID := strings.TrimSpace(input.ProjectID)
	if projectID == "" {
		return AnalysisRun{}, fmt.Errorf("%w: projectId is required", ErrValidation)
	}
	if input.OrganizationID <= 0 {
		return AnalysisRun{}, fmt.Errorf("%w: organizationId must be positive", ErrValidation)
	}
	runType := strings.TrimSpace(input.RunType)
	if runType == "" {
		return AnalysisRun{}, fmt.Errorf("%w: runType is required", ErrValidation)
	}
	if input.Credits <= 0 {
		return AnalysisRun{}, fmt.Errorf("%w: credits must be positive", ErrValidation)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return AnalysisRun{}, err
	}

	requestID := strings.TrimSpace(input.RequestID)
	if requestID != "" {
		requestKey := projectID + "|" + requestID
		if existingRunID, ok := s.runByRequest[requestKey]; ok {
			run := s.runs[existingRunID]
			if run == nil {
				return AnalysisRun{}, fmt.Errorf("%w: run", ErrNotFound)
			}
			return copyAnalysisRun(run), nil
		}
	}

	now := s.now().UTC()
	if s.billingQuota != nil {
		monthlyQuota, found, err := s.billingQuota.GetMonthlyQuota(ctx, input.OrganizationID)
		if err != nil {
			return AnalysisRun{}, err
		}
		if found && monthlyQuota > 0 {
			reservedCredits := s.currentMonthlyReservedCreditUsageLocked(input.OrganizationID, now)
			if reservedCredits+input.Credits > monthlyQuota {
				return AnalysisRun{}, fmt.Errorf(
					"%w: monthly credit quota reached (%d/%d)",
					ErrQuotaExceeded,
					reservedCredits,
					monthlyQuota,
				)
			}
		}
	}

	backup := s.snapshotLocked()
	run := &AnalysisRun{
		ID:                 s.nextID("run"),
		ProjectID:          projectID,
		OrganizationID:     input.OrganizationID,
		CreatedBy:          input.CreatedBy,
		RunType:            runType,
		Status:             "running",
		PromptsCount:       0,
		ModelsCount:        0,
		CreditsCount:       input.Credits,
		ExpectedResponses:  0,
		CompletedResponses: 0,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
	s.runs[run.ID] = run
	s.runsByProject[projectID] = append(s.runsByProject[projectID], run.ID)
	if requestID != "" {
		s.runByRequest[projectID+"|"+requestID] = run.ID
	}

	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return AnalysisRun{}, err
	}
	return copyAnalysisRun(run), nil
}

func (s *Service) LinkCreditUsageRequest(ctx context.Context, projectID string, requestID string, runID string) error {
	projectID = strings.TrimSpace(projectID)
	requestID = strings.TrimSpace(requestID)
	runID = strings.TrimSpace(runID)
	if projectID == "" || requestID == "" || runID == "" {
		return fmt.Errorf("%w: projectId, requestId and runId are required", ErrValidation)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return err
	}
	run := s.runs[runID]
	if run == nil {
		return fmt.Errorf("%w: run", ErrNotFound)
	}
	if strings.TrimSpace(run.ProjectID) != projectID {
		return fmt.Errorf("%w: run does not belong to project", ErrValidation)
	}

	backup := s.snapshotLocked()
	s.runByRequest[projectID+"|"+requestID] = runID
	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return err
	}
	return nil
}

func (s *Service) CompleteCreditUsage(ctx context.Context, runID string) (AnalysisRun, error) {
	return s.updateCreditUsageStatus(ctx, runID, "completed")
}

func (s *Service) ReleaseCreditUsage(ctx context.Context, runID string) (AnalysisRun, error) {
	return s.updateCreditUsageStatus(ctx, runID, "failed")
}

func (s *Service) CompleteCreditUsageByRequest(ctx context.Context, projectID string, requestID string) (AnalysisRun, error) {
	run, err := s.creditUsageRunByRequest(ctx, projectID, requestID)
	if err != nil {
		return AnalysisRun{}, err
	}
	return s.CompleteCreditUsage(ctx, run.ID)
}

func (s *Service) ReleaseCreditUsageByRequest(ctx context.Context, projectID string, requestID string) (AnalysisRun, error) {
	run, err := s.creditUsageRunByRequest(ctx, projectID, requestID)
	if err != nil {
		return AnalysisRun{}, err
	}
	return s.ReleaseCreditUsage(ctx, run.ID)
}

func (s *Service) creditUsageRunByRequest(ctx context.Context, projectID string, requestID string) (AnalysisRun, error) {
	projectID = strings.TrimSpace(projectID)
	requestID = strings.TrimSpace(requestID)
	if projectID == "" || requestID == "" {
		return AnalysisRun{}, fmt.Errorf("%w: projectId and requestId are required", ErrValidation)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return AnalysisRun{}, err
	}
	runID := s.runByRequest[projectID+"|"+requestID]
	if strings.TrimSpace(runID) == "" {
		return AnalysisRun{}, fmt.Errorf("%w: run", ErrNotFound)
	}
	run := s.runs[runID]
	if run == nil {
		return AnalysisRun{}, fmt.Errorf("%w: run", ErrNotFound)
	}
	return copyAnalysisRun(run), nil
}

func (s *Service) updateCreditUsageStatus(ctx context.Context, runID string, status string) (AnalysisRun, error) {
	runID = strings.TrimSpace(runID)
	status = strings.TrimSpace(status)
	if runID == "" || status == "" {
		return AnalysisRun{}, fmt.Errorf("%w: runId and status are required", ErrValidation)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return AnalysisRun{}, err
	}
	run := s.runs[runID]
	if run == nil {
		return AnalysisRun{}, fmt.Errorf("%w: run", ErrNotFound)
	}

	backup := s.snapshotLocked()
	run.Status = status
	run.UpdatedAt = s.now().UTC()
	if err := s.persistLocked(ctx); err != nil {
		s.restoreLocked(backup)
		return AnalysisRun{}, err
	}
	return copyAnalysisRun(run), nil
}
