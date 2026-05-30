ALTER TABLE analysis_runs
  ADD COLUMN IF NOT EXISTS credits_count INTEGER NOT NULL DEFAULT 0;

UPDATE analysis_runs
SET credits_count = prompts_count
WHERE credits_count = 0;
