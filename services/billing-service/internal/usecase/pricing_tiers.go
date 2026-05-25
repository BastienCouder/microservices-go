package usecase

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"
)

func priceCents(value int) *int {
	return &value
}

func defaultPricingTiers() []domain.PricingTier {
	now := time.Time{}
	return []domain.PricingTier{
		{PromptVolume: 50, Label: "50", DeveloperPriceCents: priceCents(2900), StarterPriceCents: priceCents(7900), GrowthPriceCents: priceCents(29900), ProPriceCents: priceCents(79900), UpdatedAt: now},
		{PromptVolume: 100, Label: "100", DeveloperPriceCents: priceCents(4900), StarterPriceCents: priceCents(14900), GrowthPriceCents: priceCents(34900), ProPriceCents: priceCents(84900), UpdatedAt: now},
		{PromptVolume: 250, Label: "250", DeveloperPriceCents: priceCents(9900), StarterPriceCents: priceCents(24900), GrowthPriceCents: priceCents(49900), ProPriceCents: priceCents(99900), UpdatedAt: now},
		{PromptVolume: 500, Label: "500", DeveloperPriceCents: priceCents(14900), StarterPriceCents: priceCents(39900), GrowthPriceCents: priceCents(59900), ProPriceCents: priceCents(119900), UpdatedAt: now},
		{PromptVolume: 1000, Label: "1k", DeveloperPriceCents: priceCents(24900), StarterPriceCents: nil, GrowthPriceCents: priceCents(89900), ProPriceCents: priceCents(149900), UpdatedAt: now},
		{PromptVolume: 5000, Label: "5k+", DeveloperPriceCents: nil, StarterPriceCents: nil, GrowthPriceCents: nil, ProPriceCents: nil, UpdatedAt: now},
	}
}

func defaultPricingTiersByVolume() map[int]domain.PricingTier {
	tiers := make(map[int]domain.PricingTier, len(defaultPricingTiers()))
	for _, tier := range defaultPricingTiers() {
		tiers[tier.PromptVolume] = tier
	}
	return tiers
}

func (s *Service) ListPricingTiers(ctx context.Context) ([]domain.PricingTier, error) {
	defaults := defaultPricingTiersByVolume()
	stored, err := s.repo.ListPricingTiers(ctx)
	if err != nil {
		return nil, fmt.Errorf("list pricing tiers: %w", err)
	}
	for _, tier := range stored {
		if tier.PromptVolume > 0 {
			defaults[tier.PromptVolume] = tier
		}
	}
	tiers := make([]domain.PricingTier, 0, len(defaults))
	for _, tier := range defaults {
		tiers = append(tiers, tier)
	}
	sort.SliceStable(tiers, func(left, right int) bool {
		return tiers[left].PromptVolume < tiers[right].PromptVolume
	})
	return tiers, nil
}

func (s *Service) UpdatePricingTier(ctx context.Context, tier domain.PricingTier) (domain.PricingTier, error) {
	if tier.UpdatedAt.IsZero() {
		tier.UpdatedAt = s.now().UTC()
	}
	if err := tier.Validate(); err != nil {
		return domain.PricingTier{}, err
	}
	if err := s.repo.UpsertPricingTier(ctx, tier); err != nil {
		return domain.PricingTier{}, fmt.Errorf("upsert pricing tier: %w", err)
	}
	return tier, nil
}
