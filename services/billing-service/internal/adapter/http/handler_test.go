package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/domain"
	"github.com/bastiencouder/microservices-go/services/billing-service/internal/usecase"
)

type memoryRepo struct {
	subs         map[int64]*domain.Subscription
	planSettings map[string]domain.PlanSettings
	pricingTiers map[int]domain.PricingTier
}

func (m *memoryRepo) Upsert(_ context.Context, subscription *domain.Subscription) error {
	if m.subs == nil {
		m.subs = make(map[int64]*domain.Subscription)
	}
	cloned := *subscription
	m.subs[subscription.OrganizationID] = &cloned
	return nil
}

func (m *memoryRepo) GetByOrganizationID(_ context.Context, organizationID int64) (*domain.Subscription, error) {
	sub, ok := m.subs[organizationID]
	if !ok {
		return nil, domain.ErrSubscriptionMissing
	}
	cloned := *sub
	return &cloned, nil
}

func (m *memoryRepo) UpdateEntitlements(_ context.Context, organizationID int64, plan string, seats, monthlyQuota int, updatedAt time.Time) error {
	if m.subs == nil {
		m.subs = make(map[int64]*domain.Subscription)
	}
	sub, ok := m.subs[organizationID]
	if !ok {
		sub = &domain.Subscription{
			OrganizationID: organizationID,
			BillingCycle:   domain.BillingCycleMonthly,
			Status:         domain.SubscriptionStatusActive,
		}
	}
	cloned := *sub
	cloned.Plan = plan
	cloned.Seats = seats
	cloned.MonthlyQuota = monthlyQuota
	cloned.UpdatedAt = updatedAt
	m.subs[organizationID] = &cloned
	return nil
}

func (m *memoryRepo) UpdateDefaultQuotaForPlan(_ context.Context, plan string, previousMonthlyQuota, nextMonthlyQuota int, updatedAt time.Time) error {
	for organizationID, sub := range m.subs {
		if sub.Plan != plan || sub.MonthlyQuota != previousMonthlyQuota {
			continue
		}
		cloned := *sub
		cloned.MonthlyQuota = nextMonthlyQuota
		cloned.UpdatedAt = updatedAt
		m.subs[organizationID] = &cloned
	}
	return nil
}

func (m *memoryRepo) RecordStripeWebhookEvent(_ context.Context, _, _ string, _ time.Time) (bool, error) {
	return true, nil
}

func (m *memoryRepo) ListPlanSettings(_ context.Context) ([]domain.PlanSettings, error) {
	items := make([]domain.PlanSettings, 0, len(m.planSettings))
	for _, item := range m.planSettings {
		items = append(items, item)
	}
	return items, nil
}

func (m *memoryRepo) UpsertPlanSettings(_ context.Context, settings domain.PlanSettings) error {
	if m.planSettings == nil {
		m.planSettings = make(map[string]domain.PlanSettings)
	}
	if settings.IsMostChosen {
		for plan, item := range m.planSettings {
			item.IsMostChosen = false
			m.planSettings[plan] = item
		}
	}
	m.planSettings[settings.Plan] = settings
	return nil
}

func (m *memoryRepo) ListPricingTiers(_ context.Context) ([]domain.PricingTier, error) {
	items := make([]domain.PricingTier, 0, len(m.pricingTiers))
	for _, item := range m.pricingTiers {
		items = append(items, item)
	}
	return items, nil
}

func (m *memoryRepo) UpsertPricingTier(_ context.Context, tier domain.PricingTier) error {
	if m.pricingTiers == nil {
		m.pricingTiers = make(map[int]domain.PricingTier)
	}
	m.pricingTiers[tier.PromptVolume] = tier
	return nil
}

func (m *memoryRepo) DeletePricingTier(_ context.Context, promptVolume int) error {
	if m.pricingTiers == nil {
		m.pricingTiers = make(map[int]domain.PricingTier)
	}
	m.pricingTiers[promptVolume] = domain.PricingTier{
		PromptVolume: promptVolume,
		Label:        "deleted",
		Deleted:      true,
	}
	return nil
}

type noopStripeProvider struct{}

