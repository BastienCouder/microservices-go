ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS schedule_mode TEXT;

ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS schedule_cron TEXT;

ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS schedule_timezone TEXT;

UPDATE prompts
SET schedule_mode = COALESCE(NULLIF(schedule_mode, ''), 'global'),
    schedule_cron = COALESCE(NULLIF(schedule_cron, ''), '0 */6 * * *'),
    schedule_timezone = COALESCE(NULLIF(schedule_timezone, ''), 'UTC');

ALTER TABLE prompts
ALTER COLUMN schedule_mode SET DEFAULT 'global';

ALTER TABLE prompts
ALTER COLUMN schedule_cron SET DEFAULT '0 */6 * * *';

ALTER TABLE prompts
ALTER COLUMN schedule_timezone SET DEFAULT 'UTC';

ALTER TABLE prompts
ALTER COLUMN schedule_mode SET NOT NULL;

ALTER TABLE prompts
ALTER COLUMN schedule_cron SET NOT NULL;

ALTER TABLE prompts
ALTER COLUMN schedule_timezone SET NOT NULL;

CREATE TABLE IF NOT EXISTS prompt_model_schedules (
  prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES ai_models(id) ON DELETE RESTRICT,
  cron_expr TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (prompt_id, model_id)
);

CREATE INDEX IF NOT EXISTS prompt_model_schedules_prompt_id_idx ON prompt_model_schedules (prompt_id);
