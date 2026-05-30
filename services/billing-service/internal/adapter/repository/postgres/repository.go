package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/adapter/repository/postgres/sqlc"
	"github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"
)

type Repository struct {
	db      *pgxpool.Pool
	queries *sqlc.Queries
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db, queries: sqlc.New(db)}
}

func (r *Repository) Upsert(ctx context.Context, subscription *domain.Subscription) error {
	err := r.queries.UpsertSubscription(ctx, sqlc.UpsertSubscriptionParams{
		OrganizationID:       subscription.OrganizationID,
		Plan:                 subscription.Plan,
		Seats:                int32(subscription.Seats),
		MonthlyQuota:         int32(subscription.MonthlyQuota),
		StripeCustomerID:     subscription.StripeCustomerID,
		StripeSubscriptionID: subscription.StripeSubscriptionID,
		StripePriceID:        subscription.StripePriceID,
		BillingCycle:         subscription.BillingCycle,
		Status:               subscription.Status,
		CancelAtPeriodEnd:    subscription.CancelAtPeriodEnd,
		CurrentPeriodEnd:     toPgNullableTimestamptz(subscription.CurrentPeriodEnd),
		CorrectionCredits:    int32(subscription.CorrectionCredits),
		UpdatedAt:            toPgTimestamptz(subscription.UpdatedAt),
	})
	if err != nil {
		return fmt.Errorf("upsert subscription: %w", err)
	}
	return nil
}

func (r *Repository) UpdateEntitlements(ctx context.Context, organizationID int64, plan string, seats, monthlyQuota int, updatedAt time.Time) error {
	err := r.queries.UpdateSubscriptionEntitlements(ctx, sqlc.UpdateSubscriptionEntitlementsParams{
		OrganizationID: organizationID,
		Plan:           plan,
		Seats:          int32(seats),
		MonthlyQuota:   int32(monthlyQuota),
		UpdatedAt:      toPgTimestamptz(updatedAt),
	})
	if err != nil {
		return fmt.Errorf("update subscription entitlements: %w", err)
	}
	return nil
}

func (r *Repository) UpdateDefaultQuotaForPlan(ctx context.Context, plan string, previousMonthlyQuota, nextMonthlyQuota int, updatedAt time.Time) error {
	err := r.queries.UpdateDefaultQuotaForPlan(ctx, sqlc.UpdateDefaultQuotaForPlanParams{
		Plan:                 plan,
		PreviousMonthlyQuota: int32(previousMonthlyQuota),
		NextMonthlyQuota:     int32(nextMonthlyQuota),
		UpdatedAt:            toPgTimestamptz(updatedAt),
	})
	if err != nil {
		return fmt.Errorf("update default quota for plan: %w", err)
	}
	return nil
}

func (r *Repository) GetByOrganizationID(ctx context.Context, organizationID int64) (*domain.Subscription, error) {
	sub, err := r.queries.GetSubscriptionByOrganizationID(ctx, organizationID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrSubscriptionMissing
		}
		return nil, fmt.Errorf("get subscription by organization id: %w", err)
	}

	return &domain.Subscription{
		OrganizationID:       sub.OrganizationID,
		Plan:                 sub.Plan,
		Seats:                int(sub.Seats),
		MonthlyQuota:         int(sub.MonthlyQuota),
		StripeCustomerID:     sub.StripeCustomerID,
		StripeSubscriptionID: sub.StripeSubscriptionID,
		StripePriceID:        sub.StripePriceID,
		BillingCycle:         sub.BillingCycle,
		Status:               sub.Status,
		CancelAtPeriodEnd:    sub.CancelAtPeriodEnd,
		CurrentPeriodEnd:     fromPgNullableTimestamptz(sub.CurrentPeriodEnd),
		CorrectionCredits:    int(sub.CorrectionCredits),
		UpdatedAt:            fromPgTimestamptz(sub.UpdatedAt),
	}, nil
}

