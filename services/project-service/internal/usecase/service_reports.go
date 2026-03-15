package usecase

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"
)

func (s *Service) GenerateProjectReport(
	ctx context.Context,
	projectID string,
	organizationID int64,
	userID int64,
	input GenerateProjectReportInput,
) (ProjectReport, ProjectReportShareLink, error) {
	if userID <= 0 {
		return ProjectReport{}, ProjectReportShareLink{}, fmt.Errorf("%w: user id is required", ErrValidation)
	}
	if s.reportAnalyticsClient == nil {
		return ProjectReport{}, ProjectReportShareLink{}, fmt.Errorf("report analytics client is not configured")
	}

	s.mu.Lock()
	if err := s.reloadLocked(ctx); err != nil {
		s.mu.Unlock()
		return ProjectReport{}, ProjectReportShareLink{}, err
	}
	project, err := s.getProjectForOrganizationLocked(projectID, organizationID)
	if err != nil {
		s.mu.Unlock()
		return ProjectReport{}, ProjectReportShareLink{}, err
	}
	projectCopy := copyProject(project)
	s.mu.Unlock()

	analytics, err := s.reportAnalyticsClient.LoadProjectReportData(ctx, projectCopy.ID, organizationID, userID)
	if err != nil {
		return ProjectReport{}, ProjectReportShareLink{}, err
	}

	s.mu.Lock()
	reportID := s.nextID("rpt")
	s.mu.Unlock()

	now := s.now().UTC()
	report := ProjectReport{
		ID:               reportID,
		ProjectID:        projectCopy.ID,
		OrganizationID:   organizationID,
		Template:         normalizeProjectReportTemplate(input.Template, projectCopy.WhiteLabel.Reporting.Template),
		Locale:           normalizeProjectReportLocale("", projectCopy.WhiteLabel.Reporting.Locale),
		Timezone:         normalizeProjectReportTimezone("", projectCopy.WhiteLabel.Reporting.Timezone),
		Frequency:        normalizeProjectReportFrequency("", projectCopy.WhiteLabel.Reporting.Frequency),
		Status:           ProjectReportStatusReady,
		WhiteLabel:       copyWhiteLabelSettings(projectCopy.WhiteLabel),
		Analytics:        copyProjectReportAnalyticsData(analytics),
		LiveShareEnabled: projectCopy.WhiteLabel.Reporting.LiveShareEnabled,
		ShareExpiresAt:   now.Add(time.Duration(projectCopy.WhiteLabel.Reporting.ShareLinkTTLHours) * time.Hour),
		CreatedBy:        userID,
		GeneratedAt:      now,
		UpdatedAt:        now,
	}
	report.PeriodLabel = deriveProjectReportPeriodLabel(now, report.Timezone)
	report.Title = deriveProjectReportTitle(projectCopy, report.Template, report.PeriodLabel)
	report.Summary = deriveProjectReportSummary(projectCopy, report.Analytics)

	pdfBytes, err := buildProjectReportPDF(report)
	if err != nil {
		return ProjectReport{}, ProjectReportShareLink{}, fmt.Errorf("build report pdf: %w", err)
	}
	report.PDFBase64 = encodeReportPDF(pdfBytes)

	shareLink := ProjectReportShareLink{}
	if report.LiveShareEnabled {
		shareLink, err = s.buildProjectReportShareLinkLocked(&report)
		if err != nil {
			return ProjectReport{}, ProjectReportShareLink{}, err
		}
	}

	s.mu.Lock()
	if err := s.reloadLocked(ctx); err != nil {
		s.mu.Unlock()
		return ProjectReport{}, ProjectReportShareLink{}, err
	}
	project, err = s.getProjectForOrganizationLocked(projectID, organizationID)
	if err != nil {
		s.mu.Unlock()
		return ProjectReport{}, ProjectReportShareLink{}, err
	}
	if project.ID != report.ProjectID {
		s.mu.Unlock()
		return ProjectReport{}, ProjectReportShareLink{}, fmt.Errorf("%w: project mismatch", ErrUnauthorized)
	}

	report.WhiteLabel = copyWhiteLabelSettings(project.WhiteLabel)
	s.reports[report.ID] = &report
	s.logReportEventLocked(&report, ProjectReportEventGenerated, "", map[string]any{
		"template":  report.Template,
		"frequency": report.Frequency,
	})
	if err := s.persistLocked(ctx); err != nil {
		delete(s.reports, report.ID)
		s.mu.Unlock()
		return ProjectReport{}, ProjectReportShareLink{}, err
	}

	result := copyProjectReport(&report)
	s.mu.Unlock()

	if input.SendEmail {
		emailedReport, sendErr := s.SendProjectReport(ctx, projectID, organizationID, report.ID, input.Recipients)
		if sendErr != nil {
			return ProjectReport{}, ProjectReportShareLink{}, sendErr
		}
		result = emailedReport
	}
	return result, shareLink, nil
}

