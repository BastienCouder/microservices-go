-- name: UpsertSubscription :exec
INSERT INTO billing_subscriptions (organization_id, plan, seats, monthly_quota, updated_at)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (organization_id)
DO UPDATE SET
  plan = EXCLUDED.plan,
  seats = EXCLUDED.seats,
  monthly_quota = EXCLUDED.monthly_quota,
  updated_at = EXCLUDED.updated_at;

-- name: GetSubscriptionByOrganizationID :one
SELECT organization_id, plan, seats, monthly_quota, updated_at
FROM billing_subscriptions
WHERE organization_id = $1;