func (r *Repository) ListPlanSettings(ctx context.Context) ([]domain.PlanSettings, error) {
	rows, err := r.db.Query(ctx, `
SELECT
  plan,
  monthly_price_cents,
  yearly_price_cents,
  monthly_quota,
  model_selection_limit,
  monthly_model_change_limit,
  max_projects,
  is_most_chosen,
  updated_at
FROM billing_plan_settings
ORDER BY
  CASE plan
    WHEN 'developer' THEN 0
    WHEN 'starter' THEN 1
    WHEN 'growth' THEN 2
    WHEN 'pro' THEN 3
    ELSE 99
  END,
  plan`)
	if err != nil {
		return nil, fmt.Errorf("list billing plan settings: %w", err)
	}
	defer rows.Close()

	settings := make([]domain.PlanSettings, 0)
	for rows.Next() {
		var item domain.PlanSettings
		if err := rows.Scan(
			&item.Plan,
			&item.MonthlyPriceCents,
			&item.YearlyPriceCents,
			&item.MonthlyQuota,
			&item.ModelSelectionLimit,
			&item.MonthlyModelChangeLimit,
			&item.MaxProjects,
			&item.IsMostChosen,
			&item.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan billing plan settings: %w", err)
		}
		settings = append(settings, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate billing plan settings: %w", err)
	}
	return settings, nil
}

func (r *Repository) UpsertPlanSettings(ctx context.Context, settings domain.PlanSettings) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin billing plan settings upsert: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	if settings.IsMostChosen {
		if _, err := tx.Exec(ctx, `UPDATE billing_plan_settings SET is_most_chosen = FALSE WHERE plan <> $1`, settings.Plan); err != nil {
			return fmt.Errorf("clear previous most chosen plan: %w", err)
		}
	}

	_, err = tx.Exec(ctx, `
INSERT INTO billing_plan_settings (
  plan,
  monthly_price_cents,
  yearly_price_cents,
  monthly_quota,
  model_selection_limit,
  monthly_model_change_limit,
  max_projects,
  is_most_chosen,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (plan)
DO UPDATE SET
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  yearly_price_cents = EXCLUDED.yearly_price_cents,
  monthly_quota = EXCLUDED.monthly_quota,
  model_selection_limit = EXCLUDED.model_selection_limit,
  monthly_model_change_limit = EXCLUDED.monthly_model_change_limit,
  max_projects = EXCLUDED.max_projects,
  is_most_chosen = EXCLUDED.is_most_chosen,
  updated_at = EXCLUDED.updated_at`,
		settings.Plan,
		settings.MonthlyPriceCents,
		settings.YearlyPriceCents,
		settings.MonthlyQuota,
		settings.ModelSelectionLimit,
		settings.MonthlyModelChangeLimit,
		settings.MaxProjects,
		settings.IsMostChosen,
		toPgTimestamptz(settings.UpdatedAt),
	)
	if err != nil {
		return fmt.Errorf("upsert billing plan settings: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit billing plan settings upsert: %w", err)
	}
	return nil
}

func (r *Repository) GetCreditCostSettings(ctx context.Context) (domain.CreditCostSettings, error) {
	row := r.db.QueryRow(ctx, `
SELECT default_credit_cost, rules_json::text AS rules_json, updated_at
FROM billing_credit_cost_settings
WHERE singleton = TRUE`)

	var (
		defaultCreditCost int
		rulesRaw          string
		updatedAt         pgtype.Timestamptz
	)
	if err := row.Scan(&defaultCreditCost, &rulesRaw, &updatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.CreditCostSettings{}, nil
		}
		return domain.CreditCostSettings{}, fmt.Errorf("get billing credit cost settings: %w", err)
	}
	rules, err := decodeCreditCostRules(rulesRaw)
	if err != nil {
		return domain.CreditCostSettings{}, fmt.Errorf("decode billing credit cost rules: %w", err)
	}
	settings := domain.CreditCostSettings{
		DefaultCreditCost: defaultCreditCost,
		Rules:             rules,
		UpdatedAt:         fromPgTimestamptz(updatedAt),
	}
	if err := settings.Validate(); err != nil {
		return domain.CreditCostSettings{}, fmt.Errorf("normalize billing credit cost settings: %w", err)
	}
	return settings, nil
}