func (s *Service) ListProjectReports(ctx context.Context, projectID string, organizationID int64, limit int) ([]ProjectReport, error) {
	if limit <= 0 {
		limit = 20
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.reloadLocked(ctx); err != nil {
		return nil, err
	}
	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return nil, err
	}

	items := make([]ProjectReport, 0)
	for _, reportID := range sortedProjectReportIDs(s.reports) {
		report := s.reports[reportID]
		if report == nil || report.ProjectID != projectID || report.OrganizationID != organizationID {
			continue
		}
		items = append(items, copyProjectReport(report))
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].GeneratedAt.Equal(items[j].GeneratedAt) {
			return items[i].ID > items[j].ID
		}
		return items[i].GeneratedAt.After(items[j].GeneratedAt)
	})
	if len(items) > limit {
		items = items[:limit]
	}
	return items, nil
}

func (s *Service) GetProjectReport(ctx context.Context, projectID string, organizationID int64, reportID string) (ProjectReport, []ReportAuditEvent, ProjectReportShareLink, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.reloadLocked(ctx); err != nil {
		return ProjectReport{}, nil, ProjectReportShareLink{}, err
	}
	report, err := s.getProjectReportForOrganizationLocked(projectID, reportID, organizationID)
	if err != nil {
		return ProjectReport{}, nil, ProjectReportShareLink{}, err
	}

	shareLink := ProjectReportShareLink{}
	if report.LiveShareEnabled {
		shareLink, err = s.buildProjectReportShareLinkLocked(report)
		if err != nil {
			return ProjectReport{}, nil, ProjectReportShareLink{}, err
		}
	}
	return copyProjectReport(report), s.listReportAuditEventsLocked(report.ID), shareLink, nil
}

func (s *Service) CreateProjectReportShareLink(ctx context.Context, projectID string, organizationID int64, reportID string) (ProjectReportShareLink, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.reloadLocked(ctx); err != nil {
		return ProjectReportShareLink{}, err
	}
	report, err := s.getProjectReportForOrganizationLocked(projectID, reportID, organizationID)
	if err != nil {
		return ProjectReportShareLink{}, err
	}
	if !report.LiveShareEnabled {
		return ProjectReportShareLink{}, fmt.Errorf("%w: live share is disabled for this report", ErrValidation)
	}

	link, err := s.buildProjectReportShareLinkLocked(report)
	if err != nil {
		return ProjectReportShareLink{}, err
	}
	s.logReportEventLocked(report, ProjectReportEventShareCreated, "", map[string]any{
		"expiresAt": link.ExpiresAt,
		"url":       link.URL,
	})
	if err := s.persistLocked(ctx); err != nil {
		return ProjectReportShareLink{}, err
	}
	return link, nil
}

