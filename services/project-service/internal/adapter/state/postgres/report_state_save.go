package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/jackc/pgx/v5"

	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
)

func (s *StateStore) insertProjectReports(ctx context.Context, tx pgx.Tx, reports map[string]*usecase.ProjectReport) error {
	for _, reportID := range sortedReportIDs(reports) {
		report := reports[reportID]
		if report == nil {
			continue
		}

		whiteLabelJSON, err := encodeWhiteLabelSettings(report.WhiteLabel)
		if err != nil {
			return fmt.Errorf("encode white label for report %s: %w", report.ID, err)
		}
		analyticsJSON, err := encodeProjectReportAnalyticsData(report.Analytics)
		if err != nil {
			return fmt.Errorf("encode analytics for report %s: %w", report.ID, err)
		}
		pdfCiphertext, err := s.codec.Encrypt(report.PDFBase64)
		if err != nil {
			return fmt.Errorf("encrypt pdf for report %s: %w", report.ID, err)
		}
		emailedRecipientsJSON, err := json.Marshal(normalizeStringList(report.EmailedRecipients))
		if err != nil {
			return fmt.Errorf("encode emailed recipients for report %s: %w", report.ID, err)
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO project_reports (
				id,
				project_id,
				organization_id,
				title,
				template,
				locale,
				timezone,
				frequency,
				status,
				period_label,
				summary,
				white_label,
				analytics_payload,
				pdf_ciphertext,
				live_share_enabled,
				share_expires_at,
				emailed_at,
				emailed_recipients,
				created_by,
				generated_at,
				updated_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14, $15, $16, $17, $18::jsonb, $19, $20, $21)
		`,
			report.ID,
			report.ProjectID,
			report.OrganizationID,
			report.Title,
			report.Template,
			report.Locale,
			report.Timezone,
			report.Frequency,
			report.Status,
			report.PeriodLabel,
			report.Summary,
			whiteLabelJSON,
			analyticsJSON,
			nullIfEmpty(pdfCiphertext),
			report.LiveShareEnabled,
			nullIfZeroTime(report.ShareExpiresAt),
			nullIfZeroTime(report.EmailedAt),
			emailedRecipientsJSON,
			report.CreatedBy,
			report.GeneratedAt,
			report.UpdatedAt,
		); err != nil {
			return fmt.Errorf("insert project report %s: %w", report.ID, err)
		}
	}
	return nil
}

func insertReportAuditEvents(
	ctx context.Context,
	tx pgx.Tx,
	events map[string]*usecase.ReportAuditEvent,
	order map[string][]string,
) error {
	reportIDs := orderedAuditReportIDs(events, order)
	for _, reportID := range reportIDs {
		eventIDs := orderedAuditEventIDsForReport(reportID, events, order[reportID])
		for index, eventID := range eventIDs {
			event := events[eventID]
			if event == nil {
				continue
			}
			metadataJSON, err := json.Marshal(normalizeStringAnyMap(event.Metadata))
			if err != nil {
				return fmt.Errorf("encode metadata for report audit event %s: %w", event.ID, err)
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO project_report_audit_events (
					id,
					report_id,
					project_id,
					organization_id,
					sort_order,
					event_type,
					recipient,
					metadata,
					occurred_at
				)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
			`,
				event.ID,
				event.ReportID,
				event.ProjectID,
				event.OrganizationID,
				index,
				event.EventType,
				nullIfEmpty(event.Recipient),
				metadataJSON,
				event.OccurredAt,
			); err != nil {
				return fmt.Errorf("insert project report audit event %s: %w", event.ID, err)
			}
		}
	}
	return nil
}

func sortedReportIDs(items map[string]*usecase.ProjectReport) []string {
	ids := make([]string, 0, len(items))
	for id := range items {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func orderedAuditReportIDs(
	events map[string]*usecase.ReportAuditEvent,
	order map[string][]string,
) []string {
	seen := make(map[string]struct{}, len(order))
	reportIDs := make([]string, 0, len(order))
	for reportID := range order {
		reportIDs = append(reportIDs, reportID)
		seen[reportID] = struct{}{}
	}
	for _, event := range events {
		if event == nil {
			continue
		}
		if _, ok := seen[event.ReportID]; ok {
			continue
		}
		reportIDs = append(reportIDs, event.ReportID)
		seen[event.ReportID] = struct{}{}
	}
	sort.Strings(reportIDs)
	return reportIDs
}

func orderedAuditEventIDsForReport(
	reportID string,
	events map[string]*usecase.ReportAuditEvent,
	ordered []string,
) []string {
	seen := make(map[string]struct{}, len(ordered))
	out := make([]string, 0, len(ordered))
	for _, eventID := range ordered {
		event := events[eventID]
		if event == nil || event.ReportID != reportID {
			continue
		}
		out = append(out, eventID)
		seen[eventID] = struct{}{}
	}

	extras := make([]string, 0)
	for eventID, event := range events {
		if event == nil || event.ReportID != reportID {
			continue
		}
		if _, ok := seen[eventID]; ok {
			continue
		}
		extras = append(extras, eventID)
	}
	sort.Strings(extras)
	return append(out, extras...)
}
