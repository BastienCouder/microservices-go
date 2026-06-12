import "server-only";

import type { PricingData } from "./pricing-types";
import {
  FINAL_PUBLIC_PLANS,
  normalizePlanSettings,
  normalizePricingTier,
  unwrapArray,
} from "./pricing-utils";

function createFinalPricingData(source: PricingData["source"]): PricingData {
  return {
    source,
    plans: FINAL_PUBLIC_PLANS.map((plan) => ({
      id: plan.id,
      publicName: plan.publicName,
      monthlyPrice: plan.monthlyPrice,
      annualMonthlyPrice: plan.annualMonthlyPrice,
      monthlyCredits: plan.monthlyCredits,
      maxProjects: plan.maxProjects,
      modelSelectionLimit: plan.modelSelectionLimit,
      seats: plan.seats,
      popular: plan.popular,
    })),
  };
}

export async function getPricingData(): Promise<PricingData> {
  const gatewayURL =
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "http://localhost:50000";

  const baseURL = gatewayURL.replace(/\/$/, "");

  try {
    const [plansResponse, tiersResponse] = await Promise.all([
      fetch(`${baseURL}/billing/public/plans`, {
        cache: "no-store",
      }),
      fetch(`${baseURL}/billing/public/pricing-tiers`, {
        cache: "no-store",
      }),
    ]);

    console.log("[Pricing Server] plansResponse:", {
      ok: plansResponse.ok,
      status: plansResponse.status,
      statusText: plansResponse.statusText,
      url: plansResponse.url,
    });

    console.log("[Pricing Server] tiersResponse:", {
      ok: tiersResponse.ok,
      status: tiersResponse.status,
      statusText: tiersResponse.statusText,
      url: tiersResponse.url,
    });

    if (!plansResponse.ok || !tiersResponse.ok) {
      throw new Error("pricing unavailable");
    }

    const [plansPayload, tiersPayload] = await Promise.all([
      plansResponse.json(),
      tiersResponse.json(),
    ]);

    console.log("[Pricing Server] raw plansPayload:", plansPayload);
    console.log("[Pricing Server] raw tiersPayload:", tiersPayload);

    const normalizedPlans = unwrapArray(plansPayload)
      .map(normalizePlanSettings)
      .filter((item) => item !== null);

    const normalizedTiers = unwrapArray(tiersPayload)
      .map((item) => normalizePricingTier(item))
      .filter((item) => item.credits > 0)
      .sort((left, right) => left.credits - right.credits);

    console.log("[Pricing Server] normalized plans:", normalizedPlans);
    console.log("[Pricing Server] normalized tiers:", normalizedTiers);

    console.log("[Pricing Server] public pricing grid:", FINAL_PUBLIC_PLANS);

    return createFinalPricingData("database");
  } catch (error) {
    console.error("[Pricing Server] failed, using fallback:", error);

    return createFinalPricingData("fallback");
  }
}