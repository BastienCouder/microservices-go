CREATE TABLE IF NOT EXISTS optimize_actions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  issue TEXT NOT NULL,
  impact TEXT,
  generated_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  source_error_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS optimize_actions_project_id_idx
  ON optimize_actions (project_id);

CREATE INDEX IF NOT EXISTS optimize_actions_status_idx
  ON optimize_actions (project_id, status);
