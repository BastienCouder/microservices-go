import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON, toGatewayError } from "@/shared/api/gateway";
import { normalizeBillingPlan } from "@/shared/billing-plan";

type JsonObject = Record<string, unknown>;
export type BillingPlanCode = string;
export type BillingPriceMap = Record<string, number | null>;

export type BillingEntitlements = {
  organizationId: string;
  plan: BillingPlanCode | null;
  subscriptionStatus: string;
  isPaid: boolean;
  monthlyQuota: number;
  seats: number;
  modelSelectionLimit: number;
  monthlyModelChangeLimit: number;
  maxProjects: number;
  allowAiBriefs: boolean;
};

export type BillingSubscriptionUpdateInput = {
  organizationId: string;
  plan: BillingPlanCode;
  monthlyQuota: number;
  seats: number;
};

export type BillingPlanSettings = {
  plan: BillingPlanCode;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  monthlyQuota: number;
  modelSelectionLimit: number;
  monthlyModelChangeLimit: number;
  maxProjects: number;
  allowAiBriefs: boolean;
  isMostChosen: boolean;
};

export type BillingPlanSettingsUpdateInput = BillingPlanSettings & {
  organizationId: string;
};

export type BillingPricingTier = {
  promptVolume: number;
  creditVolume: number;
  label: string;
  prices: BillingPriceMap;
  developerPriceCents: number | null;
  starterPriceCents: number | null;
  growthPriceCents: number | null;
  proPriceCents: number | null;
};

export type BillingPricingTierUpdateInput = BillingPricingTier & {
  organizationId: string;
};

export type BillingCreditCostRule = {
  minPricePerMillion: number;
  creditCost: number;
};

export type BillingCreditCostSettings = {
  defaultCreditCost: number;
  rules: BillingCreditCostRule[];
};

export type BillingCreditCostSettingsUpdateInput = BillingCreditCostSettings & {
  organizationId: string;
};

export type StripePricingCatalogSyncResult = {
  productsCreated: number;
  productsUpdated: number;
  pricesCreated: number;
  pricesReused: number;
};

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" ? (value as JsonObject) : {};
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function asPlanCode(value: unknown): BillingPlanCode | null {
  const plan = normalizeBillingPlan(asString(value) || null);
  return plan === null ? null : plan;
}

export function normalizeBillingEntitlements(value: unknown): BillingEntitlements {
  const payload = asObject(value);

  return {
    organizationId: asString(payload.organization_id),
    plan: asPlanCode(payload.plan),
    subscriptionStatus: asString(payload.subscription_status),
    isPaid: payload.is_paid === true,
    monthlyQuota: asNumber(payload.monthly_quota),
    seats: asNumber(payload.seats),
    modelSelectionLimit: asNumber(payload.model_selection_limit),
    monthlyModelChangeLimit: asNumber(payload.monthly_model_change_limit),
    maxProjects: asNumber(payload.max_projects),
    allowAiBriefs: payload.allow_ai_briefs === true,
  };
}

export function normalizeBillingPlanSettings(value: unknown): BillingPlanSettings | null {
  const payload = asObject(value);
  const plan = asPlanCode(payload.plan);
  if (plan === null) return null;

  return {
    plan,
    monthlyPriceCents: asNumber(payload.monthly_price_cents),
    yearlyPriceCents: asNumber(payload.yearly_price_cents),
    monthlyQuota: asNumber(payload.monthly_quota),
    modelSelectionLimit: asNumber(payload.model_selection_limit),
    monthlyModelChangeLimit: asNumber(payload.monthly_model_change_limit),
    maxProjects: asNumber(payload.max_projects),
    allowAiBriefs: payload.allow_ai_briefs === true,
    isMostChosen: payload.is_most_chosen === true,
  };
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return asNumber(value);
}

function asNullablePriceMap(value: unknown): BillingPriceMap {
  if (!value || typeof value !== "object") return {};
  const prices: BillingPriceMap = {};
  for (const [plan, price] of Object.entries(value as JsonObject)) {
    const normalizedPlan = asPlanCode(plan);
    if (!normalizedPlan) continue;
    prices[normalizedPlan] = asNullableNumber(price);
  }
  return prices;
}

