package usecase

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"
)

type fakeRepo struct {
	subs               map[int64]*domain.Subscription
	planSettings       map[string]domain.PlanSettings
	creditCostSettings domain.CreditCostSettings
	pricingTiers       map[int]domain.PricingTier
	processedEvents    map[string]bool
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
	if settings.IsMostChosen {
		for plan, item := range f.planSettings {
			item.IsMostChosen = false
			f.planSettings[plan] = item
		}
	}
	f.planSettings[settings.Plan] = settings
	return nil
}

func (f *fakeRepo) GetCreditCostSettings(_ context.Context) (domain.CreditCostSettings, error) {
	return f.creditCostSettings, nil
}

func (f *fakeRepo) UpsertCreditCostSettings(_ context.Context, settings domain.CreditCostSettings) error {
	f.creditCostSettings = settings
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

func (f *fakeRepo) DeletePricingTier(_ context.Context, promptVolume int) error {
	if f.pricingTiers == nil {
		f.pricingTiers = make(map[int]domain.PricingTier)
	}
	f.pricingTiers[promptVolume] = domain.PricingTier{
		PromptVolume: promptVolume,
		Label:        "deleted",
		Deleted:      true,
	}
	return nil
}

func TestGetCreditCostSettingsReturnsDefaultsWhenRepositoryEmpty(t *testing.T) {
	svc := NewService(&fakeRepo{})

	settings, err := svc.GetCreditCostSettings(context.Background())
	if err != nil {
		t.Fatalf("get credit cost settings: %v", err)
	}
	if settings.DefaultCreditCost != 1 {
		t.Fatalf("expected default credit cost 1, got %d", settings.DefaultCreditCost)
	}
	if len(settings.Rules) != 3 {
		t.Fatalf("expected 3 default rules, got %d", len(settings.Rules))
	}
}

func TestUpdateCreditCostSettingsPersistsSortedRules(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo)

	settings, err := svc.UpdateCreditCostSettings(context.Background(), domain.CreditCostSettings{
		DefaultCreditCost: 1,
		Rules: []domain.CreditCostRule{
			{MinPricePerMillion: 5, CreditCost: 2},
			{MinPricePerMillion: 20, CreditCost: 4},
			{MinPricePerMillion: 10, CreditCost: 3},
		},
	})
	if err != nil {
		t.Fatalf("update credit cost settings: %v", err)
	}
	if len(settings.Rules) != 3 {
		t.Fatalf("expected 3 rules, got %d", len(settings.Rules))
	}
	if settings.Rules[0].MinPricePerMillion != 20 {
		t.Fatalf("expected highest threshold first, got %#v", settings.Rules)
	}
	if repo.creditCostSettings.Rules[0].MinPricePerMillion != 20 {
		t.Fatalf("expected stored rules sorted, got %#v", repo.creditCostSettings.Rules)
	}
}

