ALTER TABLE billing_plan_settings
ADD COLUMN IF NOT EXISTS is_most_chosen BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE billing_pricing_tiers
ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE billing_plan_settings
SET is_most_chosen = TRUE
WHERE plan = 'growth'
  AND NOT EXISTS (
    SELECT 1
    FROM billing_plan_settings
    WHERE is_most_chosen = TRUE
  );

CREATE UNIQUE INDEX IF NOT EXISTS billing_plan_settings_one_most_chosen
ON billing_plan_settings ((is_most_chosen))
WHERE is_most_chosen = TRUE;