export function normalizeBillingPricingTier(value: unknown): BillingPricingTier | null {
  const payload = asObject(value);
  const creditVolume = asNumber(payload.credit_volume) || asNumber(payload.prompt_volume);
  const promptVolume = creditVolume;
  if (promptVolume <= 0) return null;

  const prices = asNullablePriceMap(payload.prices);
  const developerPriceCents =
    prices.developer ?? asNullableNumber(payload.developer_price_cents);
  const starterPriceCents =
    prices.starter ?? asNullableNumber(payload.starter_price_cents);
  const growthPriceCents =
    prices.growth ?? asNullableNumber(payload.growth_price_cents);
  const proPriceCents =
    prices.pro ?? asNullableNumber(payload.pro_price_cents);

  return {
    promptVolume,
    creditVolume,
    label: asString(payload.label) || String(promptVolume),
    prices: {
      ...prices,
      ...(developerPriceCents !== null || "developer" in prices
        ? { developer: developerPriceCents }
        : {}),
      ...(starterPriceCents !== null || "starter" in prices
        ? { starter: starterPriceCents }
        : {}),
      ...(growthPriceCents !== null || "growth" in prices
        ? { growth: growthPriceCents }
        : {}),
      ...(proPriceCents !== null || "pro" in prices ? { pro: proPriceCents } : {}),
    },
    developerPriceCents,
    starterPriceCents,
    growthPriceCents,
    proPriceCents,
  };
}

export function normalizeBillingCreditCostSettings(value: unknown): BillingCreditCostSettings {
  const payload = asObject(value);
  const rules = Array.isArray(payload.rules)
    ? payload.rules
        .map((entry) => {
          const item = asObject(entry);
          const minPricePerMillion =
            typeof item.min_price_per_million === "number" &&
            Number.isFinite(item.min_price_per_million) &&
            item.min_price_per_million >= 0
              ? item.min_price_per_million
              : 0;
          const creditCost = asNumber(item.credit_cost);
          if (creditCost <= 0) return null;
          return { minPricePerMillion, creditCost };
        })
        .filter((rule): rule is BillingCreditCostRule => rule !== null)
    : [];

  return {
    defaultCreditCost: Math.max(1, asNumber(payload.default_credit_cost) || 1),
    rules,
  };
}

export async function loadBillingEntitlements(
  apiBaseURL: string,
  organizationId: string,
  options?: { signal?: AbortSignal },
): Promise<BillingEntitlements> {
  const result = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.billing.quota(organizationId),
    {
      method: "GET",
      organizationId,
      signal: options?.signal,
    },
  );

  if (!result.ok) {
    throw toGatewayError(result, "Impossible de charger les informations de facturation.");
  }

  return normalizeBillingEntitlements(result.data);
}

export async function updateBillingSubscription(
  apiBaseURL: string,
  input: BillingSubscriptionUpdateInput,
): Promise<void> {
  const organizationID = Number.parseInt(input.organizationId, 10);
  if (!Number.isFinite(organizationID) || organizationID <= 0) {
    throw new Error("Organisation invalide.");
  }

  const result = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.billing.subscriptions(),
    {
      method: "POST",
      organizationId: input.organizationId,
      body: JSON.stringify({
        organization_id: organizationID,
        plan: input.plan,
        seats: Math.max(1, Math.floor(input.seats)),
        monthly_quota: Math.max(1, Math.floor(input.monthlyQuota)),
      }),
    },
  );

  if (!result.ok) {
    throw toGatewayError(result, "Impossible de mettre a jour l'abonnement.");
  }
}

export async function loadBillingPlanSettings(
  apiBaseURL: string,
  organizationId: string,
  options?: { signal?: AbortSignal },
): Promise<BillingPlanSettings[]> {
  const result = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.billing.plans(), {
    method: "GET",
    organizationId,
    signal: options?.signal,
  });

  if (!result.ok) {
    throw toGatewayError(result, "Impossible de charger les plans.");
  }

  return (Array.isArray(result.data) ? result.data : [])
    .map(normalizeBillingPlanSettings)
    .filter((settings): settings is BillingPlanSettings => settings !== null);
}

export async function updateBillingPlanSettings(
  apiBaseURL: string,
  input: BillingPlanSettingsUpdateInput,
): Promise<BillingPlanSettings> {
  const result = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.billing.plans(), {
    method: "POST",
    organizationId: input.organizationId,
    body: JSON.stringify({
      plan: input.plan,
      monthly_price_cents: Math.max(0, Math.floor(input.monthlyPriceCents)),
      yearly_price_cents: Math.max(0, Math.floor(input.yearlyPriceCents)),
      monthly_quota: Math.max(1, Math.floor(input.monthlyQuota)),
      model_selection_limit: Math.max(0, Math.floor(input.modelSelectionLimit)),
      monthly_model_change_limit: Math.max(0, Math.floor(input.monthlyModelChangeLimit)),
      max_projects: Math.max(0, Math.floor(input.maxProjects)),
      allow_ai_briefs: input.allowAiBriefs === true,
      is_most_chosen: input.isMostChosen === true,
    }),
  });

  if (!result.ok) {
    throw toGatewayError(result, "Impossible de mettre a jour ce plan.");
  }

  const settings = normalizeBillingPlanSettings(result.data);
  if (!settings) {
    throw new Error("Reponse plan invalide.");
  }
  return settings;
}

