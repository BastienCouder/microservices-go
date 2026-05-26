package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"
)

type fakeRepo struct {
	subs            map[int64]*domain.Subscription
	planSettings    map[string]domain.PlanSettings
	pricingTiers    map[int]domain.PricingTier
	processedEvents map[string]bool
}

func (f *fakeRepo) Upsert(_ context.Context, subscription *domain.Subscription) error {
	if f.subs == nil {
		f.subs = make(map[int64]*domain.Subscription)
	}
	clone := *subscription
	f.subs[subscription.OrganizationID] = &clone
	return nil
}

func (f *fakeRepo) GetByOrganizationID(_ context.Context, organizationID int64) (*domain.Subscription, error) {
	sub, ok := f.subs[organizationID]
	if !ok {
		return nil, domain.ErrSubscriptionMissing
	}
	clone := *sub
	return &clone, nil
}

func (f *fakeRepo) UpdateEntitlements(_ context.Context, organizationID int64, plan string, seats, monthlyQuota int, updatedAt time.Time) error {
	if f.subs == nil {
		f.subs = make(map[int64]*domain.Subscription)
	}
	sub, ok := f.subs[organizationID]
	if !ok {
		sub = &domain.Subscription{
			OrganizationID: organizationID,
			BillingCycle:   domain.BillingCycleMonthly,
			Status:         domain.SubscriptionStatusActive,
		}
	}
	clone := *sub
	clone.Plan = plan
	clone.Seats = seats
	clone.MonthlyQuota = monthlyQuota
	clone.UpdatedAt = updatedAt
	f.subs[organizationID] = &clone
	return nil
}

func (f *fakeRepo) UpdateDefaultQuotaForPlan(_ context.Context, plan string, previousMonthlyQuota, nextMonthlyQuota int, updatedAt time.Time) error {
	for organizationID, sub := range f.subs {
		if sub.Plan != plan || sub.MonthlyQuota != previousMonthlyQuota {
			continue
		}
		clone := *sub
		clone.MonthlyQuota = nextMonthlyQuota
		clone.UpdatedAt = updatedAt
		f.subs[organizationID] = &clone
	}
	return nil
}

func (f *fakeRepo) RecordStripeWebhookEvent(_ context.Context, eventID, _ string, _ time.Time) (bool, error) {
	if f.processedEvents == nil {
		f.processedEvents = make(map[string]bool)
	}
	if f.processedEvents[eventID] {
		return false, nil
	}
	f.processedEvents[eventID] = true
	return true, nil
}

func (f *fakeRepo) ListPlanSettings(_ context.Context) ([]domain.PlanSettings, error) {
	items := make([]domain.PlanSettings, 0, len(f.planSettings))
	for _, item := range f.planSettings {
		items = append(items, item)
	}
	return items, nil
}

func (f *fakeRepo) UpsertPlanSettings(_ context.Context, settings domain.PlanSettings) error {
	if f.planSettings == nil {
		f.planSettings = make(map[string]domain.PlanSettings)
	}
	f.planSettings[settings.Plan] = settings
	return nil
}

func (f *fakeRepo) ListPricingTiers(_ context.Context) ([]domain.PricingTier, error) {
	items := make([]domain.PricingTier, 0, len(f.pricingTiers))
	for _, item := range f.pricingTiers {
		items = append(items, item)
	}
	return items, nil
}

func (f *fakeRepo) UpsertPricingTier(_ context.Context, tier domain.PricingTier) error {
	if f.pricingTiers == nil {
		f.pricingTiers = make(map[int]domain.PricingTier)
	}
	f.pricingTiers[tier.PromptVolume] = tier
	return nil
}

type fakeStripeProvider struct {
	checkoutResp StripeCheckoutSession
	checkoutErr  error
	lastRequest  StripeCheckoutSessionRequest

	portalURL        string
	portalErr        error
	portalCustomerID string
	portalReturnURL  string
	portalRequestID  string

	webhookEvent StripeWebhookEvent
	webhookErr   error
}

