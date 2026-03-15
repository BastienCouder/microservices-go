package usecase

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"
)

const proUnlimitedMonthlyQuota = 1_000_000

func (s *Service) CreateStripeCheckoutSession(ctx context.Context, input CreateStripeCheckoutSessionInput) (CreateStripeCheckoutSessionOutput, error) {
	if !s.stripeEnabled() {
		return CreateStripeCheckoutSessionOutput{}, ErrStripeDisabled
	}
	if input.OrganizationID <= 0 {
		return CreateStripeCheckoutSessionOutput{}, fmt.Errorf("%w: organization_id must be positive", ErrStripeInvalidRequest)
	}
	if input.CorrectionCredits < 0 {
		return CreateStripeCheckoutSessionOutput{}, fmt.Errorf("%w: correction_credits cannot be negative", ErrStripeInvalidRequest)
	}
	if input.CorrectionCredits > 0 && strings.TrimSpace(s.stripeCatalog.CorrectionCreditsPriceID) == "" {
		return CreateStripeCheckoutSessionOutput{}, fmt.Errorf("%w: correction credits price is not configured", ErrStripeInvalidRequest)
	}

	plan := domain.NormalizePlan(input.Plan)
	if !isStripeSupportedPlan(plan) {
		return CreateStripeCheckoutSessionOutput{}, fmt.Errorf("%w: %s", ErrStripeUnsupportedPlan, input.Plan)
	}
	cycle := domain.NormalizeBillingCycle(input.BillingCycle)
	if cycle != domain.BillingCycleMonthly && cycle != domain.BillingCycleYearly {
		return CreateStripeCheckoutSessionOutput{}, fmt.Errorf("%w: %s", ErrStripeUnsupportedCycle, input.BillingCycle)
	}

	seats := input.Seats
	if seats <= 0 {
		seats = 1
	}

	priceID, monthlyQuota, err := s.resolvePlanPricing(plan, cycle)
	if err != nil {
		return CreateStripeCheckoutSessionOutput{}, err
	}

	successURL, err := resolveSafeReturnURL(input.SuccessURL, s.defaultSuccessURL)
	if err != nil {
		return CreateStripeCheckoutSessionOutput{}, err
	}
	cancelURL, err := resolveSafeReturnURL(input.CancelURL, s.defaultCancelURL)
	if err != nil {
		return CreateStripeCheckoutSessionOutput{}, err
	}

	session, err := s.stripe.CreateSubscriptionCheckoutSession(ctx, StripeCheckoutSessionRequest{
		OrganizationID:    input.OrganizationID,
		ProjectID:         input.ProjectID,
		AttributionSource: normalizeAttributionSource(input.AttributionSource),
		Plan:              plan,
		BillingCycle:      cycle,
		Seats:             seats,
		MonthlyQuota:      monthlyQuota,
		PriceID:           priceID,
		CorrectionCredits: input.CorrectionCredits,
		CorrectionPriceID: strings.TrimSpace(s.stripeCatalog.CorrectionCreditsPriceID),
		SuccessURL:        successURL,
		CancelURL:         cancelURL,
		RequestID:         buildStripeIdempotencyKey("checkout", input.OrganizationID, input.RequestID),
	})
	if err != nil {
		return CreateStripeCheckoutSessionOutput{}, fmt.Errorf("create stripe checkout session: %w", err)
	}

	sub, err := s.repo.GetByOrganizationID(ctx, input.OrganizationID)
	if err != nil {
		if !errors.Is(err, domain.ErrSubscriptionMissing) {
			return CreateStripeCheckoutSessionOutput{}, fmt.Errorf("load subscription before stripe checkout: %w", err)
		}
		sub = &domain.Subscription{
			OrganizationID: input.OrganizationID,
		}
	}

	sub.Plan = plan
	sub.Seats = seats
	sub.MonthlyQuota = monthlyQuota
	sub.BillingCycle = cycle
	sub.StripePriceID = priceID
	sub.Status = domain.SubscriptionStatusCheckoutPending
	sub.UpdatedAt = s.now().UTC()
	if session.CustomerID != "" {
		sub.StripeCustomerID = session.CustomerID
	}
	if session.SubscriptionID != "" {
		sub.StripeSubscriptionID = session.SubscriptionID
	}
	if err := sub.Validate(); err != nil {
		return CreateStripeCheckoutSessionOutput{}, fmt.Errorf("%w: %v", ErrStripeInvalidRequest, err)
	}
	if err := s.repo.Upsert(ctx, sub); err != nil {
		return CreateStripeCheckoutSessionOutput{}, fmt.Errorf("persist checkout pending subscription: %w", err)
	}

	return CreateStripeCheckoutSessionOutput{
		SessionID:   session.ID,
		CheckoutURL: session.URL,
	}, nil
}

