CREATE TABLE IF NOT EXISTS project_reports (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  template TEXT NOT NULL,
  locale TEXT NOT NULL,
  timezone TEXT NOT NULL,
  frequency TEXT NOT NULL,
  status TEXT NOT NULL,
  period_label TEXT NOT NULL,
  summary TEXT NOT NULL,
  white_label JSONB NOT NULL DEFAULT '{}'::jsonb,
  analytics_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_ciphertext TEXT,
  live_share_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  share_expires_at TIMESTAMPTZ,
  emailed_at TIMESTAMPTZ,
  emailed_recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by BIGINT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS project_reports_project_id_generated_at_idx
  ON project_reports (project_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS project_reports_organization_id_generated_at_idx
  ON project_reports (organization_id, generated_at DESC);

CREATE TABLE IF NOT EXISTS project_report_audit_events (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES project_reports(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id BIGINT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  event_type TEXT NOT NULL,
  recipient TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS project_report_audit_events_report_id_sort_order_idx
  ON project_report_audit_events (report_id, sort_order, occurred_at);

CREATE INDEX IF NOT EXISTS project_report_audit_events_project_id_occurred_at_idx
  ON project_report_audit_events (project_id, occurred_at DESC);
