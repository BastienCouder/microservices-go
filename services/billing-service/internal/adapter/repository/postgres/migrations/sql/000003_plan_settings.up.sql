CREATE TABLE IF NOT EXISTS billing_plan_settings (
  plan TEXT PRIMARY KEY,
  monthly_price_cents INTEGER NOT NULL,
  yearly_price_cents INTEGER NOT NULL,
  monthly_quota INTEGER NOT NULL,
  model_selection_limit INTEGER NOT NULL,
  monthly_model_change_limit INTEGER NOT NULL,
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
  ('starter', 4900, 3900, 50, 3, 0, NOW()),
  ('growth', 14900, 11900, 200, 6, 0, NOW()),
  ('pro', 39900, 31900, 1000000, 0, 0, NOW())
ON CONFLICT (plan) DO NOTHING;