type fakeStripeProvider struct {
	checkoutResp StripeCheckoutSession
	checkoutErr  error
	lastRequest  StripeCheckoutSessionRequest
	priceIDs     map[string]string
	priceLookup  string

	syncResp    StripePricingCatalogSyncResult
	syncErr     error
	syncRequest StripePricingCatalogSyncRequest

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

func (f *fakeStripeProvider) FindPriceIDByLookupKey(_ context.Context, lookupKey string) (string, error) {
	f.priceLookup = lookupKey
	return f.priceIDs[lookupKey], nil
}

func (f *fakeStripeProvider) SyncPricingCatalog(_ context.Context, req StripePricingCatalogSyncRequest) (StripePricingCatalogSyncResult, error) {
	f.syncRequest = req
	return f.syncResp, f.syncErr
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

func TestUpdatePlanSettingsAcceptsCustomPlan(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo)

	settings, err := svc.UpdatePlanSettings(context.Background(), domain.PlanSettings{
		Plan:                    "Agency Plus",
		MonthlyPriceCents:       9900,
		YearlyPriceCents:        7900,
		MonthlyQuota:            500,
		ModelSelectionLimit:     8,
		MonthlyModelChangeLimit: 2,
		MaxProjects:             12,
	})
	if err != nil {
		t.Fatalf("update custom plan settings: %v", err)
	}
	if settings.Plan != "agency-plus" {
		t.Fatalf("expected normalized custom plan, got %s", settings.Plan)
	}
	if _, ok := repo.planSettings["agency-plus"]; !ok {
		t.Fatalf("expected custom plan settings persisted: %+v", repo.planSettings)
	}
}

func TestSyncStripePricingCatalogBuildsStripeProductsFromAdminPricing(t *testing.T) {
	repo := &fakeRepo{
		planSettings: map[string]domain.PlanSettings{
			"agency-plus": {
				Plan:                    "agency-plus",
				MonthlyPriceCents:       9900,
				YearlyPriceCents:        7900,
				MonthlyQuota:            500,
				ModelSelectionLimit:     8,
				MonthlyModelChangeLimit: 2,
				MaxProjects:             12,
			},
		},
		pricingTiers: map[int]domain.PricingTier{
			250: {
				PromptVolume: 250,
				Label:        "250",
				Prices: map[string]*int{
					"developer":   priceCents(9900),
					"agency-plus": priceCents(79900),
					"starter":     priceCents(24900),
					"growth":      priceCents(49900),
					"pro":         priceCents(99900),
				},
			},
		},
	}
	stripe := &fakeStripeProvider{
		syncResp: StripePricingCatalogSyncResult{
			ProductsCreated: 1,
			PricesCreated:   2,
		},
	}
	svc := NewService(repo)
	svc.EnableStripe(stripe, StripeCatalog{}, "", "", "")

	out, err := svc.SyncStripePricingCatalog(context.Background(), "agency-plus")
	if err != nil {
		t.Fatalf("sync stripe pricing catalog: %v", err)
	}
	if out.ProductsCreated != 1 || out.PricesCreated != 2 {
		t.Fatalf("unexpected sync output: %+v", out)
	}
	if len(stripe.syncRequest.Products) != 1 {
		t.Fatalf("expected only selected plan product, got %+v", stripe.syncRequest.Products)
	}
	if stripe.syncRequest.Products[0].Plan != "agency-plus" {
		t.Fatalf("expected agency-plus product, got %+v", stripe.syncRequest.Products[0])
	}
	if len(stripe.syncRequest.Prices) != 1 {
		t.Fatalf("expected non-null admin pricing tier prices, got %d: %+v", len(stripe.syncRequest.Prices), stripe.syncRequest.Prices)
	}

	var agencyPrice StripePricingCatalogPrice
	for _, price := range stripe.syncRequest.Prices {
		if price.Plan == "agency-plus" && price.PromptVolume == 250 {
			agencyPrice = price
			break
		}
	}
	if agencyPrice.Plan == "" {
		t.Fatalf("expected agency-plus price in sync request: %+v", stripe.syncRequest.Prices)
	}
	if agencyPrice.UnitAmountCents != 79900 {
		t.Fatalf("expected agency-plus tier amount 79900, got %d", agencyPrice.UnitAmountCents)
	}
	if agencyPrice.MonthlyQuota != 500 || agencyPrice.ModelSelectionLimit != 8 || agencyPrice.MaxProjects != 12 {
		t.Fatalf("expected plan limits on price metadata, got %+v", agencyPrice)
	}
	if agencyPrice.LookupKey != "admin-pricing:agency-plus:250:monthly" {
		t.Fatalf("unexpected lookup key: %s", agencyPrice.LookupKey)
	}
}

func TestSyncStripePricingCatalogDisabled(t *testing.T) {
	svc := NewService(&fakeRepo{})
	_, err := svc.SyncStripePricingCatalog(context.Background(), "growth")
	if !errors.Is(err, ErrStripeDisabled) {
		t.Fatalf("expected ErrStripeDisabled, got %v", err)
	}
}

func TestSyncStripePricingCatalogRejectsMissingPlan(t *testing.T) {
	svc := NewService(&fakeRepo{})
	svc.EnableStripe(&fakeStripeProvider{}, StripeCatalog{}, "", "", "")
	_, err := svc.SyncStripePricingCatalog(context.Background(), "missing-plan")
	if !errors.Is(err, ErrStripeInvalidRequest) {
		t.Fatalf("expected ErrStripeInvalidRequest, got %v", err)
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

func TestCreateStripeCheckoutSession_CustomPlanUsesAdminPricingLookup(t *testing.T) {
	agencyPrice := priceCents(219900)
	repo := &fakeRepo{
		planSettings: map[string]domain.PlanSettings{
			"agency-plus": {
				Plan:                    "agency-plus",
				MonthlyQuota:            500,
				ModelSelectionLimit:     8,
				MonthlyModelChangeLimit: 2,
				MaxProjects:             12,
			},
		},
		pricingTiers: map[int]domain.PricingTier{
			1000: {
				PromptVolume: 1000,
				Label:        "1k",
				Prices: map[string]*int{
					"agency-plus": agencyPrice,
				},
			},
		},
	}
	stripe := &fakeStripeProvider{
		checkoutResp: StripeCheckoutSession{
			ID:  "cs_custom",
			URL: "https://checkout.stripe.com/c/pay/cs_custom",
		},
		priceIDs: map[string]string{
			"admin-pricing:agency-plus:1000:monthly": "price_agency_plus_1k",
		},
	}
	svc := NewService(repo)
	svc.EnableStripe(stripe, StripeCatalog{}, "https://app.local/success", "https://app.local/cancel", "https://app.local/portal")

	out, err := svc.CreateStripeCheckoutSession(context.Background(), CreateStripeCheckoutSessionInput{
		OrganizationID: 42,
		Plan:           "agency-plus",
		BillingCycle:   domain.BillingCycleMonthly,
		PromptVolume:   1000,
		Seats:          1,
		RequestID:      "req_custom",
	})
	if err != nil {
		t.Fatalf("unexpected custom checkout error: %v", err)
	}
	if out.SessionID != "cs_custom" {
		t.Fatalf("unexpected checkout output: %+v", out)
	}
	if stripe.priceLookup != "admin-pricing:agency-plus:1000:monthly" {
		t.Fatalf("expected admin pricing lookup key, got %s", stripe.priceLookup)
	}
	if stripe.lastRequest.PriceID != "price_agency_plus_1k" {
		t.Fatalf("expected custom stripe price id, got %s", stripe.lastRequest.PriceID)
	}
	if stripe.lastRequest.MonthlyQuota != 500 {
		t.Fatalf("expected custom monthly quota 500, got %d", stripe.lastRequest.MonthlyQuota)
	}
}

func TestCreateStripeCheckoutSession_CustomPlanRequiresSyncedStripePrice(t *testing.T) {
	agencyPrice := priceCents(219900)
	repo := &fakeRepo{
		planSettings: map[string]domain.PlanSettings{
			"agency-plus": {Plan: "agency-plus", MonthlyQuota: 500},
		},
		pricingTiers: map[int]domain.PricingTier{
			1000: {
				PromptVolume: 1000,
				Label:        "1k",
				Prices: map[string]*int{
					"agency-plus": agencyPrice,
				},
			},
		},
	}
	stripe := &fakeStripeProvider{
		checkoutResp: StripeCheckoutSession{
			ID:  "cs_custom",
			URL: "https://checkout.stripe.com/c/pay/cs_custom",
		},
		priceIDs: map[string]string{},
	}
	svc := NewService(repo)
	svc.EnableStripe(stripe, StripeCatalog{}, "https://app.local/success", "https://app.local/cancel", "https://app.local/portal")

	_, err := svc.CreateStripeCheckoutSession(context.Background(), CreateStripeCheckoutSessionInput{
		OrganizationID: 42,
		Plan:           "agency-plus",
		BillingCycle:   domain.BillingCycleMonthly,
		PromptVolume:   1000,
		Seats:          1,
	})
	if !errors.Is(err, ErrStripeInvalidRequest) {
		t.Fatalf("expected invalid request for missing synced price, got %v", err)
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