func (r *Repository) UpsertCreditCostSettings(ctx context.Context, settings domain.CreditCostSettings) error {
	rulesJSON, err := encodeCreditCostRules(settings.Rules)
	if err != nil {
		return fmt.Errorf("encode billing credit cost rules: %w", err)
	}
	_, err = r.db.Exec(ctx, `
INSERT INTO billing_credit_cost_settings (
  singleton,
  default_credit_cost,
  rules_json,
  updated_at
)
VALUES (TRUE, $1, $2::jsonb, $3)
ON CONFLICT (singleton)
DO UPDATE SET
  default_credit_cost = EXCLUDED.default_credit_cost,
  rules_json = EXCLUDED.rules_json,
  updated_at = EXCLUDED.updated_at`,
		settings.DefaultCreditCost,
		rulesJSON,
		toPgTimestamptz(settings.UpdatedAt),
	)
	if err != nil {
		return fmt.Errorf("upsert billing credit cost settings: %w", err)
	}
	return nil
}

func (r *Repository) ListPricingTiers(ctx context.Context) ([]domain.PricingTier, error) {
	rows, err := r.db.Query(ctx, `
SELECT
  prompt_volume,
  label,
  prices_json::text AS prices_json,
  developer_price_cents,
  starter_price_cents,
  growth_price_cents,
  pro_price_cents,
  deleted,
  updated_at
FROM billing_pricing_tiers
ORDER BY prompt_volume`)
	if err != nil {
		return nil, fmt.Errorf("list billing pricing tiers: %w", err)
	}
	defer rows.Close()

	tiers := make([]domain.PricingTier, 0)
	for rows.Next() {
		var (
			promptVolume        int
			label               string
			pricesRaw           string
			developerPriceCents pgtype.Int4
			starterPriceCents   pgtype.Int4
			growthPriceCents    pgtype.Int4
			proPriceCents       pgtype.Int4
			deleted             bool
			updatedAt           pgtype.Timestamptz
		)
		if err := rows.Scan(
			&promptVolume,
			&label,
			&pricesRaw,
			&developerPriceCents,
			&starterPriceCents,
			&growthPriceCents,
			&proPriceCents,
			&deleted,
			&updatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan billing pricing tier: %w", err)
		}
		prices, err := decodePricingTierPrices(pricesRaw)
		if err != nil {
			return nil, fmt.Errorf("decode pricing tier prices: %w", err)
		}
		tier := domain.PricingTier{
			PromptVolume:        promptVolume,
			Label:               label,
			Prices:              prices,
			DeveloperPriceCents: fromPgNullableInt4(developerPriceCents),
			StarterPriceCents:   fromPgNullableInt4(starterPriceCents),
			GrowthPriceCents:    fromPgNullableInt4(growthPriceCents),
			ProPriceCents:       fromPgNullableInt4(proPriceCents),
			Deleted:             deleted,
			UpdatedAt:           fromPgTimestamptz(updatedAt),
		}
		if err := tier.Validate(); err != nil {
			return nil, fmt.Errorf("normalize pricing tier: %w", err)
		}
		tiers = append(tiers, tier)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate billing pricing tiers: %w", err)
	}
	return tiers, nil
}

