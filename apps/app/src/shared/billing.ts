import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON } from "@/shared/api/gateway";
import { normalizeBillingPlan, type SimulatedPlan } from "@/shared/billing-plan";

type JsonObject = Record<string, unknown>;

export type BillingEntitlements = {
  organizationId: string;
  plan: SimulatedPlan | null;
  monthlyQuota: number;
  seats: number;
  modelSelectionLimit: number;
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
    monthlyQuota: asNumber(payload.monthly_quota),
    seats: asNumber(payload.seats),
    modelSelectionLimit: asNumber(payload.model_selection_limit),
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
