package stripeadapter

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/bastiencouder/microservices-go/services/billing-service/internal/usecase"
)

func TestSyncPricingCatalogCreatesMissingProductAndPrice(t *testing.T) {
	var productCreateForm url.Values
	var priceCreateForm url.Values
	requests := make([]string, 0)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests = append(requests, r.Method+" "+r.URL.Path)
		if got := r.Header.Get("Authorization"); got != "Bearer sk_test_123" {
			t.Fatalf("unexpected authorization header: %s", got)
		}

		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/v1/products/prod_admin_pricing_growth":
			writeStripeError(w, http.StatusNotFound, "No such product")
		case r.Method == http.MethodPost && r.URL.Path == "/v1/products":
			if err := r.ParseForm(); err != nil {
				t.Fatalf("parse product form: %v", err)
			}
			productCreateForm = cloneValues(r.PostForm)
			_ = json.NewEncoder(w).Encode(map[string]any{"id": "prod_admin_pricing_growth"})
		case r.Method == http.MethodGet && r.URL.Path == "/v1/prices":
			if got := r.URL.Query().Get("lookup_keys[0]"); got != "admin-pricing:growth:250:monthly" {
				t.Fatalf("unexpected lookup key query: %s", got)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"data": []any{}})
		case r.Method == http.MethodPost && r.URL.Path == "/v1/prices":
			if err := r.ParseForm(); err != nil {
				t.Fatalf("parse price form: %v", err)
			}
			priceCreateForm = cloneValues(r.PostForm)
			_ = json.NewEncoder(w).Encode(map[string]any{"id": "price_123"})
		default:
			t.Fatalf("unexpected stripe request %s %s", r.Method, r.URL.String())
		}
	}))
	defer server.Close()

	client := NewClient("sk_test_123", "")
	client.baseURL = server.URL
	client.httpClient = server.Client()

	result, err := client.SyncPricingCatalog(context.Background(), usecase.StripePricingCatalogSyncRequest{
		Products: []usecase.StripePricingCatalogProduct{
			{
				ID:                      "prod_admin_pricing_growth",
				Plan:                    "growth",
				Name:                    "Growth",
				MonthlyQuota:            250,
				ModelSelectionLimit:     6,
				MonthlyModelChangeLimit: 2,
				MaxProjects:             5,
			},
		},
		Prices: []usecase.StripePricingCatalogPrice{
			{
				LookupKey:               "admin-pricing:growth:250:monthly",
				ProductID:               "prod_admin_pricing_growth",
				Plan:                    "growth",
				TierLabel:               "250",
				PromptVolume:            250,
				UnitAmountCents:         49900,
				Currency:                "eur",
				Interval:                "month",
				MonthlyQuota:            250,
				ModelSelectionLimit:     6,
				MonthlyModelChangeLimit: 2,
				MaxProjects:             5,
			},
		},
	})
	if err != nil {
		t.Fatalf("sync pricing catalog: %v", err)
	}
	if result.ProductsCreated != 1 || result.PricesCreated != 1 {
		t.Fatalf("unexpected sync result: %+v", result)
	}
	if strings.Join(requests, ",") != "POST /v1/products/prod_admin_pricing_growth,POST /v1/products,GET /v1/prices,POST /v1/prices" {
		t.Fatalf("unexpected request sequence: %+v", requests)
	}
	if productCreateForm.Get("id") != "prod_admin_pricing_growth" || productCreateForm.Get("metadata[plan]") != "growth" {
		t.Fatalf("unexpected product form: %+v", productCreateForm)
	}
	if priceCreateForm.Get("product") != "prod_admin_pricing_growth" ||
		priceCreateForm.Get("lookup_key") != "admin-pricing:growth:250:monthly" ||
		priceCreateForm.Get("transfer_lookup_key") != "true" ||
		priceCreateForm.Get("unit_amount") != "49900" ||
		priceCreateForm.Get("recurring[interval]") != "month" {
		t.Fatalf("unexpected price form: %+v", priceCreateForm)
	}
}

func writeStripeError(w http.ResponseWriter, status int, message string) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error": map[string]any{"message": message},
	})
}

func cloneValues(values url.Values) url.Values {
	clone := make(url.Values, len(values))
	for key, items := range values {
		clone[key] = append([]string(nil), items...)
	}
	return clone
}
