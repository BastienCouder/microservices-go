CREATE TABLE IF NOT EXISTS billing_subscriptions (
  organization_id BIGINT PRIMARY KEY,
  plan TEXT NOT NULL,
  seats INTEGER NOT NULL,
  monthly_quota INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
