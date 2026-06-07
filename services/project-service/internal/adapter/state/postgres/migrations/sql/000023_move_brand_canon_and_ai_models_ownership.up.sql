CREATE TABLE IF NOT EXISTS brand_canon (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  brand_name TEXT,
  category TEXT,
  positioning TEXT,
  audience JSONB NOT NULL DEFAULT '[]'::JSONB,
  use_cases JSONB NOT NULL DEFAULT '[]'::JSONB,
  features JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS brand_canon_updated_at_idx ON brand_canon (updated_at);

ALTER TABLE project_models
  DROP CONSTRAINT IF EXISTS project_models_model_id_fkey;

ALTER TABLE prompt_models
  DROP CONSTRAINT IF EXISTS prompt_models_model_id_fkey;

DROP TABLE IF EXISTS ai_models;
