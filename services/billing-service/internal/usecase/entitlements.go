package usecase

import "github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"

const defaultMonthlyModelChangeLimit = 3

type OrganizationEntitlements struct {
	OrganizationID          int64  `json:"organization_id"`
	Plan                    string `json:"plan"`
	MonthlyQuota            int    `json:"monthly_quota"`
	Seats                   int    `json:"seats"`
	ModelSelectionLimit     int    `json:"model_selection_limit"`
	MonthlyModelChangeLimit int    `json:"monthly_model_change_limit"`
}

func DefaultOrganizationEntitlements(organizationID int64) OrganizationEntitlements {
	plan := domain.PlanStarter
	return OrganizationEntitlements{
		OrganizationID:          organizationID,
		Plan:                    plan,
		MonthlyQuota:            defaultMonthlyQuotaForPlan(plan),
		Seats:                   1,
		ModelSelectionLimit:     ModelSelectionLimitForPlan(plan),
		MonthlyModelChangeLimit: MonthlyModelChangeLimitForPlan(plan),
	}
}

func EntitlementsFromSubscription(sub *domain.Subscription) OrganizationEntitlements {
	if sub == nil {
		return DefaultOrganizationEntitlements(0)
	}
	return OrganizationEntitlements{
		OrganizationID:          sub.OrganizationID,
		Plan:                    domain.NormalizePlan(sub.Plan),
		MonthlyQuota:            sub.MonthlyQuota,
		Seats:                   sub.Seats,
		ModelSelectionLimit:     ModelSelectionLimitForPlan(sub.Plan),
		MonthlyModelChangeLimit: MonthlyModelChangeLimitForPlan(sub.Plan),
	}
}

func ModelSelectionLimitForPlan(plan string) int {
	switch domain.NormalizePlan(plan) {
	case domain.PlanStarter:
		return 3
	case domain.PlanGrowth:
		return 6
	default:
		return 0
	}
}

func MonthlyModelChangeLimitForPlan(_ string) int {
	return defaultMonthlyModelChangeLimit
}
