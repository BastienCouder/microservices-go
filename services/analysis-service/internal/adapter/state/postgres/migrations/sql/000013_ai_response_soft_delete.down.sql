DROP INDEX IF EXISTS ai_responses_deleted_at_idx;

ALTER TABLE ai_responses
  DROP COLUMN IF EXISTS deleted_at;
