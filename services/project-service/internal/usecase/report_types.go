package usecase

import (
	"context"
	"time"
)

const (
	ProjectReportStatusReady = "ready"

	ProjectReportEventGenerated     = "generated"
	ProjectReportEventShareCreated  = "share_created"
	ProjectReportEventEmailed       = "emailed"
	ProjectReportEventOpened        = "opened"
	ProjectReportEventPDFDownloaded = "pdf_downloaded"
)

type ProjectReportAnalyticsData struct {
	Dashboard  map[string]any `json:"dashboard"`
	Perception map[string]any `json:"perception"`
}

type ProjectReport struct {
	ID               string                    `json:"id"`
	ProjectID        string                    `json:"projectId"`
	OrganizationID   int64                     `json:"organizationId"`
	Title            string                    `json:"title"`
	Template         string                    `json:"template"`
	Locale           string                    `json:"locale"`
	Timezone         string                    `json:"timezone"`
	Frequency        string                    `json:"frequency"`
	Status           string                    `json:"status"`
	PeriodLabel      string                    `json:"periodLabel"`
	Summary          string                    `json:"summary"`
	WhiteLabel       WhiteLabelSettings        `json:"whiteLabel"`
	Analytics        ProjectReportAnalyticsData `json:"analytics"`
	PDFBase64        string                    `json:"-"`
	LiveShareEnabled bool                      `json:"liveShareEnabled"`
	ShareExpiresAt   time.Time                 `json:"shareExpiresAt,omitempty"`
	EmailedAt        time.Time                 `json:"emailedAt,omitempty"`
	EmailedRecipients []string                 `json:"emailedRecipients,omitempty"`
	CreatedBy        int64                     `json:"createdBy"`
	GeneratedAt      time.Time                 `json:"generatedAt"`
	UpdatedAt        time.Time                 `json:"updatedAt"`
}

type ReportAuditEvent struct {
	ID             string         `json:"id"`
	ReportID       string         `json:"reportId"`
	ProjectID      string         `json:"projectId"`
	OrganizationID int64          `json:"organizationId"`
	EventType      string         `json:"eventType"`
	Recipient      string         `json:"recipient,omitempty"`
	Metadata       map[string]any `json:"metadata,omitempty"`
	OccurredAt     time.Time      `json:"occurredAt"`
}

type GenerateProjectReportInput struct {
	Template   string
	Recipients []string
	SendEmail  bool
}

type ProjectReportShareLink struct {
	Token     string    `json:"token"`
	URL       string    `json:"url"`
	PDFURL    string    `json:"pdfUrl"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type NotificationEmailInput struct {
	Recipient string
	Subject   string
	Message   string
}

type ReportAnalyticsClient interface {
	LoadProjectReportData(ctx context.Context, projectID string, organizationID, userID int64) (ProjectReportAnalyticsData, error)
}

type NotificationClient interface {
	SendEmail(ctx context.Context, input NotificationEmailInput) error
}

func copyProjectReport(value *ProjectReport) ProjectReport {
	if value == nil {
		return ProjectReport{}
	}
	out := *value
	out.WhiteLabel = copyWhiteLabelSettings(value.WhiteLabel)
	out.Analytics = copyProjectReportAnalyticsData(value.Analytics)
	out.EmailedRecipients = nonNilStringSlice(value.EmailedRecipients)
	return out
}

func copyProjectReportAnalyticsData(value ProjectReportAnalyticsData) ProjectReportAnalyticsData {
	return ProjectReportAnalyticsData{
		Dashboard:  copyStringAnyMap(value.Dashboard),
		Perception: copyStringAnyMap(value.Perception),
	}
}

func copyReportAuditEvent(value *ReportAuditEvent) ReportAuditEvent {
	if value == nil {
		return ReportAuditEvent{}
	}
	out := *value
	out.Metadata = copyStringAnyMap(value.Metadata)
	return out
}

func copyStringAnyMap(input map[string]any) map[string]any {
	if input == nil {
		return map[string]any{}
	}
	raw, err := jsonMarshal(input)
	if err != nil {
		return map[string]any{}
	}
	var out map[string]any
	if err := jsonUnmarshal(raw, &out); err != nil {
		return map[string]any{}
	}
	return out
}
