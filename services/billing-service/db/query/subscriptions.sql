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

-- name: UpdateSubscriptionEntitlements :exec
INSERT INTO billing_subscriptions (
  organization_id,
  plan,
  seats,
  monthly_quota,
  updated_at
)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (organization_id)
DO UPDATE SET
  plan = EXCLUDED.plan,
  seats = EXCLUDED.seats,
  monthly_quota = EXCLUDED.monthly_quota,
  updated_at = EXCLUDED.updated_at;

-- name: UpdateDefaultQuotaForPlan :exec
UPDATE billing_subscriptions
SET
  monthly_quota = $3,
  updated_at = $4
WHERE plan = $1
  AND monthly_quota = $2;

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

-- name: ListBillingPlanSettings :many
SELECT
  plan,
  monthly_price_cents,
  yearly_price_cents,
  monthly_quota,
  model_selection_limit,
  monthly_model_change_limit,
  max_projects,
  updated_at
FROM billing_plan_settings
ORDER BY
  CASE plan
    WHEN 'starter' THEN 1
    WHEN 'growth' THEN 2
    WHEN 'pro' THEN 3
    ELSE 99
  END,
  plan;

-- name: UpsertBillingPlanSettings :exec
INSERT INTO billing_plan_settings (
  plan,
  monthly_price_cents,
  yearly_price_cents,
  monthly_quota,
  model_selection_limit,
  monthly_model_change_limit,
  max_projects,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (plan)
DO UPDATE SET
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  yearly_price_cents = EXCLUDED.yearly_price_cents,
  monthly_quota = EXCLUDED.monthly_quota,
  model_selection_limit = EXCLUDED.model_selection_limit,
  monthly_model_change_limit = EXCLUDED.monthly_model_change_limit,
  max_projects = EXCLUDED.max_projects,
  updated_at = EXCLUDED.updated_at;

-- name: ListBillingPricingTiers :many
SELECT
  prompt_volume,
  label,
  prices_json::text AS prices_json,
  developer_price_cents,
  starter_price_cents,
  growth_price_cents,
  pro_price_cents,
  updated_at
FROM billing_pricing_tiers
ORDER BY prompt_volume;

-- name: UpsertBillingPricingTier :exec
INSERT INTO billing_pricing_tiers (
  prompt_volume,
  label,
  prices_json,
  developer_price_cents,
  starter_price_cents,
  growth_price_cents,
  pro_price_cents,
  updated_at
)
VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8)
ON CONFLICT (prompt_volume)
DO UPDATE SET
  label = EXCLUDED.label,
  prices_json = EXCLUDED.prices_json,
  developer_price_cents = EXCLUDED.developer_price_cents,
  starter_price_cents = EXCLUDED.starter_price_cents,
  growth_price_cents = EXCLUDED.growth_price_cents,
  pro_price_cents = EXCLUDED.pro_price_cents,
  updated_at = EXCLUDED.updated_at;
