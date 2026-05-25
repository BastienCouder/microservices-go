DROP INDEX IF EXISTS prompts_project_kind_idx;

ALTER TABLE prompts
DROP COLUMN IF EXISTS kind;
