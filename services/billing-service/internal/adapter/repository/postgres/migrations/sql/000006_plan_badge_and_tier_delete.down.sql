DROP INDEX IF EXISTS billing_plan_settings_one_most_chosen;

ALTER TABLE billing_pricing_tiers
DROP COLUMN IF EXISTS deleted;

ALTER TABLE billing_plan_settings
DROP COLUMN IF EXISTS is_most_chosen;
