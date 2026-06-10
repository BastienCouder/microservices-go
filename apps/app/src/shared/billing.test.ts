import { describe, expect, test } from "bun:test";

import {
  normalizeBillingEntitlements,
  normalizeBillingPlanSettings,
  normalizeBillingPricingTier,
  updateBillingPlanSettings,
  updateBillingPricingTier,
  syncStripePricingCatalog,
  updateBillingSubscription,
} from "./billing";

describe("billing entitlements", () => {
  test("normalizes subscription status and paid flag", () => {
    expect(
      normalizeBillingEntitlements({
        organization_id: 7,
        plan: "growth",
        subscription_status: "active",
        is_paid: true,
        monthly_quota: 200,
        seats: 3,
        model_selection_limit: 6,
        monthly_model_change_limit: 2,
        allow_ai_briefs: true,
      }),
    ).toEqual({
      organizationId: "7",
      plan: "growth",
      subscriptionStatus: "active",
      isPaid: true,
      monthlyQuota: 200,
      seats: 3,
      modelSelectionLimit: 6,
      monthlyModelChangeLimit: 2,
      maxProjects: 0,
      allowAiBriefs: true,
    });
  });

  test("defaults missing paid data to unpaid", () => {
    expect(
      normalizeBillingEntitlements({
        organization_id: 7,
        plan: "starter",
      }).isPaid,
    ).toBe(false);
  });
});

describe("billing plan settings", () => {
  test("normalizes plan settings", () => {
    expect(
      normalizeBillingPlanSettings({
        plan: "pro",
        monthly_price_cents: 39900,
        yearly_price_cents: 31900,
        monthly_quota: 1000,
        model_selection_limit: 12,
        monthly_model_change_limit: 4,
        max_projects: 10,
        allow_ai_briefs: true,
        is_most_chosen: true,
      }),
    ).toEqual({
      plan: "pro",
      monthlyPriceCents: 39900,
      yearlyPriceCents: 31900,
      monthlyQuota: 1000,
      modelSelectionLimit: 12,
      monthlyModelChangeLimit: 4,
      maxProjects: 10,
      allowAiBriefs: true,
      isMostChosen: true,
    });
  });

  test("keeps custom plan identifiers for admin pricing", () => {
    expect(
      normalizeBillingPlanSettings({
        plan: "agency-plus",
        monthly_price_cents: 9900,
        yearly_price_cents: 7900,
        monthly_quota: 500,
        model_selection_limit: 8,
        monthly_model_change_limit: 2,
        max_projects: 12,
        allow_ai_briefs: false,
      }),
    ).toEqual({
      plan: "agency-plus",
      monthlyPriceCents: 9900,
      yearlyPriceCents: 7900,
      monthlyQuota: 500,
      modelSelectionLimit: 8,
      monthlyModelChangeLimit: 2,
      maxProjects: 12,
      allowAiBriefs: false,
      isMostChosen: false,
    });
  });

  test("sends plan settings with gateway organization scope", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          plan: "pro",
          monthly_price_cents: 49900,
          yearly_price_cents: 39900,
          monthly_quota: 1200,
          model_selection_limit: 12,
          monthly_model_change_limit: 4,
          max_projects: 15,
          allow_ai_briefs: true,
          is_most_chosen: true,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }) as typeof fetch;

    try {
      await updateBillingPlanSettings("https://api.test", {
        organizationId: "7",
        plan: "pro",
        monthlyPriceCents: 49900,
        yearlyPriceCents: 39900,
        monthlyQuota: 1200,
        modelSelectionLimit: 12,
        monthlyModelChangeLimit: 4,
        maxProjects: 15,
        allowAiBriefs: true,
        isMostChosen: true,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.test/billing/plans");
    expect(new Headers(calls[0]?.init?.headers).get("X-Organization-ID")).toBe("7");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      plan: "pro",
      monthly_price_cents: 49900,
      yearly_price_cents: 39900,
      monthly_quota: 1200,
      model_selection_limit: 12,
      monthly_model_change_limit: 4,
      max_projects: 15,
      allow_ai_briefs: true,
      is_most_chosen: true,
    });
  });
});

describe("billing pricing tiers", () => {
  test("normalizes null prices as custom/unavailable", () => {
    expect(
      normalizeBillingPricingTier({
        credit_volume: 1000,
        label: "1k",
        prices: {
          developer: 24900,
          starter: null,
          growth: 89900,
          pro: 149900,
          "agency-plus": 219900,
        },
        developer_price_cents: 24900,
        starter_price_cents: null,
        growth_price_cents: 89900,
        pro_price_cents: 149900,
      }),
    ).toEqual({
      promptVolume: 1000,
      creditVolume: 1000,
      label: "1k",
      prices: {
        developer: 24900,
        starter: null,
        growth: 89900,
        pro: 149900,
        "agency-plus": 219900,
      },
      developerPriceCents: 24900,
      starterPriceCents: null,
      growthPriceCents: 89900,
      proPriceCents: 149900,
    });
  });

  test("sends pricing tier with gateway organization scope", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          prompt_volume: 1000,
          label: "1k",
          prices: {
            developer: 24900,
            starter: null,
            growth: 89900,
            pro: 149900,
            "agency-plus": 219900,
          },
          developer_price_cents: 24900,
          starter_price_cents: null,
          growth_price_cents: 89900,
          pro_price_cents: 149900,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }) as typeof fetch;

    try {
      await updateBillingPricingTier("https://api.test", {
        organizationId: "7",
        promptVolume: 1000,
        creditVolume: 1000,
        label: "1k",
        prices: {
          developer: 24900,
          starter: null,
          growth: 89900,
          pro: 149900,
          "agency-plus": 219900,
        },
        developerPriceCents: 24900,
        starterPriceCents: null,
        growthPriceCents: 89900,
        proPriceCents: 149900,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.test/billing/pricing-tiers");
    expect(new Headers(calls[0]?.init?.headers).get("X-Organization-ID")).toBe("7");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      prompt_volume: 1000,
      credit_volume: 1000,
      label: "1k",
      prices: {
        developer: 24900,
        starter: null,
        growth: 89900,
        pro: 149900,
        "agency-plus": 219900,
      },
      developer_price_cents: 24900,
      starter_price_cents: null,
      growth_price_cents: 89900,
      pro_price_cents: 149900,
    });
  });
});

describe("stripe pricing catalog sync", () => {
  test("sends catalog sync with gateway organization scope", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          products_created: 1,
          products_updated: 4,
          prices_created: 20,
          prices_reused: 1,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }) as typeof fetch;

    try {
      await syncStripePricingCatalog("https://api.test", "7", "agency-plus");
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      "https://api.test/billing/stripe/pricing-catalog/plans/agency-plus/sync",
    );
    expect(new Headers(calls[0]?.init?.headers).get("X-Organization-ID")).toBe("7");
    expect(calls[0]?.init?.method).toBe("POST");
  });
});

describe("billing subscription admin update", () => {
  test("sends the selected organization as body and gateway scope", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ organization_id: 7, plan: "growth" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      await updateBillingSubscription("https://api.test", {
        organizationId: "7",
        plan: "growth",
        monthlyQuota: 250,
        seats: 3,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.test/billing/subscriptions");
    expect(new Headers(calls[0]?.init?.headers).get("X-Organization-ID")).toBe("7");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      organization_id: 7,
      plan: "growth",
      seats: 3,
      monthly_quota: 250,
    });
  });
});