func (f *fakeStripeProvider) CreateSubscriptionCheckoutSession(_ context.Context, req StripeCheckoutSessionRequest) (StripeCheckoutSession, error) {
	f.lastRequest = req
	return f.checkoutResp, f.checkoutErr
}

func (f *fakeStripeProvider) ParseWebhookEvent(_ []byte, _ string) (StripeWebhookEvent, error) {
	return f.webhookEvent, f.webhookErr
}

func (f *fakeStripeProvider) CreateCustomerPortalSession(_ context.Context, customerID, returnURL, requestID string) (string, error) {
	f.portalCustomerID = customerID
	f.portalReturnURL = returnURL
	f.portalRequestID = requestID
	return f.portalURL, f.portalErr
}

func TestUpsertSubscription(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo)
	_, err := svc.UpsertSubscription(context.Background(), 1, "pro", 10, 10000)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.subs[1].BillingCycle != domain.BillingCycleMonthly {
		t.Fatalf("expected default billing cycle monthly, got %s", repo.subs[1].BillingCycle)
	}
	if repo.subs[1].Status != domain.SubscriptionStatusActive {
		t.Fatalf("expected default active status, got %s", repo.subs[1].Status)
	}

	_, err = svc.UpsertSubscription(context.Background(), 0, "", 0, 0)
	if !errors.Is(err, domain.ErrInvalidSubscription) {
		t.Fatalf("expected invalid subscription error, got %v", err)
	}
}

func TestCreateStripeCheckoutSession_Disabled(t *testing.T) {
	svc := NewService(&fakeRepo{})
	_, err := svc.CreateStripeCheckoutSession(context.Background(), CreateStripeCheckoutSessionInput{
		OrganizationID: 1,
		Plan:           domain.PlanGrowth,
		BillingCycle:   domain.BillingCycleMonthly,
		Seats:          3,
	})
	if !errors.Is(err, ErrStripeDisabled) {
		t.Fatalf("expected ErrStripeDisabled, got %v", err)
	}
}

func TestListPricingTiersKeepsLegacyPlanPricesForDefaultTiers(t *testing.T) {
	svc := NewService(&fakeRepo{})
	tiers, err := svc.ListPricingTiers(context.Background())
	if err != nil {
		t.Fatalf("list pricing tiers: %v", err)
	}
	if len(tiers) == 0 {
		t.Fatalf("expected default pricing tiers")
	}
	first := tiers[0]
	if first.DeveloperPriceCents == nil || *first.DeveloperPriceCents != 2900 {
		t.Fatalf("expected developer legacy price on first tier, got %+v", first)
	}
	if first.Prices[domain.PlanDeveloper] == nil || *first.Prices[domain.PlanDeveloper] != 2900 {
		t.Fatalf("expected dynamic developer price on first tier, got %+v", first.Prices)
	}
}

