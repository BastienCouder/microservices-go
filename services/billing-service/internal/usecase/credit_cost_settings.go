package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"
)

func defaultCreditCostSettings() domain.CreditCostSettings {
	settings := domain.CreditCostSettings{
		DefaultCreditCost: 1,
		Rules: []domain.CreditCostRule{
			{MinPricePerMillion: 20, CreditCost: 4},
			{MinPricePerMillion: 10, CreditCost: 3},
			{MinPricePerMillion: 5, CreditCost: 2},
		},
		UpdatedAt: time.Time{},
	}
	_ = settings.Validate()
	return settings
}

func (s *Service) GetCreditCostSettings(ctx context.Context) (domain.CreditCostSettings, error) {
	settings, err := s.repo.GetCreditCostSettings(ctx)
	if err != nil {
		return domain.CreditCostSettings{}, fmt.Errorf("get credit cost settings: %w", err)
	}
	if settings.DefaultCreditCost <= 0 {
		settings = defaultCreditCostSettings()
	}
	if err := settings.Validate(); err != nil {
		return domain.CreditCostSettings{}, fmt.Errorf("normalize credit cost settings: %w", err)
	}
	return settings, nil
}

func (s *Service) UpdateCreditCostSettings(ctx context.Context, settings domain.CreditCostSettings) (domain.CreditCostSettings, error) {
	if settings.UpdatedAt.IsZero() {
		settings.UpdatedAt = s.now().UTC()
	}
	if err := settings.Validate(); err != nil {
		return domain.CreditCostSettings{}, err
	}
	if err := s.repo.UpsertCreditCostSettings(ctx, settings); err != nil {
		return domain.CreditCostSettings{}, fmt.Errorf("upsert credit cost settings: %w", err)
	}
	return settings, nil
}
