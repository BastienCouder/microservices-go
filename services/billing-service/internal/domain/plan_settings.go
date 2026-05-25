package domain

import (
	"fmt"
	"strings"
	"time"
)

var ErrInvalidPlanSettings = fmt.Errorf("invalid plan settings")

type PlanSettings struct {
	Plan                    string    `json:"plan"`
	MonthlyPriceCents       int       `json:"monthly_price_cents"`
	YearlyPriceCents        int       `json:"yearly_price_cents"`
	MonthlyQuota            int       `json:"monthly_quota"`
	ModelSelectionLimit     int       `json:"model_selection_limit"`
	MonthlyModelChangeLimit int       `json:"monthly_model_change_limit"`
	UpdatedAt               time.Time `json:"updated_at"`
}

func (p *PlanSettings) Validate() error {
	p.Plan = NormalizePlan(p.Plan)
	if !IsConfigurablePlan(p.Plan) {
		return fmt.Errorf("%w: unsupported plan", ErrInvalidPlanSettings)
	}
	if p.MonthlyPriceCents < 0 {
		return fmt.Errorf("%w: monthly price cannot be negative", ErrInvalidPlanSettings)
	}
	if p.YearlyPriceCents < 0 {
		return fmt.Errorf("%w: yearly price cannot be negative", ErrInvalidPlanSettings)
	}
	if p.MonthlyQuota <= 0 {
		return fmt.Errorf("%w: monthly quota must be positive", ErrInvalidPlanSettings)
	}
	if p.ModelSelectionLimit < 0 {
		return fmt.Errorf("%w: model selection limit cannot be negative", ErrInvalidPlanSettings)
	}
	if p.MonthlyModelChangeLimit < 0 {
		return fmt.Errorf("%w: monthly model change limit cannot be negative", ErrInvalidPlanSettings)
	}
	return nil
}

func IsConfigurablePlan(plan string) bool {
	switch strings.TrimSpace(strings.ToLower(plan)) {
	case PlanDeveloper, PlanStarter, PlanGrowth, PlanPro:
		return true
	default:
		return false
	}
}