func (s *Service) SendProjectReport(ctx context.Context, projectID string, organizationID int64, reportID string, recipients []string) (ProjectReport, error) {
	if s.notificationClient == nil {
		return ProjectReport{}, fmt.Errorf("notification client is not configured")
	}

	s.mu.Lock()
	if err := s.reloadLocked(ctx); err != nil {
		s.mu.Unlock()
		return ProjectReport{}, err
	}
	report, err := s.getProjectReportForOrganizationLocked(projectID, reportID, organizationID)
	if err != nil {
		s.mu.Unlock()
		return ProjectReport{}, err
	}
	project, err := s.getProjectForOrganizationLocked(projectID, organizationID)
	if err != nil {
		s.mu.Unlock()
		return ProjectReport{}, err
	}
	targetRecipients := normalizeWhiteLabelRecipients(append(project.WhiteLabel.Reporting.Recipients, recipients...))
	if len(targetRecipients) == 0 {
		s.mu.Unlock()
		return ProjectReport{}, fmt.Errorf("%w: at least one recipient is required", ErrValidation)
	}
	shareLink := ProjectReportShareLink{}
	if report.LiveShareEnabled {
		shareLink, err = s.buildProjectReportShareLinkLocked(report)
		if err != nil {
			s.mu.Unlock()
			return ProjectReport{}, err
		}
	}
	subject := report.Title
	message := buildProjectReportEmail(copyProject(project), copyProjectReport(report), shareLink)
	s.mu.Unlock()

	for _, recipient := range targetRecipients {
		if err := s.notificationClient.SendEmail(ctx, NotificationEmailInput{
			Recipient: recipient,
			Subject:   subject,
			Message:   message,
		}); err != nil {
			return ProjectReport{}, err
		}
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.reloadLocked(ctx); err != nil {
		return ProjectReport{}, err
	}
	report, err = s.getProjectReportForOrganizationLocked(projectID, reportID, organizationID)
	if err != nil {
		return ProjectReport{}, err
	}
	report.EmailedAt = s.now().UTC()
	report.EmailedRecipients = normalizeWhiteLabelRecipients(append(report.EmailedRecipients, targetRecipients...))
	report.UpdatedAt = report.EmailedAt
	for _, recipient := range targetRecipients {
		s.logReportEventLocked(report, ProjectReportEventEmailed, recipient, map[string]any{
			"subject": subject,
		})
	}
	if err := s.persistLocked(ctx); err != nil {
		return ProjectReport{}, err
	}
	return copyProjectReport(report), nil
}

func (s *Service) GetProjectReportPDF(ctx context.Context, projectID string, organizationID int64, reportID string) ([]byte, ProjectReport, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.reloadLocked(ctx); err != nil {
		return nil, ProjectReport{}, err
	}
	report, err := s.getProjectReportForOrganizationLocked(projectID, reportID, organizationID)
	if err != nil {
		return nil, ProjectReport{}, err
	}
	pdfBytes, err := decodeReportPDF(report.PDFBase64)
	if err != nil {
		return nil, ProjectReport{}, err
	}
	s.logReportEventLocked(report, ProjectReportEventPDFDownloaded, "", map[string]any{"scope": "private"})
	if err := s.persistLocked(ctx); err != nil {
		return nil, ProjectReport{}, err
	}
	return pdfBytes, copyProjectReport(report), nil
}

func buildProjectReportEmail(project Project, report ProjectReport, shareLink ProjectReportShareLink) string {
	brandLabel := extractProjectBrandName(project)
	parts := []string{
		report.WhiteLabel.Branding.EmailFromName,
		"",
		"Your white-label report is ready.",
		"",
		"Report: " + report.Title,
		"Brand: " + brandLabel,
		"Summary: " + report.Summary,
	}
	if shareLink.URL != "" {
		parts = append(parts, "", "Live report: "+shareLink.URL, "PDF export: "+shareLink.PDFURL)
	}
	return strings.TrimSpace(strings.Join(parts, "\n"))
}
