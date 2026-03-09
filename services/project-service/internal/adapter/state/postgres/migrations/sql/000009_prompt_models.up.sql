CREATE TABLE IF NOT EXISTS prompt_models (
  prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES ai_models(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (prompt_id, model_id)
);

CREATE INDEX IF NOT EXISTS prompt_models_prompt_id_idx ON prompt_models (prompt_id);

INSERT INTO prompt_models (prompt_id, model_id, created_at, updated_at)
SELECT
  prompts.id,
  project_models.model_id,
  NOW(),
  NOW()
FROM prompts
JOIN project_models
  ON project_models.project_id = prompts.project_id
 AND project_models.is_enabled = TRUE
ON CONFLICT (prompt_id, model_id) DO NOTHING;