func TestCreateStripeCheckoutSession_Success(t *testing.T) {
	repo := &fakeRepo{}
	stripe := &fakeStripeProvider{
		checkoutResp: StripeCheckoutSession{
			ID:             "cs_123",
			URL:            "https://checkout.stripe.com/c/pay/cs_123",
			CustomerID:     "cus_abc",
			SubscriptionID: "sub_abc",
		},
	}
	svc := NewService(repo)
	svc.EnableStripe(stripe, StripeCatalog{
		StarterMonthlyPriceID:    "price_starter_m",
		GrowthMonthlyPriceID:     "price_growth_m",
		ProMonthlyPriceID:        "price_pro_m",
		CorrectionCreditsPriceID: "price_correction_credits",
	}, "https://app.local/success", "https://app.local/cancel", "https://app.local/portal")

	out, err := svc.CreateStripeCheckoutSession(context.Background(), CreateStripeCheckoutSessionInput{
		OrganizationID:    42,
		Plan:              domain.PlanGrowth,
		BillingCycle:      domain.BillingCycleMonthly,
		Seats:             3,
		CorrectionCredits: 2,
		RequestID:         "req_123",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out.SessionID != "cs_123" || out.CheckoutURL == "" {
		t.Fatalf("unexpected checkout output: %+v", out)
	}
	if stripe.lastRequest.PriceID != "price_growth_m" {
		t.Fatalf("expected growth monthly price id, got %s", stripe.lastRequest.PriceID)
	}
	if stripe.lastRequest.MonthlyQuota != 200 {
		t.Fatalf("expected monthly quota 200 for growth plan, got %d", stripe.lastRequest.MonthlyQuota)
	}
	if stripe.lastRequest.RequestID == "" || stripe.lastRequest.RequestID == "req_123" {
		t.Fatalf("expected server-generated idempotency key, got %q", stripe.lastRequest.RequestID)
	}
	stored := repo.subs[42]
	if stored == nil {
		t.Fatalf("expected subscription persisted")
	}
	if stored.Status != domain.SubscriptionStatusCheckoutPending {
		t.Fatalf("expected checkout pending status, got %s", stored.Status)
	}
	if stored.StripeCustomerID != "cus_abc" || stored.StripeSubscriptionID != "sub_abc" {
		t.Fatalf("expected stripe ids to be saved: %+v", stored)
	}
}

func TestHandleStripeWebhook_Idempotent(t *testing.T) {
	repo := &fakeRepo{
		subs: map[int64]*domain.Subscription{
			7: {
				OrganizationID:    7,
				Plan:              domain.PlanStarter,
				Seats:             1,
				MonthlyQuota:      50,
				BillingCycle:      domain.BillingCycleMonthly,
				Status:            domain.SubscriptionStatusCheckoutPending,
				CorrectionCredits: 1,
				UpdatedAt:         time.Now().UTC(),
			},
		},
	}
	stripe := &fakeStripeProvider{
		webhookEvent: StripeWebhookEvent{
			ID:                     "evt_1",
			Type:                   "customer.subscription.updated",
			Handled:                true,
			OrganizationID:         7,
			Plan:                   domain.PlanGrowth,
			BillingCycle:           domain.BillingCycleMonthly,
			Seats:                  3,
			MonthlyQuota:           200,
			CorrectionCreditsDelta: 2,
			StripeCustomerID:       "cus_7",
			StripeSubscriptionID:   "sub_7",
			StripePriceID:          "price_growth_m",
			Status:                 domain.SubscriptionStatusActive,
		},
	}

	svc := NewService(repo)
	svc.EnableStripe(stripe, StripeCatalog{}, "https://app.local/success", "https://app.local/cancel", "https://app.local/portal")

	if err := svc.HandleStripeWebhook(context.Background(), []byte(`{"id":"evt_1"}`), "sig"); err != nil {
		t.Fatalf("unexpected first webhook error: %v", err)
	}
	if err := svc.HandleStripeWebhook(context.Background(), []byte(`{"id":"evt_1"}`), "sig"); err != nil {
		t.Fatalf("unexpected second webhook error: %v", err)
	}

	stored := repo.subs[7]
	if stored == nil {
		t.Fatalf("expected subscription persisted")
	}
	if stored.Status != domain.SubscriptionStatusActive {
		t.Fatalf("expected active status after webhook, got %s", stored.Status)
	}
	if stored.CorrectionCredits != 3 {
		t.Fatalf("expected correction credits incremented once, got %d", stored.CorrectionCredits)
	}
	if len(repo.processedEvents) != 1 {
		t.Fatalf("expected one processed event, got %d", len(repo.processedEvents))
	}
}

func TestCreateStripeCheckoutSession_RejectsCorrectionCreditsWithoutPrice(t *testing.T) {
	repo := &fakeRepo{}
	stripe := &fakeStripeProvider{
		checkoutResp: StripeCheckoutSession{
			ID:  "cs_123",
			URL: "https://checkout.stripe.com/c/pay/cs_123",
		},
	}
	svc := NewService(repo)
	svc.EnableStripe(stripe, StripeCatalog{
		StarterMonthlyPriceID: "price_starter_m",
		GrowthMonthlyPriceID:  "price_growth_m",
		ProMonthlyPriceID:     "price_pro_m",
	}, "https://app.local/success", "https://app.local/cancel", "https://app.local/portal")

	_, err := svc.CreateStripeCheckoutSession(context.Background(), CreateStripeCheckoutSessionInput{
		OrganizationID:    42,
		Plan:              domain.PlanGrowth,
		BillingCycle:      domain.BillingCycleMonthly,
		Seats:             3,
		CorrectionCredits: 1,
	})
	if !errors.Is(err, ErrStripeInvalidRequest) {
		t.Fatalf("expected ErrStripeInvalidRequest, got %v", err)
	}
}

func TestCreateStripeCheckoutSession_RejectsUntrustedReturnURL(t *testing.T) {
	repo := &fakeRepo{}
	stripe := &fakeStripeProvider{
		checkoutResp: StripeCheckoutSession{
			ID:  "cs_123",
			URL: "https://checkout.stripe.com/c/pay/cs_123",
		},
	}
	svc := NewService(repo)
	svc.EnableStripe(stripe, StripeCatalog{
		StarterMonthlyPriceID: "price_starter_m",
		GrowthMonthlyPriceID:  "price_growth_m",
		ProMonthlyPriceID:     "price_pro_m",
	}, "https://app.local/success", "https://app.local/cancel", "https://app.local/portal")

	_, err := svc.CreateStripeCheckoutSession(context.Background(), CreateStripeCheckoutSessionInput{
		OrganizationID: 42,
		Plan:           domain.PlanGrowth,
		BillingCycle:   domain.BillingCycleMonthly,
		Seats:          3,
		SuccessURL:     "https://evil.example/success",
	})
	if !errors.Is(err, ErrStripeInvalidRequest) {
		t.Fatalf("expected ErrStripeInvalidRequest, got %v", err)
	}
}

func TestCreateStripeCustomerPortalSession_Success(t *testing.T) {
	repo := &fakeRepo{
		subs: map[int64]*domain.Subscription{
			42: {
				OrganizationID:   42,
				Plan:             domain.PlanGrowth,
				Seats:            5,
				MonthlyQuota:     200,
				BillingCycle:     domain.BillingCycleMonthly,
				Status:           domain.SubscriptionStatusActive,
				StripeCustomerID: "cus_42",
				UpdatedAt:        time.Now().UTC(),
			},
		},
	}
	stripe := &fakeStripeProvider{portalURL: "https://billing.stripe.com/p/session/test_123"}

	svc := NewService(repo)
	svc.EnableStripe(stripe, StripeCatalog{}, "https://app.local/success", "https://app.local/cancel", "https://app.local/settings/billing")

	out, err := svc.CreateStripeCustomerPortalSession(context.Background(), CreateStripeCustomerPortalSessionInput{
		OrganizationID: 42,
		RequestID:      "req_portal_1",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out.PortalURL == "" {
		t.Fatalf("expected non-empty portal url")
	}
	if stripe.portalCustomerID != "cus_42" {
		t.Fatalf("expected customer id cus_42, got %s", stripe.portalCustomerID)
	}
	if stripe.portalReturnURL != "https://app.local/settings/billing" {
		t.Fatalf("unexpected return url: %s", stripe.portalReturnURL)
	}
	if stripe.portalRequestID == "" || stripe.portalRequestID == "req_portal_1" {
		t.Fatalf("expected server-generated idempotency key, got %q", stripe.portalRequestID)
	}
}
