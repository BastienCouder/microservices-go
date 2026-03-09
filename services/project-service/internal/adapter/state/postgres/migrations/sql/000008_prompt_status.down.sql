DROP INDEX IF EXISTS prompts_project_status_idx;

ALTER TABLE prompts
DROP COLUMN IF EXISTS status;