func (n *noopStripeProvider) CreateSubscriptionCheckoutSession(_ context.Context, _ usecase.StripeCheckoutSessionRequest) (usecase.StripeCheckoutSession, error) {
	return usecase.StripeCheckoutSession{
		ID:  "cs_test",
		URL: "https://checkout.stripe.com/c/pay/cs_test",
	}, nil
}

func (n *noopStripeProvider) FindPriceIDByLookupKey(_ context.Context, _ string) (string, error) {
	return "price_admin_pricing", nil
}

func (n *noopStripeProvider) SyncPricingCatalog(_ context.Context, _ usecase.StripePricingCatalogSyncRequest) (usecase.StripePricingCatalogSyncResult, error) {
	return usecase.StripePricingCatalogSyncResult{
		ProductsCreated: 1,
		ProductsUpdated: 4,
		PricesCreated:   20,
		PricesReused:    1,
	}, nil
}

func (n *noopStripeProvider) CreateCustomerPortalSession(_ context.Context, _ string, _, _ string) (string, error) {
	return "https://billing.stripe.com/p/session/test", nil
}

func (n *noopStripeProvider) ParseWebhookEvent(_ []byte, _ string) (usecase.StripeWebhookEvent, error) {
	return usecase.StripeWebhookEvent{}, nil
}

func TestCreateStripeCheckoutSessionRejectsOrganizationScopeMismatch(t *testing.T) {
	repo := &memoryRepo{}
	svc := usecase.NewService(repo)
	svc.EnableStripe(&noopStripeProvider{}, usecase.StripeCatalog{
		StarterMonthlyPriceID: "price_starter_m",
		GrowthMonthlyPriceID:  "price_growth_m",
		ProMonthlyPriceID:     "price_pro_m",
	}, "https://app.local/success", "https://app.local/cancel", "https://app.local/portal")

	h := NewHandler(svc, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodPost, "/billing/stripe/checkout-session", strings.NewReader(`{
		"organization_id": 99,
		"plan": "growth",
		"billing_cycle": "monthly",
		"seats": 1
	}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Organization-ID", "7")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestUpsertSubscriptionRejectsOrganizationScopeMismatch(t *testing.T) {
	repo := &memoryRepo{}
	svc := usecase.NewService(repo)
	h := NewHandler(svc, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodPost, "/billing/subscriptions", strings.NewReader(`{
		"organization_id": 99,
		"plan": "growth",
		"seats": 2,
		"monthly_quota": 250
	}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Organization-ID", "7")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", rec.Code, rec.Body.String())
	}
	if repo.subs[99] != nil {
		t.Fatalf("scope mismatch should not persist subscription: %+v", repo.subs[99])
	}
}

