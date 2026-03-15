package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
)

func (s *StateStore) loadReports(ctx context.Context, state *persistedState) error {
	rows, err := s.db.Query(ctx, `
		SELECT id,
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
		FROM project_reports
		ORDER BY generated_at ASC, id ASC
	`)
	if err != nil {
		return fmt.Errorf("select project reports: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			item              usecase.ProjectReport
			whiteLabelRaw     []byte
			analyticsRaw      []byte
			pdfCiphertext     *string
			shareExpiresAt    *time.Time
			emailedAt         *time.Time
			emailedRecipients []byte
		)
		if err := rows.Scan(
			&item.ID,
			&item.ProjectID,
			&item.OrganizationID,
			&item.Title,
			&item.Template,
			&item.Locale,
			&item.Timezone,
			&item.Frequency,
			&item.Status,
			&item.PeriodLabel,
			&item.Summary,
			&whiteLabelRaw,
			&analyticsRaw,
			&pdfCiphertext,
			&item.LiveShareEnabled,
			&shareExpiresAt,
			&emailedAt,
			&emailedRecipients,
			&item.CreatedBy,
			&item.GeneratedAt,
			&item.UpdatedAt,
		); err != nil {
			return fmt.Errorf("scan project report: %w", err)
		}

		item.WhiteLabel, err = decodeWhiteLabelSettings(whiteLabelRaw)
		if err != nil {
			return fmt.Errorf("decode white label for report %s: %w", item.ID, err)
		}
		item.Analytics, err = decodeProjectReportAnalyticsData(analyticsRaw)
		if err != nil {
			return fmt.Errorf("decode analytics for report %s: %w", item.ID, err)
		}
		item.PDFBase64, err = s.codec.Decrypt(stringValue(pdfCiphertext))
		if err != nil {
			return fmt.Errorf("decrypt pdf for report %s: %w", item.ID, err)
		}
		item.EmailedRecipients, err = decodeStringList(emailedRecipients)
		if err != nil {
			return fmt.Errorf("decode emailed recipients for report %s: %w", item.ID, err)
		}
		item.ShareExpiresAt = timeValue(shareExpiresAt)
		item.EmailedAt = timeValue(emailedAt)

		report := item
		state.Reports[item.ID] = &report
	}
	return rows.Err()
}

func (s *StateStore) loadReportAuditEvents(ctx context.Context, state *persistedState) error {
	rows, err := s.db.Query(ctx, `
		SELECT id,
		       report_id,
		       project_id,
		       organization_id,
		       sort_order,
		       event_type,
		       recipient,
		       metadata,
		       occurred_at
		FROM project_report_audit_events
		ORDER BY report_id ASC, sort_order ASC, occurred_at ASC, id ASC
	`)
	if err != nil {
		return fmt.Errorf("select project report audit events: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			item      usecase.ReportAuditEvent
			sortOrder int
			recipient *string
			metadata  []byte
		)
		if err := rows.Scan(
			&item.ID,
			&item.ReportID,
			&item.ProjectID,
			&item.OrganizationID,
			&sortOrder,
			&item.EventType,
			&recipient,
			&metadata,
			&item.OccurredAt,
		); err != nil {
			return fmt.Errorf("scan project report audit event: %w", err)
		}
		item.Recipient = stringValue(recipient)
		item.Metadata, err = decodeStringAnyMap(metadata)
		if err != nil {
			return fmt.Errorf("decode metadata for report audit event %s: %w", item.ID, err)
		}

		event := item
		state.ReportAuditEvents[item.ID] = &event
		state.ReportAuditByReport[item.ReportID] = append(state.ReportAuditByReport[item.ReportID], item.ID)
	}
	return rows.Err()
}

func decodeProjectReportAnalyticsData(raw []byte) (usecase.ProjectReportAnalyticsData, error) {
	if len(raw) == 0 {
		return usecase.ProjectReportAnalyticsData{}, nil
	}
	var value usecase.ProjectReportAnalyticsData
	if err := json.Unmarshal(raw, &value); err != nil {
		return usecase.ProjectReportAnalyticsData{}, err
	}
	return value, nil
}

func encodeProjectReportAnalyticsData(value usecase.ProjectReportAnalyticsData) ([]byte, error) {
	return json.Marshal(value)
}

func decodeStringList(raw []byte) ([]string, error) {
	if len(raw) == 0 {
		return []string{}, nil
	}
	var values []string
	if err := json.Unmarshal(raw, &values); err != nil {
		return nil, err
	}
	return normalizeStringList(values), nil
}

func normalizeStringList(values []string) []string {
	if values == nil {
		return []string{}
	}
	return append([]string(nil), values...)
}

func decodeStringAnyMap(raw []byte) (map[string]any, error) {
	if len(raw) == 0 {
		return map[string]any{}, nil
	}
	var value map[string]any
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, err
	}
	return normalizeStringAnyMap(value), nil
}

func normalizeStringAnyMap(value map[string]any) map[string]any {
	if value == nil {
		return map[string]any{}
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return map[string]any{}
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		return map[string]any{}
	}
	return out
}
