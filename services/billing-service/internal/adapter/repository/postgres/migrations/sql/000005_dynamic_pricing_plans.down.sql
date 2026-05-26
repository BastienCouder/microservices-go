ALTER TABLE billing_pricing_tiers
DROP COLUMN IF EXISTS prices_json;

ALTER TABLE billing_plan_settings
DROP COLUMN IF EXISTS max_projects;