func (r *Repository) UpsertPricingTier(ctx context.Context, tier domain.PricingTier) error {
	pricesJSON, err := encodePricingTierPrices(tier.Prices)
	if err != nil {
		return fmt.Errorf("encode pricing tier prices: %w", err)
	}
	_, err = r.db.Exec(ctx, `
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
VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, FALSE, $8)
ON CONFLICT (prompt_volume)
DO UPDATE SET
  label = EXCLUDED.label,
  prices_json = EXCLUDED.prices_json,
  developer_price_cents = EXCLUDED.developer_price_cents,
  starter_price_cents = EXCLUDED.starter_price_cents,
  growth_price_cents = EXCLUDED.growth_price_cents,
  pro_price_cents = EXCLUDED.pro_price_cents,
  deleted = FALSE,
  updated_at = EXCLUDED.updated_at`,
		tier.PromptVolume,
		tier.Label,
		pricesJSON,
		toPgNullableInt4(tier.DeveloperPriceCents),
		toPgNullableInt4(tier.StarterPriceCents),
		toPgNullableInt4(tier.GrowthPriceCents),
		toPgNullableInt4(tier.ProPriceCents),
		toPgTimestamptz(tier.UpdatedAt),
	)
	if err != nil {
		return fmt.Errorf("upsert billing pricing tier: %w", err)
	}
	return nil
}

func (r *Repository) DeletePricingTier(ctx context.Context, promptVolume int) error {
	rows, err := r.db.Exec(ctx, `
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
VALUES ($1, $2, '{}'::jsonb, NULL, NULL, NULL, NULL, TRUE, $3)
ON CONFLICT (prompt_volume)
DO UPDATE SET
  deleted = TRUE,
  prices_json = '{}'::jsonb,
  developer_price_cents = NULL,
  starter_price_cents = NULL,
  growth_price_cents = NULL,
  pro_price_cents = NULL,
  updated_at = EXCLUDED.updated_at`,
		promptVolume,
		fmt.Sprintf("%d", promptVolume),
		toPgTimestamptz(time.Now().UTC()),
	)
	if err != nil {
		return fmt.Errorf("delete billing pricing tier: %w", err)
	}
	if rows.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (r *Repository) RecordStripeWebhookEvent(ctx context.Context, eventID, eventType string, processedAt time.Time) (bool, error) {
	rowsAffected, err := r.queries.RecordStripeWebhookEvent(ctx, sqlc.RecordStripeWebhookEventParams{
		EventID:     eventID,
		EventType:   eventType,
		ProcessedAt: toPgTimestamptz(processedAt),
	})
	if err != nil {
		return false, fmt.Errorf("record stripe webhook event: %w", err)
	}
	return rowsAffected > 0, nil
}

func encodeCreditCostRules(rules []domain.CreditCostRule) (string, error) {
	if len(rules) == 0 {
		return "[]", nil
	}
	payload, err := json.Marshal(rules)
	if err != nil {
		return "", err
	}
	return string(payload), nil
}

func decodeCreditCostRules(raw string) ([]domain.CreditCostRule, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	var rules []domain.CreditCostRule
	if err := json.Unmarshal([]byte(raw), &rules); err != nil {
		return nil, err
	}
	return rules, nil
}

func toPgTimestamptz(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: value, Valid: true}
}

func fromPgTimestamptz(value pgtype.Timestamptz) time.Time {
	if !value.Valid {
		return time.Time{}
	}
	return value.Time
}

func toPgNullableTimestamptz(value *time.Time) pgtype.Timestamptz {
	if value == nil || value.IsZero() {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: value.UTC(), Valid: true}
}

func fromPgNullableTimestamptz(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	v := value.Time
	return &v
}

func toPgNullableInt4(value *int) pgtype.Int4 {
	if value == nil {
		return pgtype.Int4{}
	}
	return pgtype.Int4{Int32: int32(*value), Valid: true}
}

func fromPgNullableInt4(value pgtype.Int4) *int {
	if !value.Valid {
		return nil
	}
	v := int(value.Int32)
	return &v
}

func decodePricingTierPrices(raw string) (map[string]*int, error) {
	if raw == "" {
		return map[string]*int{}, nil
	}
	decoded := make(map[string]*int)
	if err := json.Unmarshal([]byte(raw), &decoded); err != nil {
		return nil, err
	}
	return decoded, nil
}

func encodePricingTierPrices(prices map[string]*int) (string, error) {
	if prices == nil {
		return "{}", nil
	}
	encoded, err := json.Marshal(prices)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}
