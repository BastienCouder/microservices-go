package usecase

import (
	"context"
	"errors"
	"fmt"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"
)

type OrganizationEntitlements struct {
	OrganizationID          int64  `json:"organization_id"`
	Plan                    string `json:"plan"`
	SubscriptionStatus      string `json:"subscription_status"`
	IsPaid                  bool   `json:"is_paid"`
	MonthlyQuota            int    `json:"monthly_quota"`
	Seats                   int    `json:"seats"`
	ModelSelectionLimit     int    `json:"model_selection_limit"`
	MonthlyModelChangeLimit int    `json:"monthly_model_change_limit"`
}

func DefaultOrganizationEntitlements(organizationID int64) OrganizationEntitlements {
	settings := defaultPlanSettingsByPlan()[domain.PlanStarter]
	return OrganizationEntitlements{
		OrganizationID:          organizationID,
		Plan:                    settings.Plan,
		SubscriptionStatus:      "",
		IsPaid:                  false,
		MonthlyQuota:            settings.MonthlyQuota,
		Seats:                   1,
		ModelSelectionLimit:     settings.ModelSelectionLimit,
		MonthlyModelChangeLimit: settings.MonthlyModelChangeLimit,
	}
}

func EntitlementsFromSubscription(sub *domain.Subscription) OrganizationEntitlements {
	if sub == nil {
		return DefaultOrganizationEntitlements(0)
	}
	settings := defaultPlanSettingsByPlan()[domain.NormalizePlan(sub.Plan)]
	return OrganizationEntitlements{
		OrganizationID:          sub.OrganizationID,
		Plan:                    domain.NormalizePlan(sub.Plan),
		SubscriptionStatus:      domain.NormalizeSubscriptionStatus(sub.Status),
		IsPaid:                  isPaidSubscriptionStatus(sub.Status),
		MonthlyQuota:            sub.MonthlyQuota,
		Seats:                   sub.Seats,
		ModelSelectionLimit:     settings.ModelSelectionLimit,
		MonthlyModelChangeLimit: settings.MonthlyModelChangeLimit,
	}
}

func (s *Service) GetOrganizationEntitlements(ctx context.Context, organizationID int64) (OrganizationEntitlements, error) {
	entitlements := DefaultOrganizationEntitlements(organizationID)
	sub, err := s.GetSubscription(ctx, organizationID)
	if err != nil {
		if errors.Is(err, domain.ErrSubscriptionMissing) {
			settings, settingsErr := s.planSettingsForPlan(ctx, entitlements.Plan)
			if settingsErr != nil {
				return entitlements, settingsErr
			}
			entitlements.MonthlyQuota = settings.MonthlyQuota
			entitlements.ModelSelectionLimit = settings.ModelSelectionLimit
			entitlements.MonthlyModelChangeLimit = settings.MonthlyModelChangeLimit
			return entitlements, nil
		}
		return entitlements, err
	}

	entitlements = EntitlementsFromSubscription(sub)
	settings, err := s.planSettingsForPlan(ctx, sub.Plan)
	if err != nil {
		return entitlements, fmt.Errorf("load plan settings for entitlements: %w", err)
	}
	entitlements.ModelSelectionLimit = settings.ModelSelectionLimit
	entitlements.MonthlyModelChangeLimit = settings.MonthlyModelChangeLimit
	return entitlements, nil
}

func isPaidSubscriptionStatus(status string) bool {
	return domain.NormalizeSubscriptionStatus(status) == domain.SubscriptionStatusActive
}

func ModelSelectionLimitForPlan(plan string) int {
	settings, ok := defaultPlanSettingsByPlan()[domain.NormalizePlan(plan)]
	if !ok {
		return 0
	}
	return settings.ModelSelectionLimit
}

func MonthlyModelChangeLimitForPlan(plan string) int {
	settings, ok := defaultPlanSettingsByPlan()[domain.NormalizePlan(plan)]
	if !ok {
		return 0
	}
	return settings.MonthlyModelChangeLimit
}
