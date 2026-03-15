package usecase

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"
)

type scheduledProjectReportCandidate struct {
	ProjectID      string
	OrganizationID int64
	UserID         int64
	Template       string
	Recipients     []string
}

func (s *Service) RunScheduledProjectReports(ctx context.Context, limit int) (runErr error) {
	if s.reportAnalyticsClient == nil {
		return nil
	}
	if limit <= 0 {
		limit = 25
	}
	if s.store != nil {
		lease, acquired, err := s.store.TryAcquireSchedulerLease(ctx, "project-service:scheduled-project-reports")
		if err != nil {
			return err
		}
		if !acquired {
			return nil
		}
		defer func() {
			releaseCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := lease.Release(releaseCtx); err != nil && runErr == nil {
				runErr = err
			}
		}()
	}

	now := s.now().UTC()
	candidates, err := s.collectScheduledProjectReportCandidates(ctx, now, limit)
	if err != nil {
		return err
	}

	var firstErr error
	for _, candidate := range candidates {
		sendEmail := s.notificationClient != nil && len(candidate.Recipients) > 0
		if _, _, err := s.GenerateProjectReport(ctx, candidate.ProjectID, candidate.OrganizationID, candidate.UserID, GenerateProjectReportInput{
			Template:   candidate.Template,
			Recipients: candidate.Recipients,
			SendEmail:  sendEmail,
		}); err != nil && firstErr == nil {
			firstErr = fmt.Errorf("generate scheduled report for project %s: %w", candidate.ProjectID, err)
		}
	}
	return firstErr
}

func (s *Service) collectScheduledProjectReportCandidates(
	ctx context.Context,
	now time.Time,
	limit int,
) ([]scheduledProjectReportCandidate, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}

	projectIDs := make([]string, 0, len(s.projects))
	for projectID := range s.projects {
		projectIDs = append(projectIDs, projectID)
	}
	sort.Strings(projectIDs)

	candidates := make([]scheduledProjectReportCandidate, 0, limit)
	for _, projectID := range projectIDs {
		project := s.projects[projectID]
		if project == nil || !isProjectEligibleForScheduledReports(project) {
			continue
		}
		frequency := normalizeProjectReportFrequency("", project.WhiteLabel.Reporting.Frequency)
		periodKey := deriveProjectReportPeriodKey(now, project.WhiteLabel.Reporting.Timezone, frequency)
		if s.hasProjectReportForPeriodLocked(project.ID, project.OrganizationID, frequency, periodKey) {
			continue
		}

		candidates = append(candidates, scheduledProjectReportCandidate{
			ProjectID:      project.ID,
			OrganizationID: project.OrganizationID,
			UserID:         project.CreatedBy,
			Template:       project.WhiteLabel.Reporting.Template,
			Recipients:     normalizeWhiteLabelRecipients(project.WhiteLabel.Reporting.Recipients),
		})
		if len(candidates) >= limit {
			break
		}
	}
	return candidates, nil
}

func (s *Service) hasProjectReportForPeriodLocked(
	projectID string,
	organizationID int64,
	frequency, periodKey string,
) bool {
	for _, report := range s.reports {
		if report == nil {
			continue
		}
		if report.ProjectID != projectID || report.OrganizationID != organizationID {
			continue
		}
		if normalizeProjectReportFrequency("", report.Frequency) != frequency {
			continue
		}
		if deriveProjectReportPeriodKey(report.GeneratedAt, report.Timezone, report.Frequency) == periodKey {
			return true
		}
	}
	return false
}

func isProjectEligibleForScheduledReports(project *Project) bool {
	if project == nil {
		return false
	}
	if project.OrganizationID <= 0 || project.CreatedBy <= 0 {
		return false
	}
	if !strings.EqualFold(strings.TrimSpace(project.Status), "active") {
		return false
	}
	return true
}