func (s *Service) CreateStripeCustomerPortalSession(ctx context.Context, input CreateStripeCustomerPortalSessionInput) (CreateStripeCustomerPortalSessionOutput, error) {
	if !s.stripeEnabled() {
		return CreateStripeCustomerPortalSessionOutput{}, ErrStripeDisabled
	}
	if input.OrganizationID <= 0 {
		return CreateStripeCustomerPortalSessionOutput{}, fmt.Errorf("%w: organization_id must be positive", ErrStripeInvalidRequest)
	}

	sub, err := s.repo.GetByOrganizationID(ctx, input.OrganizationID)
	if err != nil {
		return CreateStripeCustomerPortalSessionOutput{}, fmt.Errorf("load subscription for customer portal: %w", err)
	}
	customerID := strings.TrimSpace(sub.StripeCustomerID)
	if customerID == "" {
		return CreateStripeCustomerPortalSessionOutput{}, ErrStripeCustomerMissing
	}

	defaultPortalReturnURL := strings.TrimSpace(s.defaultPortalURL)
	if defaultPortalReturnURL == "" {
		defaultPortalReturnURL = strings.TrimSpace(s.defaultCancelURL)
	}
	returnURL, err := resolveSafeReturnURL(input.ReturnURL, defaultPortalReturnURL)
	if err != nil {
		return CreateStripeCustomerPortalSessionOutput{}, err
	}

	url, err := s.stripe.CreateCustomerPortalSession(ctx, customerID, returnURL, buildStripeIdempotencyKey("portal", input.OrganizationID, input.RequestID))
	if err != nil {
		return CreateStripeCustomerPortalSessionOutput{}, fmt.Errorf("create stripe customer portal session: %w", err)
	}
	return CreateStripeCustomerPortalSessionOutput{PortalURL: url}, nil
}

func (s *Service) HandleStripeWebhook(ctx context.Context, payload []byte, signature string) error {
	if !s.stripeEnabled() {
		return ErrStripeDisabled
	}
	if len(payload) == 0 || strings.TrimSpace(signature) == "" {
		return ErrStripeInvalidSignature
	}

	event, err := s.stripe.ParseWebhookEvent(payload, signature)
	if err != nil {
		if errors.Is(err, ErrStripeInvalidSignature) {
			return ErrStripeInvalidSignature
		}
		return fmt.Errorf("%w: parse webhook event: %v", ErrStripeWebhookProcessing, err)
	}
	if !event.Handled {
		return nil
	}

	processed, err := s.repo.RecordStripeWebhookEvent(ctx, event.ID, event.Type, s.now().UTC())
	if err != nil {
		return fmt.Errorf("%w: persist webhook idempotency key: %v", ErrStripeWebhookProcessing, err)
	}
	if !processed || event.OrganizationID <= 0 {
		return nil
	}

	sub, err := s.repo.GetByOrganizationID(ctx, event.OrganizationID)
	previousStatus := ""
	if err != nil {
		if !errors.Is(err, domain.ErrSubscriptionMissing) {
			return fmt.Errorf("%w: load subscription: %v", ErrStripeWebhookProcessing, err)
		}
		sub = newSubscriptionFromWebhook(event, s.now().UTC())
	} else {
		previousStatus = sub.Status
	}

	mergeWebhookIntoSubscription(sub, event)
	sub.UpdatedAt = s.now().UTC()
	if err := sub.Validate(); err != nil {
		return fmt.Errorf("%w: validate subscription update: %v", ErrStripeWebhookProcessing, err)
	}
	if err := s.repo.Upsert(ctx, sub); err != nil {
		return fmt.Errorf("%w: save subscription update: %v", ErrStripeWebhookProcessing, err)
	}

	s.emitStripeAttribution(ctx, previousStatus, event)
	return nil
}

