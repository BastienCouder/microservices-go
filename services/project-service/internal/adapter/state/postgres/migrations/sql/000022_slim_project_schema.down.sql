ALTER TABLE project_model_selection_changes
  DROP CONSTRAINT IF EXISTS project_model_selection_changes_pkey;

ALTER TABLE project_model_selection_changes
  ADD PRIMARY KEY (project_id);

CREATE TABLE IF NOT EXISTS project_service_meta (
  id SMALLINT PRIMARY KEY,
  seq BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_service_meta_singleton CHECK (id = 1)
);

INSERT INTO project_service_meta (id, seq, updated_at)
VALUES (1, 0, NOW())
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS prompt_model_schedules (
  prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES ai_models(id) ON DELETE RESTRICT,
  cron_expr TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (prompt_id, model_id)
);

CREATE INDEX IF NOT EXISTS prompt_model_schedules_prompt_id_idx
  ON prompt_model_schedules (prompt_id);

CREATE TABLE IF NOT EXISTS project_llm_provider_credentials (
  project_id TEXT NOT NULL,
  organization_id BIGINT NOT NULL,
  provider TEXT NOT NULL,
  api_key_ciphertext TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, provider),
  CONSTRAINT project_llm_provider_credentials_project_fk
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS project_llm_provider_credentials_org_idx
  ON project_llm_provider_credentials (organization_id);

CREATE INDEX IF NOT EXISTS project_llm_provider_credentials_project_idx
  ON project_llm_provider_credentials (project_id);
