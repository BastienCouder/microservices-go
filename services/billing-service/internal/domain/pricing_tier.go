package domain

import (
	"fmt"
	"time"
)

var ErrInvalidPricingTier = fmt.Errorf("invalid pricing tier")

type PricingTier struct {
	PromptVolume        int       `json:"prompt_volume"`
	Label               string    `json:"label"`
	Prices              map[string]*int `json:"prices"`
	DeveloperPriceCents *int      `json:"developer_price_cents"`
	StarterPriceCents   *int      `json:"starter_price_cents"`
	GrowthPriceCents    *int      `json:"growth_price_cents"`
	ProPriceCents       *int      `json:"pro_price_cents"`
	UpdatedAt           time.Time `json:"updated_at"`
}

func (p *PricingTier) Validate() error {
	p.syncPrices()
	if p.PromptVolume <= 0 {
		return fmt.Errorf("%w: prompt volume must be positive", ErrInvalidPricingTier)
	}
	if p.Label == "" {
		return fmt.Errorf("%w: label is required", ErrInvalidPricingTier)
	}
	for _, price := range p.Prices {
		if price != nil && *price < 0 {
			return fmt.Errorf("%w: price cannot be negative", ErrInvalidPricingTier)
		}
	}
	return nil
}

func (p *PricingTier) syncPrices() {
	normalized := make(map[string]*int, len(p.Prices)+4)
	for plan, price := range p.Prices {
		normalizedPlan := NormalizePlan(plan)
		if normalizedPlan == "" {
			continue
		}
		normalized[normalizedPlan] = cloneNullableInt(price)
	}
	mergeTierPrice(normalized, PlanDeveloper, p.DeveloperPriceCents)
	mergeTierPrice(normalized, PlanStarter, p.StarterPriceCents)
	mergeTierPrice(normalized, PlanGrowth, p.GrowthPriceCents)
	mergeTierPrice(normalized, PlanPro, p.ProPriceCents)
	p.Prices = normalized
	p.DeveloperPriceCents = cloneNullableInt(normalized[PlanDeveloper])
	p.StarterPriceCents = cloneNullableInt(normalized[PlanStarter])
	p.GrowthPriceCents = cloneNullableInt(normalized[PlanGrowth])
	p.ProPriceCents = cloneNullableInt(normalized[PlanPro])
}

func mergeTierPrice(prices map[string]*int, plan string, price *int) {
	if _, exists := prices[plan]; exists {
		return
	}
	if price != nil {
		prices[plan] = cloneNullableInt(price)
	}
}

func cloneNullableInt(value *int) *int {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}
