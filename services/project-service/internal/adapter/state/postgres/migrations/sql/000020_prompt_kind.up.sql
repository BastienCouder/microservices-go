ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'monitoring';

CREATE INDEX IF NOT EXISTS prompts_project_kind_idx ON prompts (project_id, kind);