export async function loadBillingPricingTiers(
  apiBaseURL: string,
  organizationId: string,
  options?: { signal?: AbortSignal },
): Promise<BillingPricingTier[]> {
  const result = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.billing.pricingTiers(),
    {
      method: "GET",
      organizationId,
      signal: options?.signal,
    },
  );

  if (!result.ok) {
    throw toGatewayError(result, "Impossible de charger les paliers pricing.");
  }

  return (Array.isArray(result.data) ? result.data : [])
    .map(normalizeBillingPricingTier)
    .filter((tier): tier is BillingPricingTier => tier !== null);
}

export async function loadBillingCreditCostSettings(
  apiBaseURL: string,
  organizationId: string,
  options?: { signal?: AbortSignal },
): Promise<BillingCreditCostSettings> {
  const result = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.billing.creditCostSettings(),
    {
      method: "GET",
      organizationId,
      signal: options?.signal,
    },
  );

  if (!result.ok) {
    throw toGatewayError(result, "Impossible de charger les regles de credits.");
  }

  return normalizeBillingCreditCostSettings(result.data);
}

export async function updateBillingCreditCostSettings(
  apiBaseURL: string,
  input: BillingCreditCostSettingsUpdateInput,
): Promise<BillingCreditCostSettings> {
  const result = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.billing.creditCostSettings(),
    {
      method: "POST",
      organizationId: input.organizationId,
      body: JSON.stringify({
        default_credit_cost: Math.max(1, Math.floor(input.defaultCreditCost)),
        rules: input.rules.map((rule) => ({
          min_price_per_million: Math.max(0, rule.minPricePerMillion),
          credit_cost: Math.max(1, Math.floor(rule.creditCost)),
        })),
      }),
    },
  );

  if (!result.ok) {
    throw toGatewayError(result, "Impossible de mettre a jour les regles de credits.");
  }

  return normalizeBillingCreditCostSettings(result.data);
}

export async function updateBillingPricingTier(
  apiBaseURL: string,
  input: BillingPricingTierUpdateInput,
): Promise<BillingPricingTier> {
  const result = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.billing.pricingTiers(),
    {
      method: "POST",
      organizationId: input.organizationId,
      body: JSON.stringify({
        prompt_volume: Math.max(1, Math.floor(input.promptVolume)),
        credit_volume: Math.max(1, Math.floor(input.creditVolume || input.promptVolume)),
        label: input.label,
        prices: input.prices,
        developer_price_cents: input.developerPriceCents,
        starter_price_cents: input.starterPriceCents,
        growth_price_cents: input.growthPriceCents,
        pro_price_cents: input.proPriceCents,
      }),
    },
  );

  if (!result.ok) {
    throw toGatewayError(result, "Impossible de mettre a jour ce palier.");
  }

  const tier = normalizeBillingPricingTier(result.data);
  if (!tier) {
    throw new Error("Reponse palier invalide.");
  }
  return tier;
}

export async function deleteBillingPricingTier(
  apiBaseURL: string,
  organizationId: string,
  promptVolume: number,
): Promise<void> {
  const result = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.billing.pricingTier(promptVolume),
    {
      method: "DELETE",
      organizationId,
    },
  );

  if (!result.ok) {
    throw toGatewayError(result, "Impossible de supprimer ce palier.");
  }
}

export async function syncStripePricingCatalog(
  apiBaseURL: string,
  organizationId: string,
  plan: BillingPlanCode,
): Promise<StripePricingCatalogSyncResult> {
  const result = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.billing.stripePricingCatalogSync(plan),
    {
      method: "POST",
      organizationId,
      body: JSON.stringify({}),
    },
  );

  if (!result.ok) {
    throw toGatewayError(result, "Impossible de pousser le pricing vers Stripe.");
  }

  const payload = asObject(result.data);
  return {
    productsCreated: asNumber(payload.products_created),
    productsUpdated: asNumber(payload.products_updated),
    pricesCreated: asNumber(payload.prices_created),
    pricesReused: asNumber(payload.prices_reused),
  };
}
