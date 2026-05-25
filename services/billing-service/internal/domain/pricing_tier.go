package domain

import (
	"fmt"
	"time"
)

var ErrInvalidPricingTier = fmt.Errorf("invalid pricing tier")

type PricingTier struct {
	PromptVolume        int       `json:"prompt_volume"`
	Label               string    `json:"label"`
	DeveloperPriceCents *int      `json:"developer_price_cents"`
	StarterPriceCents   *int      `json:"starter_price_cents"`
	GrowthPriceCents    *int      `json:"growth_price_cents"`
	ProPriceCents       *int      `json:"pro_price_cents"`
	UpdatedAt           time.Time `json:"updated_at"`
}

func (p *PricingTier) Validate() error {
	if p.PromptVolume <= 0 {
		return fmt.Errorf("%w: prompt volume must be positive", ErrInvalidPricingTier)
	}
	if p.Label == "" {
		return fmt.Errorf("%w: label is required", ErrInvalidPricingTier)
	}
	for _, price := range []*int{
		p.DeveloperPriceCents,
		p.StarterPriceCents,
		p.GrowthPriceCents,
		p.ProPriceCents,
	} {
		if price != nil && *price < 0 {
			return fmt.Errorf("%w: price cannot be negative", ErrInvalidPricingTier)
		}
	}
	return nil
}
