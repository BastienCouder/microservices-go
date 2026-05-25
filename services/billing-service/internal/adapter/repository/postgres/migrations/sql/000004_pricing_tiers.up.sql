CREATE TABLE IF NOT EXISTS billing_pricing_tiers (
  prompt_volume INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  developer_price_cents INTEGER,
  starter_price_cents INTEGER,
  growth_price_cents INTEGER,
  pro_price_cents INTEGER,
  updated_at TIMESTAMPTZ NOT NULL
);

INSERT INTO billing_plan_settings (
  plan,
  monthly_price_cents,
  yearly_price_cents,
  monthly_quota,
  model_selection_limit,
  monthly_model_change_limit,
  updated_at
)
VALUES
  ('developer', 2900, 0, 1000, 1, 0, NOW())
ON CONFLICT (plan) DO NOTHING;

INSERT INTO billing_pricing_tiers (
  prompt_volume,
  label,
  developer_price_cents,
  starter_price_cents,
  growth_price_cents,
  pro_price_cents,
  updated_at
)
VALUES
  (50, '50', 2900, 7900, 29900, 79900, NOW()),
  (100, '100', 4900, 14900, 34900, 84900, NOW()),
  (250, '250', 9900, 24900, 49900, 99900, NOW()),
  (500, '500', 14900, 39900, 59900, 119900, NOW()),
  (1000, '1k', 24900, NULL, 89900, 149900, NOW()),
  (5000, '5k+', NULL, NULL, NULL, NULL, NOW())
ON CONFLICT (prompt_volume) DO NOTHING;
