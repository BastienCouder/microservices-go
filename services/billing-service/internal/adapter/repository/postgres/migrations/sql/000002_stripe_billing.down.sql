DROP TABLE IF EXISTS billing_stripe_webhook_events;

ALTER TABLE billing_subscriptions
  DROP COLUMN IF EXISTS correction_credits,
  DROP COLUMN IF EXISTS current_period_end,
  DROP COLUMN IF EXISTS cancel_at_period_end,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS billing_cycle,
  DROP COLUMN IF EXISTS stripe_price_id,
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS stripe_customer_id;
