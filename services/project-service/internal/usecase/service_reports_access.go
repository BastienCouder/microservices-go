package usecase

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

func (s *Service) ResolveSharedProjectReport(ctx context.Context, token string) (ProjectReport, []ReportAuditEvent, ProjectReportShareLink, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.reloadLocked(ctx); err != nil {
		return ProjectReport{}, nil, ProjectReportShareLink{}, err
	}

	report, shareLink, err := s.resolveSharedProjectReportLocked(token)
	if err != nil {
		return ProjectReport{}, nil, ProjectReportShareLink{}, err
	}
	s.logReportEventLocked(report, ProjectReportEventOpened, "", map[string]any{"scope": "public"})
	if err := s.persistLocked(ctx); err != nil {
		return ProjectReport{}, nil, ProjectReportShareLink{}, err
	}
	return copyProjectReport(report), s.listReportAuditEventsLocked(report.ID), shareLink, nil
}

func (s *Service) GetSharedProjectReportPDF(ctx context.Context, token string) ([]byte, ProjectReport, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.reloadLocked(ctx); err != nil {
		return nil, ProjectReport{}, err
	}

	report, _, err := s.resolveSharedProjectReportLocked(token)
	if err != nil {
		return nil, ProjectReport{}, err
	}
	pdfBytes, err := decodeReportPDF(report.PDFBase64)
	if err != nil {
		return nil, ProjectReport{}, err
	}
	s.logReportEventLocked(report, ProjectReportEventPDFDownloaded, "", map[string]any{"scope": "public"})
	if err := s.persistLocked(ctx); err != nil {
		return nil, ProjectReport{}, err
	}
	return pdfBytes, copyProjectReport(report), nil
}

func (s *Service) resolveSharedProjectReportLocked(token string) (*ProjectReport, ProjectReportShareLink, error) {
	reportID, _, err := s.verifyReportShareToken(token)
	if err != nil {
		return nil, ProjectReportShareLink{}, err
	}
	report := s.reports[reportID]
	if report == nil {
		return nil, ProjectReportShareLink{}, fmt.Errorf("%w: report", ErrNotFound)
	}
	if !report.LiveShareEnabled {
		return nil, ProjectReportShareLink{}, fmt.Errorf("%w: live share disabled", ErrUnauthorized)
	}
	shareLink, err := s.buildProjectReportShareLinkLocked(report)
	if err != nil {
		return nil, ProjectReportShareLink{}, err
	}
	return report, shareLink, nil
}

func (s *Service) getProjectReportForOrganizationLocked(projectID, reportID string, organizationID int64) (*ProjectReport, error) {
	if _, err := s.getProjectForOrganizationLocked(projectID, organizationID); err != nil {
		return nil, err
	}
	reportID = strings.TrimSpace(reportID)
	if reportID == "" {
		return nil, fmt.Errorf("%w: reportId is required", ErrValidation)
	}
	report := s.reports[reportID]
	if report == nil {
		return nil, fmt.Errorf("%w: report", ErrNotFound)
	}
	if report.ProjectID != projectID || report.OrganizationID != organizationID {
		return nil, fmt.Errorf("%w: report access denied", ErrUnauthorized)
	}
	return report, nil
}

func (s *Service) buildProjectReportShareLinkLocked(report *ProjectReport) (ProjectReportShareLink, error) {
	token, err := s.buildReportShareToken(report)
	if err != nil {
		return ProjectReportShareLink{}, err
	}
	base := strings.TrimRight(strings.TrimSpace(s.reportsPublicBaseURL), "/")
	urlPath := "/reports/share/" + token
	url := urlPath
	pdfURL := urlPath + "/pdf"
	if base != "" {
		url = base + urlPath
		pdfURL = base + urlPath + "/pdf"
	}
	return ProjectReportShareLink{
		Token:     token,
		URL:       url,
		PDFURL:    pdfURL,
		ExpiresAt: report.ShareExpiresAt,
	}, nil
}

func (s *Service) logReportEventLocked(report *ProjectReport, eventType, recipient string, metadata map[string]any) {
	if report == nil {
		return
	}
	event := &ReportAuditEvent{
		ID:             s.nextID("rpe"),
		ReportID:       report.ID,
		ProjectID:      report.ProjectID,
		OrganizationID: report.OrganizationID,
		EventType:      eventType,
		Recipient:      strings.TrimSpace(recipient),
		Metadata:       copyStringAnyMap(metadata),
		OccurredAt:     s.now().UTC(),
	}
	s.reportAuditEvents[event.ID] = event
	s.reportAuditByReport[report.ID] = append(s.reportAuditByReport[report.ID], event.ID)
}

func (s *Service) listReportAuditEventsLocked(reportID string) []ReportAuditEvent {
	ids := nonNilStringSlice(s.reportAuditByReport[reportID])
	items := make([]ReportAuditEvent, 0, len(ids))
	for _, eventID := range ids {
		event := s.reportAuditEvents[eventID]
		if event == nil {
			continue
		}
		items = append(items, copyReportAuditEvent(event))
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].OccurredAt.Equal(items[j].OccurredAt) {
			return items[i].ID < items[j].ID
		}
		return items[i].OccurredAt.Before(items[j].OccurredAt)
	})
	return items
}
