import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON } from "@/shared/api/gateway";
import { normalizeBillingPlan, type SimulatedPlan } from "@/shared/billing-plan";

type JsonObject = Record<string, unknown>;

export type BillingEntitlements = {
  organizationId: string;
  plan: SimulatedPlan | null;
  subscriptionStatus: string;
  isPaid: boolean;
  monthlyQuota: number;
  seats: number;
  modelSelectionLimit: number;
  monthlyModelChangeLimit: number;
};

export type BillingSubscriptionUpdateInput = {
  organizationId: string;
  plan: SimulatedPlan;
  monthlyQuota: number;
  seats: number;
};

export type BillingPlanSettings = {
  plan: SimulatedPlan;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  monthlyQuota: number;
  modelSelectionLimit: number;
  monthlyModelChangeLimit: number;
};

export type BillingPlanSettingsUpdateInput = BillingPlanSettings & {
  organizationId: string;
};

export type BillingPricingTier = {
  promptVolume: number;
  label: string;
  developerPriceCents: number | null;
  starterPriceCents: number | null;
  growthPriceCents: number | null;
  proPriceCents: number | null;
};

export type BillingPricingTierUpdateInput = BillingPricingTier & {
  organizationId: string;
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

export function normalizeBillingEntitlements(value: unknown): BillingEntitlements {
  const payload = asObject(value);

  return {
    organizationId: asString(payload.organization_id),
    plan: normalizeBillingPlan(asString(payload.plan) || null),
    subscriptionStatus: asString(payload.subscription_status),
    isPaid: payload.is_paid === true,
    monthlyQuota: asNumber(payload.monthly_quota),
    seats: asNumber(payload.seats),
    modelSelectionLimit: asNumber(payload.model_selection_limit),
    monthlyModelChangeLimit: asNumber(payload.monthly_model_change_limit),
  };
}

export function normalizeBillingPlanSettings(value: unknown): BillingPlanSettings | null {
  const payload = asObject(value);
  const plan = normalizeBillingPlan(asString(payload.plan) || null);
  if (plan === null) return null;

  return {
    plan,
    monthlyPriceCents: asNumber(payload.monthly_price_cents),
    yearlyPriceCents: asNumber(payload.yearly_price_cents),
    monthlyQuota: asNumber(payload.monthly_quota),
    modelSelectionLimit: asNumber(payload.model_selection_limit),
    monthlyModelChangeLimit: asNumber(payload.monthly_model_change_limit),
  };
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return asNumber(value);
}

export function normalizeBillingPricingTier(value: unknown): BillingPricingTier | null {
  const payload = asObject(value);
  const promptVolume = asNumber(payload.prompt_volume);
  if (promptVolume <= 0) return null;

  return {
    promptVolume,
    label: asString(payload.label) || String(promptVolume),
    developerPriceCents: asNullableNumber(payload.developer_price_cents),
    starterPriceCents: asNullableNumber(payload.starter_price_cents),
    growthPriceCents: asNullableNumber(payload.growth_price_cents),
    proPriceCents: asNullableNumber(payload.pro_price_cents),
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
    throw new Error("Impossible de charger les informations de facturation.");
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
    throw new Error(result.error || "Impossible de mettre a jour l'abonnement.");
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
    throw new Error(result.error || "Impossible de charger les plans.");
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
    }),
  });

  if (!result.ok) {
    throw new Error(result.error || "Impossible de mettre a jour ce plan.");
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
    throw new Error(result.error || "Impossible de charger les paliers pricing.");
  }

  return (Array.isArray(result.data) ? result.data : [])
    .map(normalizeBillingPricingTier)
    .filter((tier): tier is BillingPricingTier => tier !== null);
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
        label: input.label,
        developer_price_cents: input.developerPriceCents,
        starter_price_cents: input.starterPriceCents,
        growth_price_cents: input.growthPriceCents,
        pro_price_cents: input.proPriceCents,
      }),
    },
  );

  if (!result.ok) {
    throw new Error(result.error || "Impossible de mettre a jour ce palier.");
  }

  const tier = normalizeBillingPricingTier(result.data);
  if (!tier) {
    throw new Error("Reponse palier invalide.");
  }
  return tier;
}
