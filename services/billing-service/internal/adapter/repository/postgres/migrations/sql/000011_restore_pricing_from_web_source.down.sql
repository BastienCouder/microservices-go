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
  updated_at = NOW()
WHERE plan IN ('starter', 'growth', 'pro');

UPDATE billing_pricing_tiers
SET
  prices_json = CASE prompt_volume
    WHEN 100 THEN '{"starter": 4900}'::jsonb
    WHEN 750 THEN '{"growth": 14900}'::jsonb
    WHEN 3000 THEN '{"pro": 39900}'::jsonb
    ELSE prices_json
  END,
  starter_price_cents = CASE prompt_volume WHEN 100 THEN 4900 ELSE starter_price_cents END,
  growth_price_cents = CASE prompt_volume WHEN 750 THEN 14900 ELSE growth_price_cents END,
  pro_price_cents = CASE prompt_volume WHEN 3000 THEN 39900 ELSE pro_price_cents END,
  updated_at = NOW()
WHERE prompt_volume IN (100, 750, 3000);
