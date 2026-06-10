DROP INDEX IF EXISTS prompt_model_schedules_prompt_id_idx;

DROP TABLE IF EXISTS prompt_model_schedules;

ALTER TABLE prompts
DROP COLUMN IF EXISTS schedule_timezone;

ALTER TABLE prompts
DROP COLUMN IF EXISTS schedule_cron;

ALTER TABLE prompts
DROP COLUMN IF EXISTS schedule_mode;