func (s *Service) resolvePlanPricing(plan, cycle string) (string, int, error) {
	catalog := s.stripeCatalog
	switch plan {
	case domain.PlanStarter:
		if cycle == domain.BillingCycleYearly {
			if strings.TrimSpace(catalog.StarterYearlyPriceID) == "" {
				return "", 0, fmt.Errorf("%w: yearly starter price is not configured", ErrStripeUnsupportedCycle)
			}
			return strings.TrimSpace(catalog.StarterYearlyPriceID), defaultMonthlyQuotaForPlan(plan), nil
		}
		if strings.TrimSpace(catalog.StarterMonthlyPriceID) == "" {
			return "", 0, fmt.Errorf("%w: monthly starter price is not configured", ErrStripeUnsupportedPlan)
		}
		return strings.TrimSpace(catalog.StarterMonthlyPriceID), defaultMonthlyQuotaForPlan(plan), nil
	case domain.PlanGrowth:
		if cycle == domain.BillingCycleYearly {
			if strings.TrimSpace(catalog.GrowthYearlyPriceID) == "" {
				return "", 0, fmt.Errorf("%w: yearly growth price is not configured", ErrStripeUnsupportedCycle)
			}
			return strings.TrimSpace(catalog.GrowthYearlyPriceID), defaultMonthlyQuotaForPlan(plan), nil
		}
		if strings.TrimSpace(catalog.GrowthMonthlyPriceID) == "" {
			return "", 0, fmt.Errorf("%w: monthly growth price is not configured", ErrStripeUnsupportedPlan)
		}
		return strings.TrimSpace(catalog.GrowthMonthlyPriceID), defaultMonthlyQuotaForPlan(plan), nil
	case domain.PlanPro:
		if cycle == domain.BillingCycleYearly {
			if strings.TrimSpace(catalog.ProYearlyPriceID) == "" {
				return "", 0, fmt.Errorf("%w: yearly pro price is not configured", ErrStripeUnsupportedCycle)
			}
			return strings.TrimSpace(catalog.ProYearlyPriceID), defaultMonthlyQuotaForPlan(plan), nil
		}
		if strings.TrimSpace(catalog.ProMonthlyPriceID) == "" {
			return "", 0, fmt.Errorf("%w: monthly pro price is not configured", ErrStripeUnsupportedPlan)
		}
		return strings.TrimSpace(catalog.ProMonthlyPriceID), defaultMonthlyQuotaForPlan(plan), nil
	default:
		return "", 0, fmt.Errorf("%w: %s", ErrStripeUnsupportedPlan, plan)
	}
}

func newSubscriptionFromWebhook(event StripeWebhookEvent, nowTime time.Time) *domain.Subscription {
	plan := domain.NormalizePlan(event.Plan)
	if !isStripeSupportedPlan(plan) {
		plan = domain.PlanStarter
	}
	cycle := domain.NormalizeBillingCycle(event.BillingCycle)
	seats := event.Seats
	if seats <= 0 {
		seats = 1
	}
	monthlyQuota := event.MonthlyQuota
	if monthlyQuota <= 0 {
		monthlyQuota = defaultMonthlyQuotaForPlan(plan)
	}
	return &domain.Subscription{
		OrganizationID:       event.OrganizationID,
		Plan:                 plan,
		Seats:                seats,
		MonthlyQuota:         monthlyQuota,
		StripeCustomerID:     strings.TrimSpace(event.StripeCustomerID),
		StripeSubscriptionID: strings.TrimSpace(event.StripeSubscriptionID),
		StripePriceID:        strings.TrimSpace(event.StripePriceID),
		BillingCycle:         cycle,
		Status:               domain.NormalizeSubscriptionStatus(event.Status),
		CancelAtPeriodEnd:    event.CancelAtPeriodEnd,
		UpdatedAt:            nowTime,
	}
}