func TestUpsertSubscriptionPreservesStripeManagedFields(t *testing.T) {
	repo := &memoryRepo{
		subs: map[int64]*domain.Subscription{
			7: {
				OrganizationID:       7,
				Plan:                 domain.PlanStarter,
				Seats:                1,
				MonthlyQuota:         50,
				StripeCustomerID:     "cus_7",
				StripeSubscriptionID: "sub_7",
				StripePriceID:        "price_starter_m",
				BillingCycle:         domain.BillingCycleYearly,
				Status:               domain.SubscriptionStatusPastDue,
				CancelAtPeriodEnd:    true,
				CorrectionCredits:    3,
				UpdatedAt:            time.Now().UTC().Add(-time.Hour),
			},
		},
	}
	svc := usecase.NewService(repo)
	h := NewHandler(svc, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodPost, "/billing/subscriptions", strings.NewReader(`{
		"organization_id": 7,
		"plan": "growth",
		"seats": 2,
		"monthly_quota": 250
	}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Organization-ID", "7")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	stored := repo.subs[7]
	if stored.Plan != domain.PlanGrowth || stored.MonthlyQuota != 250 || stored.Seats != 2 {
		t.Fatalf("expected admin fields updated, got %+v", stored)
	}
	if stored.StripeCustomerID != "cus_7" ||
		stored.StripeSubscriptionID != "sub_7" ||
		stored.StripePriceID != "price_starter_m" ||
		stored.BillingCycle != domain.BillingCycleYearly ||
		stored.Status != domain.SubscriptionStatusPastDue ||
		!stored.CancelAtPeriodEnd ||
		stored.CorrectionCredits != 3 {
		t.Fatalf("expected stripe-managed fields preserved, got %+v", stored)
	}
}

func TestCreateStripeCustomerPortalSessionUsesHeaderOrganizationScope(t *testing.T) {
	repo := &memoryRepo{
		subs: map[int64]*domain.Subscription{
			7: {
				OrganizationID:   7,
				Plan:             domain.PlanGrowth,
				Seats:            3,
				MonthlyQuota:     200,
				BillingCycle:     domain.BillingCycleMonthly,
				Status:           domain.SubscriptionStatusActive,
				StripeCustomerID: "cus_7",
				UpdatedAt:        time.Now().UTC(),
			},
		},
	}
	svc := usecase.NewService(repo)
	svc.EnableStripe(&noopStripeProvider{}, usecase.StripeCatalog{
		StarterMonthlyPriceID: "price_starter_m",
		GrowthMonthlyPriceID:  "price_growth_m",
		ProMonthlyPriceID:     "price_pro_m",
	}, "https://app.local/success", "https://app.local/cancel", "https://app.local/portal")

	h := NewHandler(svc, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodPost, "/billing/stripe/customer-portal", strings.NewReader(`{
		"return_url": "https://app.local/portal"
	}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Organization-ID", "7")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestGetQuotaRequiresMatchingOrganizationScope(t *testing.T) {
	repo := &memoryRepo{
		subs: map[int64]*domain.Subscription{
			7: {
				OrganizationID: 7,
				Plan:           domain.PlanGrowth,
				Seats:          3,
				MonthlyQuota:   200,
				BillingCycle:   domain.BillingCycleMonthly,
				Status:         domain.SubscriptionStatusActive,
				UpdatedAt:      time.Now().UTC(),
			},
		},
	}
	svc := usecase.NewService(repo)
	h := NewHandler(svc, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/billing/quotas/7", nil)
	req.Header.Set("X-Organization-ID", "8")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestGetQuotaIncludesServerManagedModelLimits(t *testing.T) {
	repo := &memoryRepo{
		subs: map[int64]*domain.Subscription{
			7: {
				OrganizationID: 7,
				Plan:           domain.PlanGrowth,
				Seats:          3,
				MonthlyQuota:   200,
				BillingCycle:   domain.BillingCycleMonthly,
				Status:         domain.SubscriptionStatusActive,
				UpdatedAt:      time.Now().UTC(),
			},
		},
	}
	svc := usecase.NewService(repo)
	h := NewHandler(svc, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodGet, "/billing/quotas/7", nil)
	req.Header.Set("X-Organization-ID", "7")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	body := rec.Body.String()
	if !strings.Contains(body, `"model_selection_limit":6`) {
		t.Fatalf("expected model selection limit in payload, got %s", body)
	}
	if !strings.Contains(body, `"monthly_model_change_limit":0`) {
		t.Fatalf("expected monthly model change limit in payload, got %s", body)
	}
	if !strings.Contains(body, `"max_projects":5`) {
		t.Fatalf("expected max projects in payload, got %s", body)
	}
	if !strings.Contains(body, `"subscription_status":"active"`) {
		t.Fatalf("expected subscription status in payload, got %s", body)
	}
	if !strings.Contains(body, `"is_paid":true`) {
		t.Fatalf("expected paid flag in payload, got %s", body)
	}
}

func TestUpdatePlanSettingsChangesQuotaEntitlements(t *testing.T) {
	repo := &memoryRepo{
		subs: map[int64]*domain.Subscription{
			7: {
				OrganizationID: 7,
				Plan:           domain.PlanPro,
				Seats:          3,
				MonthlyQuota:   1000000,
				BillingCycle:   domain.BillingCycleMonthly,
				Status:         domain.SubscriptionStatusActive,
				UpdatedAt:      time.Now().UTC(),
			},
		},
	}
	svc := usecase.NewService(repo)
	h := NewHandler(svc, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	updateReq := httptest.NewRequest(http.MethodPost, "/billing/plans", strings.NewReader(`{
		"plan": "pro",
		"monthly_price_cents": 49900,
		"yearly_price_cents": 39900,
		"monthly_quota": 1500,
		"model_selection_limit": 12,
		"monthly_model_change_limit": 4,
		"max_projects": 25
	}`))
	updateReq.Header.Set("Content-Type", "application/json")
	updateReq.Header.Set("X-Organization-ID", "7")
	updateRec := httptest.NewRecorder()
	mux.ServeHTTP(updateRec, updateReq)
	if updateRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", updateRec.Code, updateRec.Body.String())
	}

	quotaReq := httptest.NewRequest(http.MethodGet, "/billing/quotas/7", nil)
	quotaReq.Header.Set("X-Organization-ID", "7")
	quotaRec := httptest.NewRecorder()
	mux.ServeHTTP(quotaRec, quotaReq)
	if quotaRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", quotaRec.Code, quotaRec.Body.String())
	}
	body := quotaRec.Body.String()
	if !strings.Contains(body, `"model_selection_limit":12`) {
		t.Fatalf("expected updated model limit, got %s", body)
	}
	if !strings.Contains(body, `"monthly_model_change_limit":4`) {
		t.Fatalf("expected updated model change limit, got %s", body)
	}
	if !strings.Contains(body, `"monthly_quota":1500`) {
		t.Fatalf("expected default plan quota propagated, got %s", body)
	}
	if !strings.Contains(body, `"max_projects":25`) {
		t.Fatalf("expected max projects in entitlements, got %s", body)
	}
	if !strings.Contains(updateRec.Body.String(), `"monthly_quota":1500`) {
		t.Fatalf("expected updated plan quota in response, got %s", updateRec.Body.String())
	}
	if !strings.Contains(updateRec.Body.String(), `"max_projects":25`) {
		t.Fatalf("expected updated max projects in response, got %s", updateRec.Body.String())
	}
}

func TestUpdatePlanSettingsAcceptsCustomPlan(t *testing.T) {
	repo := &memoryRepo{}
	svc := usecase.NewService(repo)
	h := NewHandler(svc, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodPost, "/billing/plans", strings.NewReader(`{
		"plan": "agency-plus",
		"monthly_price_cents": 9900,
		"yearly_price_cents": 7900,
		"monthly_quota": 500,
		"model_selection_limit": 8,
		"monthly_model_change_limit": 2,
		"max_projects": 12
	}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Organization-ID", "7")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	body := rec.Body.String()
	if !strings.Contains(body, `"plan":"agency-plus"`) {
		t.Fatalf("expected custom plan in response, got %s", body)
	}
	if !strings.Contains(body, `"max_projects":12`) {
		t.Fatalf("expected custom plan max projects in response, got %s", body)
	}
}

func TestUpdatePricingTierAcceptsDynamicPlanPrices(t *testing.T) {
	repo := &memoryRepo{}
	svc := usecase.NewService(repo)
	h := NewHandler(svc, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodPost, "/billing/pricing-tiers", strings.NewReader(`{
		"prompt_volume": 250,
		"label": "250",
		"prices": {
			"starter": 24900,
			"growth": 49900,
			"agency-plus": 79900
		}
	}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Organization-ID", "7")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	body := rec.Body.String()
	if !strings.Contains(body, `"agency-plus":79900`) {
		t.Fatalf("expected custom plan price in response, got %s", body)
	}
}

func TestSyncStripePricingCatalogEndpointSyncsOnePlan(t *testing.T) {
	repo := &memoryRepo{}
	svc := usecase.NewService(repo)
	svc.EnableStripe(&noopStripeProvider{}, usecase.StripeCatalog{}, "", "", "")
	h := NewHandler(svc, nil)
	mux := http.NewServeMux()
	h.Register(mux)

	req := httptest.NewRequest(http.MethodPost, "/billing/stripe/pricing-catalog/plans/growth/sync", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Organization-ID", "7")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if !strings.Contains(body, `"products_created":1`) {
		t.Fatalf("expected sync result in response, got %s", body)
	}
	if !strings.Contains(body, `"prices_reused":1`) {
		t.Fatalf("expected price reuse count in response, got %s", body)
	}
}
