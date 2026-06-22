package usecase

import (
	"context"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"
)

const (
	activeSubscriptionRefreshInterval   = 6 * time.Hour
	inactiveSubscriptionRefreshInterval = 15 * time.Minute
)

func (s *Service) refreshSubscriptionForEntitlements(ctx context.Context, sub *domain.Subscription) *domain.Subscription {
	if !s.stripeEnabled() || sub == nil {
		return sub
	}
	if !shouldRefreshSubscriptionFromStripe(s.now().UTC(), sub) {
		return sub
	}

	details, err := s.stripe.GetSubscription(ctx, strings.TrimSpace(sub.StripeSubscriptionID))
	if err != nil {
		return sub
	}
	if details.OrganizationID > 0 && details.OrganizationID != sub.OrganizationID {
		return sub
	}

	refreshed := *sub
	mergeWebhookIntoSubscription(&refreshed, stripeWebhookEventFromSubscriptionDetails(sub.OrganizationID, details))
	refreshed.UpdatedAt = s.now().UTC()
	if err := refreshed.Validate(); err != nil {
		return sub
	}
	if err := s.repo.Upsert(ctx, &refreshed); err != nil {
		return &refreshed
	}
	return &refreshed
}

func shouldRefreshSubscriptionFromStripe(now time.Time, sub *domain.Subscription) bool {
	if sub == nil || strings.TrimSpace(sub.StripeSubscriptionID) == "" {
		return false
	}
	if sub.CurrentPeriodEnd != nil && sub.CancelAtPeriodEnd && !sub.CurrentPeriodEnd.After(now) {
		return true
	}
	if sub.UpdatedAt.IsZero() {
		return true
	}

	refreshInterval := activeSubscriptionRefreshInterval
	if domain.NormalizeSubscriptionStatus(sub.Status) != domain.SubscriptionStatusActive {
		refreshInterval = inactiveSubscriptionRefreshInterval
	}
	return now.Sub(sub.UpdatedAt) >= refreshInterval
}

func stripeWebhookEventFromSubscriptionDetails(organizationID int64, details StripeSubscriptionDetails) StripeWebhookEvent {
	if details.OrganizationID > 0 {
		organizationID = details.OrganizationID
	}
	return StripeWebhookEvent{
		OrganizationID:       organizationID,
		ProjectID:            details.ProjectID,
		AttributionSource:    details.AttributionSource,
		Plan:                 details.Plan,
		BillingCycle:         details.BillingCycle,
		Seats:                details.Seats,
		MonthlyQuota:         details.MonthlyQuota,
		StripeCustomerID:     details.StripeCustomerID,
		StripeSubscriptionID: details.StripeSubscriptionID,
		StripePriceID:        details.StripePriceID,
		Status:               details.Status,
		CancelAtPeriodEnd:    details.CancelAtPeriodEnd,
		CurrentPeriodEnd:     details.CurrentPeriodEnd,
	}
}