func mergeWebhookIntoSubscription(sub *domain.Subscription, event StripeWebhookEvent) {
	if plan := domain.NormalizePlan(event.Plan); isStripeSupportedPlan(plan) {
		sub.Plan = plan
	}
	if cycle := domain.NormalizeBillingCycle(event.BillingCycle); cycle == domain.BillingCycleMonthly || cycle == domain.BillingCycleYearly {
		sub.BillingCycle = cycle
	}
	if event.Seats > 0 {
		sub.Seats = event.Seats
	}
	if event.MonthlyQuota > 0 {
		sub.MonthlyQuota = event.MonthlyQuota
	}
	if customerID := strings.TrimSpace(event.StripeCustomerID); customerID != "" {
		sub.StripeCustomerID = customerID
	}
	if subscriptionID := strings.TrimSpace(event.StripeSubscriptionID); subscriptionID != "" {
		sub.StripeSubscriptionID = subscriptionID
	}
	if priceID := strings.TrimSpace(event.StripePriceID); priceID != "" {
		sub.StripePriceID = priceID
	}
	if status := strings.TrimSpace(event.Status); status != "" {
		sub.Status = domain.NormalizeSubscriptionStatus(status)
	}
	sub.CancelAtPeriodEnd = event.CancelAtPeriodEnd

	if event.CurrentPeriodEnd != nil {
		value := event.CurrentPeriodEnd.UTC()
		sub.CurrentPeriodEnd = &value
	}

	if event.CorrectionCreditsDelta != 0 {
		next := sub.CorrectionCredits + event.CorrectionCreditsDelta
		if next < 0 {
			next = 0
		}
		sub.CorrectionCredits = next
	}

	if sub.Plan == "" {
		sub.Plan = domain.PlanStarter
	}
	if sub.Seats <= 0 {
		sub.Seats = 1
	}
	if sub.MonthlyQuota <= 0 {
		sub.MonthlyQuota = defaultMonthlyQuotaForPlan(sub.Plan)
	}
	if sub.BillingCycle == "" {
		sub.BillingCycle = domain.BillingCycleMonthly
	}
	if sub.Status == "" {
		sub.Status = domain.SubscriptionStatusActive
	}
}

func isStripeSupportedPlan(plan string) bool {
	switch plan {
	case domain.PlanStarter, domain.PlanGrowth, domain.PlanPro:
		return true
	default:
		return false
	}
}

func defaultMonthlyQuotaForPlan(plan string) int {
	switch domain.NormalizePlan(plan) {
	case domain.PlanStarter:
		return 50
	case domain.PlanGrowth:
		return 200
	case domain.PlanPro:
		return proUnlimitedMonthlyQuota
	default:
		return 50
	}
}

func resolveSafeReturnURL(requestedURL, defaultURL string) (string, error) {
	fallback := strings.TrimSpace(defaultURL)
	if fallback == "" {
		return "", fmt.Errorf("%w: default return url is not configured", ErrStripeInvalidRequest)
	}
	if strings.TrimSpace(requestedURL) == "" {
		return fallback, nil
	}

	base, err := parseAbsoluteHTTPURL(fallback)
	if err != nil {
		return "", fmt.Errorf("%w: invalid configured return url", ErrStripeInvalidRequest)
	}
	requested, err := parseAbsoluteHTTPURL(requestedURL)
	if err != nil {
		return "", fmt.Errorf("%w: invalid return_url", ErrStripeInvalidRequest)
	}
	if !sameURLOrigin(base, requested) {
		return "", fmt.Errorf("%w: return_url origin is not allowed", ErrStripeInvalidRequest)
	}
	return requested.String(), nil
}

func parseAbsoluteHTTPURL(raw string) (*url.URL, error) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return nil, err
	}
	if parsed.Scheme != "https" && parsed.Scheme != "http" {
		return nil, errors.New("unsupported url scheme")
	}
	if strings.TrimSpace(parsed.Host) == "" {
		return nil, errors.New("missing host")
	}
	if !parsed.IsAbs() {
		return nil, errors.New("url must be absolute")
	}
	return parsed, nil
}

func sameURLOrigin(a, b *url.URL) bool {
	return strings.EqualFold(a.Scheme, b.Scheme) && strings.EqualFold(a.Host, b.Host)
}

func buildStripeIdempotencyKey(operation string, organizationID int64, requestID string) string {
	op := strings.TrimSpace(strings.ToLower(operation))
	if op == "" {
		op = "op"
	}
	id := strings.TrimSpace(requestID)
	if id == "" {
		id = randomTokenHex(16)
	}
	payload := fmt.Sprintf("%s|org:%d|req:%s", op, organizationID, id)
	sum := sha256.Sum256([]byte(payload))
	return "bms_" + op + "_" + hex.EncodeToString(sum[:16]) + "_" + strconv.FormatInt(organizationID, 10)
}

func randomTokenHex(length int) string {
	if length <= 0 {
		length = 16
	}
	raw := make([]byte, length)
	if _, err := rand.Read(raw); err != nil {
		return strconv.FormatInt(time.Now().UnixNano(), 10)
	}
	return hex.EncodeToString(raw)
}
