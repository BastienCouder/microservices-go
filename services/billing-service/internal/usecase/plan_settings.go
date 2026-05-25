package usecase

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"
)

func defaultPlanSettings() []domain.PlanSettings {
	now := time.Time{}
	return []domain.PlanSettings{
		{
			Plan:                    domain.PlanDeveloper,
			MonthlyPriceCents:       2900,
			YearlyPriceCents:        0,
			MonthlyQuota:            1000,
			ModelSelectionLimit:     1,
			MonthlyModelChangeLimit: 0,
			UpdatedAt:               now,
		},
		{
			Plan:                    domain.PlanStarter,
			MonthlyPriceCents:       4900,
			YearlyPriceCents:        3900,
			MonthlyQuota:            50,
			ModelSelectionLimit:     3,
			MonthlyModelChangeLimit: 0,
			UpdatedAt:               now,
		},
		{
			Plan:                    domain.PlanGrowth,
			MonthlyPriceCents:       14900,
			YearlyPriceCents:        11900,
			MonthlyQuota:            200,
			ModelSelectionLimit:     6,
			MonthlyModelChangeLimit: 0,
			UpdatedAt:               now,
		},
		{
			Plan:                    domain.PlanPro,
			MonthlyPriceCents:       39900,
			YearlyPriceCents:        31900,
			MonthlyQuota:            proUnlimitedMonthlyQuota,
			ModelSelectionLimit:     0,
			MonthlyModelChangeLimit: 0,
			UpdatedAt:               now,
		},
	}
}

func defaultPlanSettingsByPlan() map[string]domain.PlanSettings {
	settings := make(map[string]domain.PlanSettings, len(defaultPlanSettings()))
	for _, item := range defaultPlanSettings() {
		settings[item.Plan] = item
	}
	return settings
}

func (s *Service) ListPlanSettings(ctx context.Context) ([]domain.PlanSettings, error) {
	defaults := defaultPlanSettingsByPlan()
	stored, err := s.repo.ListPlanSettings(ctx)
	if err != nil {
		return nil, fmt.Errorf("list plan settings: %w", err)
	}
	for _, item := range stored {
		item.Plan = domain.NormalizePlan(item.Plan)
		if !domain.IsConfigurablePlan(item.Plan) {
			continue
		}
		defaults[item.Plan] = item
	}

	plans := []domain.PlanSettings{
		defaults[domain.PlanDeveloper],
		defaults[domain.PlanStarter],
		defaults[domain.PlanGrowth],
		defaults[domain.PlanPro],
	}
	sort.SliceStable(plans, func(left, right int) bool {
		return planSettingsRank(plans[left].Plan) < planSettingsRank(plans[right].Plan)
	})
	return plans, nil
}

func (s *Service) UpdatePlanSettings(ctx context.Context, settings domain.PlanSettings) (domain.PlanSettings, error) {
	settings.Plan = domain.NormalizePlan(settings.Plan)
	if settings.UpdatedAt.IsZero() {
		settings.UpdatedAt = s.now().UTC()
	}
	if err := settings.Validate(); err != nil {
		return domain.PlanSettings{}, err
	}
	previous, err := s.planSettingsForPlan(ctx, settings.Plan)
	if err != nil {
		return domain.PlanSettings{}, err
	}
	if err := s.repo.UpsertPlanSettings(ctx, settings); err != nil {
		return domain.PlanSettings{}, fmt.Errorf("upsert plan settings: %w", err)
	}
	if previous.MonthlyQuota != settings.MonthlyQuota {
		if err := s.repo.UpdateDefaultQuotaForPlan(ctx, settings.Plan, previous.MonthlyQuota, settings.MonthlyQuota, settings.UpdatedAt); err != nil {
			return domain.PlanSettings{}, fmt.Errorf("propagate default plan quota: %w", err)
		}
	}
	return settings, nil
}

func (s *Service) planSettingsForPlan(ctx context.Context, plan string) (domain.PlanSettings, error) {
	normalized := domain.NormalizePlan(plan)
	if !domain.IsConfigurablePlan(normalized) {
		return domain.PlanSettings{}, fmt.Errorf("%w: unsupported plan", domain.ErrInvalidPlanSettings)
	}
	settings, err := s.ListPlanSettings(ctx)
	if err != nil {
		return domain.PlanSettings{}, err
	}
	for _, item := range settings {
		if item.Plan == normalized {
			return item, nil
		}
	}
	return defaultPlanSettingsByPlan()[normalized], nil
}

func planSettingsRank(plan string) int {
	switch domain.NormalizePlan(plan) {
	case domain.PlanDeveloper:
		return 5
	case domain.PlanStarter:
		return 10
	case domain.PlanGrowth:
		return 20
	case domain.PlanPro:
		return 30
	default:
		return 99
	}
}
