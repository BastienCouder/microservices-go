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
  monthly_quota = CASE plan
    WHEN 'starter' THEN 100
    WHEN 'growth' THEN 750
    WHEN 'pro' THEN 3000
    ELSE monthly_quota
  END,
  model_selection_limit = CASE plan
    WHEN 'starter' THEN 2
    WHEN 'growth' THEN 6
    WHEN 'pro' THEN 15
    ELSE model_selection_limit
  END,
  max_projects = CASE plan
    WHEN 'starter' THEN 1
    WHEN 'growth' THEN 5
    WHEN 'pro' THEN 20
    ELSE max_projects
  END,
  allow_ai_briefs = CASE plan
    WHEN 'starter' THEN FALSE
    WHEN 'growth' THEN TRUE
    WHEN 'pro' THEN TRUE
    ELSE allow_ai_briefs
  END,
  is_most_chosen = plan = 'growth',
  updated_at = NOW()
WHERE plan IN ('starter', 'growth', 'pro');

UPDATE billing_plan_settings
SET is_most_chosen = FALSE
WHERE plan <> 'growth';

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
  (3000, 'Agency', '{"pro": 49900}'::jsonb, NULL, NULL, NULL, 49900, FALSE, NOW()),
  (5000, 'Enterprise', '{}'::jsonb, NULL, NULL, NULL, NULL, FALSE, NOW())
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

UPDATE billing_pricing_tiers
SET
  prices_json = '{}'::jsonb,
  developer_price_cents = NULL,
  starter_price_cents = NULL,
  growth_price_cents = NULL,
  pro_price_cents = NULL,
  deleted = TRUE,
  updated_at = NOW()
WHERE prompt_volume NOT IN (100, 750, 3000, 5000);
