ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS status TEXT;

UPDATE prompts
SET status = CASE
  WHEN is_active THEN 'active'
  ELSE 'disabled'
END
WHERE status IS NULL OR btrim(status) = '';

ALTER TABLE prompts
ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE prompts
ALTER COLUMN status SET NOT NULL;

CREATE INDEX IF NOT EXISTS prompts_project_status_idx ON prompts (project_id, status);
