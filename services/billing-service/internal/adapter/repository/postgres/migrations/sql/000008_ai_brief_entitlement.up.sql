ALTER TABLE billing_plan_settings
ADD COLUMN IF NOT EXISTS allow_ai_briefs BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE billing_plan_settings
SET allow_ai_briefs = TRUE
WHERE plan IN ('growth', 'pro');
