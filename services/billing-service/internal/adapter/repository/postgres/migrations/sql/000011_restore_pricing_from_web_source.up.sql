UPDATE billing_plan_settings
SET
  monthly_price_cents = CASE plan
    WHEN 'starter' THEN 5900
    WHEN 'growth' THEN 19900
    WHEN 'pro' THEN 49900
    ELSE monthly_price_cents
  END,
  yearly_price_cents = CASE plan
    WHEN 'starter' THEN 4900
    WHEN 'growth' THEN 15900
    WHEN 'pro' THEN 39900
    ELSE yearly_price_cents
  END,
  updated_at = NOW()
WHERE plan IN ('starter', 'growth', 'pro');

UPDATE billing_pricing_tiers
SET
  label = CASE prompt_volume
    WHEN 100 THEN 'Starter'
    WHEN 750 THEN 'Growth'
    WHEN 3000 THEN 'Agency'
    ELSE label
  END,
  prices_json = CASE prompt_volume
    WHEN 100 THEN '{"starter": 5900}'::jsonb
    WHEN 750 THEN '{"growth": 19900}'::jsonb
    WHEN 3000 THEN '{"pro": 49900}'::jsonb
    ELSE prices_json
  END,
  starter_price_cents = CASE prompt_volume WHEN 100 THEN 5900 ELSE starter_price_cents END,
  growth_price_cents = CASE prompt_volume WHEN 750 THEN 19900 ELSE growth_price_cents END,
  pro_price_cents = CASE prompt_volume WHEN 3000 THEN 49900 ELSE pro_price_cents END,
  deleted = FALSE,
  updated_at = NOW()
WHERE prompt_volume IN (100, 750, 3000);
