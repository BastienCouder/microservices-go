package http

import (
	"html/template"
	"net/http"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/project-service/internal/usecase"
)

var sharedProjectReportTemplate = template.Must(template.New("shared-project-report").Parse(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{.Title}}</title>
  <style>
    :root {
      --primary: {{.PrimaryColor}};
      --secondary: {{.SecondaryColor}};
      --accent: {{.AccentColor}};
      --font: {{.FontFamily}};
      --border: rgba(15, 23, 42, 0.12);
      --text: #0f172a;
      --muted: #475569;
      --surface: rgba(255, 255, 255, 0.92);
      --background: linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(240,249,255,1) 100%);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--font), sans-serif;
      color: var(--text);
      background: var(--background);
    }
    .shell {
      max-width: 960px;
      margin: 0 auto;
      padding: 40px 20px 56px;
    }
    .hero, .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
      backdrop-filter: blur(20px);
    }
    .hero {
      padding: 28px;
      margin-bottom: 20px;
    }
    .eyebrow {
      color: var(--primary);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1 {
      margin: 12px 0 8px;
      font-size: clamp(30px, 5vw, 46px);
      line-height: 1.05;
    }
    .muted {
      color: var(--muted);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 20px;
    }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 18px;
      border-radius: 999px;
      text-decoration: none;
      font-weight: 700;
    }
    .button.primary {
      background: var(--primary);
      color: white;
    }
    .button.secondary {
      background: rgba(15, 23, 42, 0.06);
      color: var(--text);
    }
    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      margin-bottom: 20px;
    }
    .card {
      padding: 20px;
    }
    .metric {
      font-size: 32px;
      font-weight: 800;
      margin-top: 8px;
    }
    .label {
      color: var(--muted);
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .timeline {
      display: grid;
      gap: 12px;
      margin-top: 16px;
    }
    .timeline-item {
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.72);
      border: 1px solid rgba(15, 23, 42, 0.08);
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <div class="eyebrow">{{.PlatformName}}</div>
      <h1>{{.Title}}</h1>
      <p class="muted">{{.Summary}}</p>
      <p class="muted">Generated {{.GeneratedAt}} · Period {{.PeriodLabel}} · Share expires {{.ShareExpiresAt}}</p>
      <div class="actions">
        <a class="button primary" href="{{.PDFURL}}">Download PDF</a>
        <span class="button secondary">{{.BrandName}}</span>
      </div>
    </section>

    <section class="grid">
      <article class="card">
        <div class="label">Visibility score</div>
        <div class="metric">{{.VisibilityScore}} / 100</div>
      </article>
      <article class="card">
        <div class="label">Responses</div>
        <div class="metric">{{.CompletedResponses}} / {{.ExpectedResponses}}</div>
      </article>
      <article class="card">
        <div class="label">Positioning accuracy</div>
        <div class="metric">{{.PositioningAccuracy}}%</div>
      </article>
      <article class="card">
        <div class="label">Factual accuracy</div>
        <div class="metric">{{.FactualAccuracy}}%</div>
      </article>
    </section>

    <section class="card">
      <div class="label">Audit trail</div>
      <div class="timeline">
        {{range .AuditTrail}}
        <div class="timeline-item">
          <strong>{{.EventType}}</strong>
          <div class="muted">{{.OccurredAt}}{{if .Recipient}} · {{.Recipient}}{{end}}</div>
        </div>
        {{else}}
        <div class="timeline-item muted">No audit event yet.</div>
        {{end}}
      </div>
    </section>
  </main>
</body>
</html>`))

type sharedProjectReportView struct {
	Title               string
	PlatformName        string
	BrandName           string
	Summary             string
	PeriodLabel         string
	GeneratedAt         string
	ShareExpiresAt      string
	PDFURL              string
	PrimaryColor        string
	SecondaryColor      string
	AccentColor         string
	FontFamily          string
	VisibilityScore     int
	CompletedResponses  int
	ExpectedResponses   int
	PositioningAccuracy int
	FactualAccuracy     int
	AuditTrail          []sharedProjectReportAuditItem
}

type sharedProjectReportAuditItem struct {
	EventType  string
	Recipient  string
	OccurredAt string
}

func renderSharedProjectReportHTML(
	w http.ResponseWriter,
	report usecase.ProjectReport,
	auditTrail []usecase.ReportAuditEvent,
	shareLink usecase.ProjectReportShareLink,
) error {
	view := sharedProjectReportView{
		Title:               report.Title,
		PlatformName:        firstNonEmptyText(report.WhiteLabel.Branding.PlatformName, "Client Workspace"),
		BrandName:           firstNonEmptyText(getStringFromMap(report.Analytics.Perception, "brandCanon", "brandName"), "Client report"),
		Summary:             report.Summary,
		PeriodLabel:         report.PeriodLabel,
		GeneratedAt:         formatViewTime(report.GeneratedAt),
		ShareExpiresAt:      formatViewTime(report.ShareExpiresAt),
		PDFURL:              shareLink.PDFURL,
		PrimaryColor:        firstNonEmptyText(report.WhiteLabel.Branding.PrimaryColor, "#0f172a"),
		SecondaryColor:      firstNonEmptyText(report.WhiteLabel.Branding.SecondaryColor, "#e2e8f0"),
		AccentColor:         firstNonEmptyText(report.WhiteLabel.Branding.AccentColor, "#38bdf8"),
		FontFamily:          quoteFontFamily(firstNonEmptyText(report.WhiteLabel.Branding.FontFamily, "IBM Plex Sans")),
		VisibilityScore:     getIntFromMap(report.Analytics.Dashboard, "visibilityScore"),
		CompletedResponses:  getIntFromMap(getMapFromMap(report.Analytics.Dashboard, "latestRun"), "completedResponses"),
		ExpectedResponses:   getIntFromMap(getMapFromMap(report.Analytics.Dashboard, "latestRun"), "expectedResponses"),
		PositioningAccuracy: getIntFromMap(getMapFromMap(report.Analytics.Perception, "scores"), "positioningAccuracy"),
		FactualAccuracy:     getIntFromMap(getMapFromMap(report.Analytics.Perception, "scores"), "factualAccuracy"),
		AuditTrail:          make([]sharedProjectReportAuditItem, 0, len(auditTrail)),
	}
	for _, event := range auditTrail {
		view.AuditTrail = append(view.AuditTrail, sharedProjectReportAuditItem{
			EventType:  event.EventType,
			Recipient:  event.Recipient,
			OccurredAt: formatViewTime(event.OccurredAt),
		})
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	return sharedProjectReportTemplate.Execute(w, view)
}

func firstNonEmptyText(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func formatViewTime(value time.Time) string {
	if value.IsZero() {
		return "n/a"
	}
	return value.UTC().Format("2006-01-02 15:04 UTC")
}

func quoteFontFamily(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "sans-serif"
	}
	if strings.Contains(value, " ") {
		return "'" + strings.ReplaceAll(value, "'", "") + "'"
	}
	return value
}

func getMapFromMap(source map[string]any, key string) map[string]any {
	if source == nil {
		return map[string]any{}
	}
	value, ok := source[key]
	if !ok {
		return map[string]any{}
	}
	mapped, ok := value.(map[string]any)
	if !ok {
		return map[string]any{}
	}
	return mapped
}

func getStringFromMap(source map[string]any, keys ...string) string {
	current := source
	for index, key := range keys {
		if index == len(keys)-1 {
			value, ok := current[key]
			if !ok {
				return ""
			}
			text, ok := value.(string)
			if !ok {
				return ""
			}
			return strings.TrimSpace(text)
		}
		current = getMapFromMap(current, key)
	}
	return ""
}

func getIntFromMap(source map[string]any, key string) int {
	if source == nil {
		return 0
	}
	value, ok := source[key]
	if !ok {
		return 0
	}
	switch typed := value.(type) {
	case int:
		return typed
	case int32:
		return int(typed)
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	default:
		return 0
	}
}
