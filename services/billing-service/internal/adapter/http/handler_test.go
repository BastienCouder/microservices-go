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
	subs map[int64]*domain.Subscription
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

func (m *memoryRepo) RecordStripeWebhookEvent(_ context.Context, _, _ string, _ time.Time) (bool, error) {
	return true, nil
}

type noopStripeProvider struct{}

func (n *noopStripeProvider) CreateSubscriptionCheckoutSession(_ context.Context, _ usecase.StripeCheckoutSessionRequest) (usecase.StripeCheckoutSession, error) {
	return usecase.StripeCheckoutSession{
		ID:  "cs_test",
		URL: "https://checkout.stripe.com/c/pay/cs_test",
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
}
