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
	tiers := []domain.PricingTier{
		{PromptVolume: 100, Label: "Starter", Prices: map[string]*int{domain.PlanStarter: priceCents(5900)}, UpdatedAt: now},
		{PromptVolume: 750, Label: "Growth", Prices: map[string]*int{domain.PlanGrowth: priceCents(19900)}, UpdatedAt: now},
		{PromptVolume: 3000, Label: "Agency", Prices: map[string]*int{domain.PlanPro: priceCents(49900)}, UpdatedAt: now},
		{PromptVolume: 5000, Label: "Enterprise", Prices: map[string]*int{}, UpdatedAt: now},
	}
	for index := range tiers {
		_ = tiers[index].Validate()
	}
	return tiers
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
			if tier.Deleted {
				delete(defaults, tier.PromptVolume)
				continue
			}
			tier.CreditVolume = tier.PromptVolume
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

func (s *Service) DeletePricingTier(ctx context.Context, promptVolume int) error {
	if promptVolume <= 0 {
		return fmt.Errorf("%w: credit volume must be positive", domain.ErrInvalidPricingTier)
	}
	if err := s.repo.DeletePricingTier(ctx, promptVolume); err != nil {
		return fmt.Errorf("delete pricing tier: %w", err)
	}
	return nil
}
