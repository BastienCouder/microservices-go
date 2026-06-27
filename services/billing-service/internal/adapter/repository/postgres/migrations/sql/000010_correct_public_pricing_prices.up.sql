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

INSERT INTO billing_pricing_tiers (
  prompt_volume,
  label,
  prices_json,
  developer_price_cents,
  starter_price_cents,
  growth_price_cents,
  pro_price_cents,
  deleted,
  updated_at
)
VALUES
  (100, 'Starter', '{"starter": 5900}'::jsonb, NULL, 5900, NULL, NULL, FALSE, NOW()),
  (750, 'Growth', '{"growth": 19900}'::jsonb, NULL, NULL, 19900, NULL, FALSE, NOW()),
  (3000, 'Agency', '{"pro": 49900}'::jsonb, NULL, NULL, NULL, 49900, FALSE, NOW())
ON CONFLICT (prompt_volume)
DO UPDATE SET
  label = EXCLUDED.label,
  prices_json = EXCLUDED.prices_json,
  developer_price_cents = EXCLUDED.developer_price_cents,
  starter_price_cents = EXCLUDED.starter_price_cents,
  growth_price_cents = EXCLUDED.growth_price_cents,
  pro_price_cents = EXCLUDED.pro_price_cents,
  deleted = FALSE,
  updated_at = EXCLUDED.updated_at;
