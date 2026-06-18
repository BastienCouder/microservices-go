CREATE TABLE IF NOT EXISTS project_ai_brief_settings (
  project_id TEXT PRIMARY KEY,
  brief_model_id TEXT NOT NULL,
  brief_provider TEXT NOT NULL DEFAULT 'openrouter',
  brief_provider_model_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_ai_brief_settings_model_not_blank CHECK (btrim(brief_model_id) <> ''),
  CONSTRAINT project_ai_brief_settings_provider_not_blank CHECK (btrim(brief_provider) <> ''),
  CONSTRAINT project_ai_brief_settings_provider_model_not_blank CHECK (btrim(brief_provider_model_id) <> '')
);
