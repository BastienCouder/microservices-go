package domain

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	ErrInvalidSubscription = errors.New("invalid subscription")
	ErrSubscriptionMissing = errors.New("subscription not found")
)

type Subscription struct {
	OrganizationID       int64
	Plan                 string
	Seats                int
	MonthlyQuota         int
	StripeCustomerID     string
	StripeSubscriptionID string
	StripePriceID        string
	BillingCycle         string
	Status               string
	CancelAtPeriodEnd    bool
	CurrentPeriodEnd     *time.Time
	CorrectionCredits    int
	UpdatedAt            time.Time
}

func (s *Subscription) Validate() error {
	if s.OrganizationID <= 0 {
		return fmt.Errorf("%w: organization id must be positive", ErrInvalidSubscription)
	}
	if strings.TrimSpace(s.Plan) == "" {
		return fmt.Errorf("%w: plan is required", ErrInvalidSubscription)
	}
	if s.Seats <= 0 {
		return fmt.Errorf("%w: seats must be positive", ErrInvalidSubscription)
	}
	if s.MonthlyQuota <= 0 {
		return fmt.Errorf("%w: monthly quota must be positive", ErrInvalidSubscription)
	}
	if strings.TrimSpace(s.BillingCycle) == "" {
		return fmt.Errorf("%w: billing cycle is required", ErrInvalidSubscription)
	}
	if strings.TrimSpace(s.Status) == "" {
		return fmt.Errorf("%w: status is required", ErrInvalidSubscription)
	}
	if s.CorrectionCredits < 0 {
		return fmt.Errorf("%w: correction credits cannot be negative", ErrInvalidSubscription)
	}
	return nil
}

const (
	PlanStarter = "starter"
	PlanGrowth  = "growth"
	PlanPro     = "pro"
)

const (
	BillingCycleMonthly = "monthly"
	BillingCycleYearly  = "yearly"
)

const (
	SubscriptionStatusCheckoutPending = "checkout_pending"
	SubscriptionStatusActive          = "active"
	SubscriptionStatusPastDue         = "past_due"
	SubscriptionStatusCanceled        = "canceled"
	SubscriptionStatusIncomplete      = "incomplete"
	SubscriptionStatusTrialing        = "trialing"
	SubscriptionStatusUnpaid          = "unpaid"
)

func NormalizePlan(plan string) string {
	return strings.TrimSpace(strings.ToLower(plan))
}

func NormalizeBillingCycle(cycle string) string {
	value := strings.TrimSpace(strings.ToLower(cycle))
	if value == "" {
		return BillingCycleMonthly
	}
	return value
}

func NormalizeSubscriptionStatus(status string) string {
	value := strings.TrimSpace(strings.ToLower(status))
	if value == "" {
		return SubscriptionStatusActive
	}
	return value
}
