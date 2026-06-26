package usecase

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"
)

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
	if plan == "" {
		return CreateStripeCheckoutSessionOutput{}, fmt.Errorf("%w: plan is required", ErrStripeInvalidRequest)
	}
	cycle := domain.NormalizeBillingCycle(input.BillingCycle)
	if cycle != domain.BillingCycleMonthly && cycle != domain.BillingCycleYearly {
		return CreateStripeCheckoutSessionOutput{}, fmt.Errorf("%w: %s", ErrStripeUnsupportedCycle, input.BillingCycle)
	}

	seats := input.Seats
	if seats <= 0 {
		seats = 1
	}

	priceID, monthlyQuota, err := s.resolvePlanPricing(ctx, plan, cycle, input.PromptVolume)
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
	subscriptionExists := err == nil
	if err != nil {
		if !errors.Is(err, domain.ErrSubscriptionMissing) {
			return CreateStripeCheckoutSessionOutput{}, fmt.Errorf("load subscription before stripe checkout: %w", err)
		}
		sub = &domain.Subscription{
			OrganizationID: input.OrganizationID,
		}
	}

	existingStatus := ""
	if subscriptionExists {
		existingStatus = domain.NormalizeSubscriptionStatus(sub.Status)
	}
	switch existingStatus {
	case domain.SubscriptionStatusActive:
		// Keep active entitlements in place until Stripe confirms the new checkout.
		// This prevents a cancelled upgrade/downgrade flow from temporarily removing access.
		if session.CustomerID != "" && strings.TrimSpace(sub.StripeCustomerID) == "" {
			sub.StripeCustomerID = session.CustomerID
		}
		if session.SubscriptionID != "" && strings.TrimSpace(sub.StripeSubscriptionID) == "" {
			sub.StripeSubscriptionID = session.SubscriptionID
		}
		if err := sub.Validate(); err != nil {
			return CreateStripeCheckoutSessionOutput{}, fmt.Errorf("%w: %v", ErrStripeInvalidRequest, err)
		}
		if err := s.repo.Upsert(ctx, sub); err != nil {
			return CreateStripeCheckoutSessionOutput{}, fmt.Errorf("persist active subscription during stripe checkout: %w", err)
		}
	default:
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

func (s *Service) ConfirmStripeCheckoutSession(ctx context.Context, input ConfirmStripeCheckoutSessionInput) (ConfirmStripeCheckoutSessionOutput, error) {
	if !s.stripeEnabled() {
		return ConfirmStripeCheckoutSessionOutput{}, ErrStripeDisabled
	}
	if input.OrganizationID <= 0 {
		return ConfirmStripeCheckoutSessionOutput{}, fmt.Errorf("%w: organization_id must be positive", ErrStripeInvalidRequest)
	}
	if strings.TrimSpace(input.SessionID) == "" {
		return ConfirmStripeCheckoutSessionOutput{}, fmt.Errorf("%w: session_id is required", ErrStripeInvalidRequest)
	}

	session, err := s.stripe.GetCheckoutSession(ctx, input.SessionID)
	if err != nil {
		return ConfirmStripeCheckoutSessionOutput{}, fmt.Errorf("load stripe checkout session: %w", err)
	}
	if session.OrganizationID <= 0 {
		return ConfirmStripeCheckoutSessionOutput{}, fmt.Errorf("%w: stripe checkout session is missing organization metadata", ErrStripeInvalidRequest)
	}
	if session.OrganizationID != input.OrganizationID {
		return ConfirmStripeCheckoutSessionOutput{}, fmt.Errorf("%w: checkout session organization mismatch", ErrStripeInvalidRequest)
	}

	sub, err := s.repo.GetByOrganizationID(ctx, input.OrganizationID)
	if err != nil {
		if !errors.Is(err, domain.ErrSubscriptionMissing) {
			return ConfirmStripeCheckoutSessionOutput{}, fmt.Errorf("load subscription before stripe checkout confirmation: %w", err)
		}
		sub = &domain.Subscription{
			OrganizationID: input.OrganizationID,
		}
	}

	mergeWebhookIntoSubscription(sub, StripeWebhookEvent{
		OrganizationID:       session.OrganizationID,
		ProjectID:            session.ProjectID,
		AttributionSource:    session.AttributionSource,
		Plan:                 session.Plan,
		BillingCycle:         session.BillingCycle,
		Seats:                session.Seats,
		MonthlyQuota:         session.MonthlyQuota,
		StripeCustomerID:     session.StripeCustomerID,
		StripeSubscriptionID: session.StripeSubscriptionID,
		Status: func() string {
			if session.Paid {
				return domain.SubscriptionStatusActive
			}
			return domain.SubscriptionStatusCheckoutPending
		}(),
	})
	sub.UpdatedAt = s.now().UTC()
	if err := sub.Validate(); err != nil {
		return ConfirmStripeCheckoutSessionOutput{}, fmt.Errorf("%w: %v", ErrStripeInvalidRequest, err)
	}
	if err := s.repo.Upsert(ctx, sub); err != nil {
		return ConfirmStripeCheckoutSessionOutput{}, fmt.Errorf("persist confirmed stripe checkout subscription: %w", err)
	}

	return ConfirmStripeCheckoutSessionOutput{
		OrganizationID:       sub.OrganizationID,
		Plan:                 sub.Plan,
		BillingCycle:         sub.BillingCycle,
		SubscriptionStatus:   sub.Status,
		MonthlyQuota:         sub.MonthlyQuota,
		Seats:                sub.Seats,
		StripeCustomerID:     sub.StripeCustomerID,
		StripeSubscriptionID: sub.StripeSubscriptionID,
	}, nil
}

func (s *Service) CancelOrganizationSubscription(ctx context.Context, organizationID int64) error {
	if organizationID <= 0 {
		return fmt.Errorf("%w: organization_id must be positive", ErrStripeInvalidRequest)
	}

	sub, err := s.repo.GetByOrganizationID(ctx, organizationID)
	if err != nil {
		if errors.Is(err, domain.ErrSubscriptionMissing) {
			return nil
		}
		return fmt.Errorf("load subscription before cancellation: %w", err)
	}

	nowTime := s.now().UTC()
	stripeSubscriptionID := strings.TrimSpace(sub.StripeSubscriptionID)
	if stripeSubscriptionID != "" {
		if !s.stripeEnabled() {
			return ErrStripeDisabled
		}

		details, cancelErr := s.stripe.CancelSubscription(
			ctx,
			stripeSubscriptionID,
			buildStripeIdempotencyKey("cancel", organizationID, ""),
		)
		if cancelErr != nil {
			return fmt.Errorf("cancel stripe subscription: %w", cancelErr)
		}

		mergeWebhookIntoSubscription(sub, StripeWebhookEvent{
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
		})
	}

	sub.Status = domain.SubscriptionStatusCanceled
	sub.CancelAtPeriodEnd = false
	currentPeriodEnd := nowTime
	sub.CurrentPeriodEnd = &currentPeriodEnd
	sub.UpdatedAt = nowTime

	if err := sub.Validate(); err != nil {
		return fmt.Errorf("%w: %v", ErrStripeInvalidRequest, err)
	}
	if err := s.repo.Upsert(ctx, sub); err != nil {
		return fmt.Errorf("persist canceled subscription: %w", err)
	}
	return nil
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
	if err != nil {
		if !errors.Is(err, domain.ErrSubscriptionMissing) {
			return fmt.Errorf("%w: load subscription: %v", ErrStripeWebhookProcessing, err)
		}
		sub = newSubscriptionFromWebhook(event, s.now().UTC())
	}

	mergeWebhookIntoSubscription(sub, event)
	sub.UpdatedAt = s.now().UTC()
	if err := sub.Validate(); err != nil {
		return fmt.Errorf("%w: validate subscription update: %v", ErrStripeWebhookProcessing, err)
	}
	if err := s.repo.Upsert(ctx, sub); err != nil {
		return fmt.Errorf("%w: save subscription update: %v", ErrStripeWebhookProcessing, err)
	}

	return nil
}

func (s *Service) resolvePlanPricing(ctx context.Context, plan, cycle string, promptVolume int) (string, int, error) {
	catalog := s.stripeCatalog
	settings, settingsErr := s.planSettingsForPlan(ctx, plan)
	if settingsErr != nil {
		return "", 0, settingsErr
	}
	if promptVolume > 0 && cycle == domain.BillingCycleMonthly {
		priceID, err := s.resolveAdminPricingPriceID(ctx, plan, promptVolume)
		if err != nil {
			return "", 0, err
		}
		return priceID, settings.MonthlyQuota, nil
	}
	switch plan {
	case domain.PlanStarter:
		if cycle == domain.BillingCycleYearly {
			if strings.TrimSpace(catalog.StarterYearlyPriceID) == "" {
				return "", 0, fmt.Errorf("%w: yearly starter price is not configured", ErrStripeUnsupportedCycle)
			}
			return strings.TrimSpace(catalog.StarterYearlyPriceID), settings.MonthlyQuota, nil
		}
		if strings.TrimSpace(catalog.StarterMonthlyPriceID) == "" {
			return "", 0, fmt.Errorf("%w: monthly starter price is not configured", ErrStripeUnsupportedPlan)
		}
		return strings.TrimSpace(catalog.StarterMonthlyPriceID), settings.MonthlyQuota, nil
	case domain.PlanGrowth:
		if cycle == domain.BillingCycleYearly {
			if strings.TrimSpace(catalog.GrowthYearlyPriceID) == "" {
				return "", 0, fmt.Errorf("%w: yearly growth price is not configured", ErrStripeUnsupportedCycle)
			}
			return strings.TrimSpace(catalog.GrowthYearlyPriceID), settings.MonthlyQuota, nil
		}
		if strings.TrimSpace(catalog.GrowthMonthlyPriceID) == "" {
			return "", 0, fmt.Errorf("%w: monthly growth price is not configured", ErrStripeUnsupportedPlan)
		}
		return strings.TrimSpace(catalog.GrowthMonthlyPriceID), settings.MonthlyQuota, nil
	case domain.PlanPro:
		if cycle == domain.BillingCycleYearly {
			if strings.TrimSpace(catalog.ProYearlyPriceID) == "" {
				return "", 0, fmt.Errorf("%w: yearly pro price is not configured", ErrStripeUnsupportedCycle)
			}
			return strings.TrimSpace(catalog.ProYearlyPriceID), settings.MonthlyQuota, nil
		}
		if strings.TrimSpace(catalog.ProMonthlyPriceID) == "" {
			return "", 0, fmt.Errorf("%w: monthly pro price is not configured", ErrStripeUnsupportedPlan)
		}
		return strings.TrimSpace(catalog.ProMonthlyPriceID), settings.MonthlyQuota, nil
	default:
		if cycle == domain.BillingCycleYearly {
			return "", 0, fmt.Errorf("%w: yearly custom plan price is not configured", ErrStripeUnsupportedCycle)
		}
		priceID, err := s.resolveAdminPricingPriceID(ctx, plan, promptVolume)
		if err != nil {
			return "", 0, err
		}
		return priceID, settings.MonthlyQuota, nil
	}
}

func (s *Service) resolveAdminPricingPriceID(ctx context.Context, plan string, promptVolume int) (string, error) {
	tier, err := s.adminPricingTierForCheckout(ctx, plan, promptVolume)
	if err != nil {
		return "", err
	}
	lookupKey := stripeCatalogPriceLookupKey(plan, tier.PromptVolume)
	priceID, err := s.stripe.FindPriceIDByLookupKey(ctx, lookupKey)
	if err != nil {
		return "", fmt.Errorf("lookup stripe price %s: %w", lookupKey, err)
	}
	if strings.TrimSpace(priceID) == "" {
		return "", fmt.Errorf("%w: stripe price %s is missing; push this plan to Stripe first", ErrStripeInvalidRequest, lookupKey)
	}
	return strings.TrimSpace(priceID), nil
}

func (s *Service) adminPricingTierForCheckout(ctx context.Context, plan string, promptVolume int) (domain.PricingTier, error) {
	normalizedPlan := domain.NormalizePlan(plan)
	tiers, err := s.ListPricingTiers(ctx)
	if err != nil {
		return domain.PricingTier{}, fmt.Errorf("list pricing tiers for checkout: %w", err)
	}
	sort.SliceStable(tiers, func(left, right int) bool {
		return tiers[left].PromptVolume < tiers[right].PromptVolume
	})

	var firstAvailable *domain.PricingTier
	for _, tier := range tiers {
		price := tier.Prices[normalizedPlan]
		if price == nil {
			continue
		}
		if firstAvailable == nil {
			copy := tier
			firstAvailable = &copy
		}
		if promptVolume > 0 && tier.PromptVolume == promptVolume {
			return tier, nil
		}
	}
	if promptVolume > 0 {
		return domain.PricingTier{}, fmt.Errorf("%w: no price configured for %s at %d prompts", ErrStripeInvalidRequest, normalizedPlan, promptVolume)
	}
	if firstAvailable == nil {
		return domain.PricingTier{}, fmt.Errorf("%w: no price configured for %s", ErrStripeInvalidRequest, normalizedPlan)
	}
	return *firstAvailable, nil
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
	case domain.PlanDeveloper:
		return 1000
	case domain.PlanStarter:
		return 100
	case domain.PlanGrowth:
		return 750
	case domain.PlanPro:
		return 3000
	default:
		return 100
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

func normalizeAttributionSource(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return "unknown"
	}
	value = strings.ReplaceAll(value, "_", "-")
	value = strings.ReplaceAll(value, " ", "-")
	return value
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
