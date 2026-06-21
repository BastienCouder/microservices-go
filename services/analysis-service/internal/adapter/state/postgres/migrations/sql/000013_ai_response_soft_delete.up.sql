ALTER TABLE ai_responses
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ai_responses_deleted_at_idx
  ON ai_responses (deleted_at);
