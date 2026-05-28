package usecase

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"
)

const (
	stripeCatalogCurrency = "eur"
	stripeCatalogInterval = "month"
)

var stripeProductIDSanitizer = regexp.MustCompile(`[^a-z0-9_]+`)

func (s *Service) SyncStripePricingCatalog(ctx context.Context, plan string) (StripePricingCatalogSyncResult, error) {
	if !s.stripeEnabled() {
		return StripePricingCatalogSyncResult{}, ErrStripeDisabled
	}
	selectedPlan := domain.NormalizePlan(plan)
	if selectedPlan == "" {
		return StripePricingCatalogSyncResult{}, fmt.Errorf("%w: plan is required", ErrStripeInvalidRequest)
	}

	plans, err := s.ListPlanSettings(ctx)
	if err != nil {
		return StripePricingCatalogSyncResult{}, fmt.Errorf("list plan settings for stripe catalog sync: %w", err)
	}
	tiers, err := s.ListPricingTiers(ctx)
	if err != nil {
		return StripePricingCatalogSyncResult{}, fmt.Errorf("list pricing tiers for stripe catalog sync: %w", err)
	}

	settingsByPlan := make(map[string]domain.PlanSettings, len(plans))
	for _, settings := range plans {
		settings.Plan = domain.NormalizePlan(settings.Plan)
		if settings.Plan == "" {
			continue
		}
		settingsByPlan[settings.Plan] = settings
	}
	for _, tier := range tiers {
		for plan, price := range tier.Prices {
			normalizedPlan := domain.NormalizePlan(plan)
			if normalizedPlan == "" || price == nil {
				continue
			}
			if _, exists := settingsByPlan[normalizedPlan]; !exists {
				settingsByPlan[normalizedPlan] = domain.PlanSettings{Plan: normalizedPlan}
			}
		}
	}

	if _, exists := settingsByPlan[selectedPlan]; !exists {
		return StripePricingCatalogSyncResult{}, fmt.Errorf("%w: plan is not configured", ErrStripeInvalidRequest)
	}
	planKeys := []string{selectedPlan}

	products := make([]StripePricingCatalogProduct, 0, len(planKeys))
	for _, plan := range planKeys {
		settings := settingsByPlan[plan]
		products = append(products, StripePricingCatalogProduct{
			ID:                      stripeCatalogProductID(plan),
			Plan:                    plan,
			Name:                    stripeCatalogProductName(plan),
			MonthlyQuota:            settings.MonthlyQuota,
			ModelSelectionLimit:     settings.ModelSelectionLimit,
			MonthlyModelChangeLimit: settings.MonthlyModelChangeLimit,
			MaxProjects:             settings.MaxProjects,
		})
	}

	prices := make([]StripePricingCatalogPrice, 0)
	for _, tier := range tiers {
		for _, plan := range planKeys {
			price := tier.Prices[plan]
			if price == nil {
				continue
			}
			settings := settingsByPlan[plan]
			prices = append(prices, StripePricingCatalogPrice{
				LookupKey:               stripeCatalogPriceLookupKey(plan, tier.PromptVolume),
				ProductID:               stripeCatalogProductID(plan),
				Plan:                    plan,
				TierLabel:               strings.TrimSpace(tier.Label),
				PromptVolume:            tier.PromptVolume,
				UnitAmountCents:         *price,
				Currency:                stripeCatalogCurrency,
				Interval:                stripeCatalogInterval,
				MonthlyQuota:            settings.MonthlyQuota,
				ModelSelectionLimit:     settings.ModelSelectionLimit,
				MonthlyModelChangeLimit: settings.MonthlyModelChangeLimit,
				MaxProjects:             settings.MaxProjects,
			})
		}
	}

	return s.stripe.SyncPricingCatalog(ctx, StripePricingCatalogSyncRequest{
		Products: products,
		Prices:   prices,
	})
}

func stripeCatalogProductID(plan string) string {
	normalized := domain.NormalizePlan(plan)
	safe := stripeProductIDSanitizer.ReplaceAllString(strings.ReplaceAll(normalized, "-", "_"), "_")
	safe = strings.Trim(safe, "_")
	if safe == "" {
		safe = "plan"
	}
	if len(safe) > 48 {
		sum := sha1.Sum([]byte(safe))
		safe = safe[:39] + "_" + hex.EncodeToString(sum[:])[:8]
	}
	return "prod_admin_pricing_" + safe
}

func stripeCatalogPriceLookupKey(plan string, promptVolume int) string {
	return fmt.Sprintf("admin-pricing:%s:%d:monthly", domain.NormalizePlan(plan), promptVolume)
}

func stripeCatalogProductName(plan string) string {
	switch domain.NormalizePlan(plan) {
	case domain.PlanDeveloper:
		return "Developer"
	case domain.PlanStarter:
		return "Starter"
	case domain.PlanGrowth:
		return "Growth"
	case domain.PlanPro:
		return "Pro"
	default:
		parts := strings.Fields(strings.ReplaceAll(domain.NormalizePlan(plan), "-", " "))
		for index, part := range parts {
			if part == "" {
				continue
			}
			parts[index] = strings.ToUpper(part[:1]) + part[1:]
		}
		if len(parts) == 0 {
			return "Custom plan"
		}
		return strings.Join(parts, " ")
	}
}
