CREATE TABLE IF NOT EXISTS billing_credit_cost_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE,
  default_credit_cost INTEGER NOT NULL,
  rules_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT billing_credit_cost_settings_singleton_true CHECK (singleton = TRUE),
  CONSTRAINT billing_credit_cost_settings_default_positive CHECK (default_credit_cost > 0)
);
