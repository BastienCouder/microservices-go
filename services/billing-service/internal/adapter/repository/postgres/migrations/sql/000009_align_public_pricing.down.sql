UPDATE billing_plan_settings
SET
  monthly_price_cents = CASE plan
    WHEN 'starter' THEN 4900
    WHEN 'growth' THEN 14900
    WHEN 'pro' THEN 39900
    ELSE monthly_price_cents
  END,
  yearly_price_cents = CASE plan
    WHEN 'starter' THEN 3900
    WHEN 'growth' THEN 11900
    WHEN 'pro' THEN 31900
    ELSE yearly_price_cents
  END,
  monthly_quota = CASE plan
    WHEN 'starter' THEN 50
    WHEN 'growth' THEN 200
    WHEN 'pro' THEN 1000000
    ELSE monthly_quota
  END,
  model_selection_limit = CASE plan
    WHEN 'starter' THEN 3
    WHEN 'growth' THEN 6
    WHEN 'pro' THEN 0
    ELSE model_selection_limit
  END,
  max_projects = CASE plan
    WHEN 'starter' THEN 3
    WHEN 'growth' THEN 5
    WHEN 'pro' THEN 0
    ELSE max_projects
  END,
  updated_at = NOW()
WHERE plan IN ('starter', 'growth', 'pro');

UPDATE billing_pricing_tiers
SET deleted = FALSE, updated_at = NOW()
WHERE prompt_volume IN (50, 100, 250, 500, 1000, 5000);
