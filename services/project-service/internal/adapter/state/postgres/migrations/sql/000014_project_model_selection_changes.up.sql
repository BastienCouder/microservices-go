CREATE TABLE IF NOT EXISTS project_model_selection_changes (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  usage_month TEXT NOT NULL,
  change_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_model_selection_changes_month_not_blank CHECK (btrim(usage_month) <> ''),
  CONSTRAINT project_model_selection_changes_count_non_negative CHECK (change_count >= 0)
);
