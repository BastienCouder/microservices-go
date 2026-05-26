ALTER TABLE billing_plan_settings
ADD COLUMN IF NOT EXISTS max_projects INTEGER NOT NULL DEFAULT 0;

UPDATE billing_plan_settings
SET max_projects = CASE plan
  WHEN 'developer' THEN 1
  WHEN 'starter' THEN 3
  WHEN 'growth' THEN 5
  WHEN 'pro' THEN 0
  ELSE max_projects
END;

ALTER TABLE billing_pricing_tiers
ADD COLUMN IF NOT EXISTS prices_json JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE billing_pricing_tiers
SET prices_json = jsonb_build_object(
  'developer', developer_price_cents,
  'starter', starter_price_cents,
  'growth', growth_price_cents,
  'pro', pro_price_cents
)
WHERE prices_json = '{}'::jsonb;
