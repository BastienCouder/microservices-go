-- name: UpsertSubscription :exec
INSERT INTO billing_subscriptions (
  organization_id,
  plan,
  seats,
  monthly_quota,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_price_id,
  billing_cycle,
  status,
  cancel_at_period_end,
  current_period_end,
  correction_credits,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
ON CONFLICT (organization_id)
DO UPDATE SET
  plan = EXCLUDED.plan,
  seats = EXCLUDED.seats,
  monthly_quota = EXCLUDED.monthly_quota,
  stripe_customer_id = EXCLUDED.stripe_customer_id,
  stripe_subscription_id = EXCLUDED.stripe_subscription_id,
  stripe_price_id = EXCLUDED.stripe_price_id,
  billing_cycle = EXCLUDED.billing_cycle,
  status = EXCLUDED.status,
  cancel_at_period_end = EXCLUDED.cancel_at_period_end,
  current_period_end = EXCLUDED.current_period_end,
  correction_credits = EXCLUDED.correction_credits,
  updated_at = EXCLUDED.updated_at;

-- name: GetSubscriptionByOrganizationID :one
SELECT
  organization_id,
  plan,
  seats,
  monthly_quota,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_price_id,
  billing_cycle,
  status,
  cancel_at_period_end,
  current_period_end,
  correction_credits,
  updated_at
FROM billing_subscriptions
WHERE organization_id = $1;

-- name: RecordStripeWebhookEvent :execrows
INSERT INTO billing_stripe_webhook_events (event_id, event_type, processed_at)
VALUES ($1, $2, $3)
ON CONFLICT (event_id) DO NOTHING;
