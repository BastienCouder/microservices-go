import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON, type GatewayResult } from "@/shared/api/gateway";
import { storeSelectedOrganizationID } from "@/shared/selection";
import type { SimulatedPlan } from "@/shared/billing-plan";

type JsonRecord = Record<string, unknown>;

export type BillingCycle = "monthly" | "yearly";
export type CheckoutPlan = Extract<SimulatedPlan, "starter" | "growth" | "pro">;

type CreateCheckoutInput = {
  organizationId: string;
  plan: CheckoutPlan;
  billingCycle: BillingCycle;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function unwrapData(value: unknown): unknown {
  if (isRecord(value) && value.success === true && "data" in value) {
    return value.data;
  }
  return value;
}

function getIDString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function requireGatewayData<T>(
  promise: Promise<GatewayResult<T>>,
  message: string,
): Promise<T> {
  const response = await promise;
  if (!response.ok) {
    throw new Error(response.error || message);
  }
  return response.data;
}

function parseNumericOrganizationId(organizationId: string): number {
  const value = Number.parseInt(organizationId, 10);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("L'identifiant de l'organisation est invalide pour Stripe.");
  }
  return value;
}

function getRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `checkout-${Date.now()}`;
}

export async function createBillingOrganization(
  apiBaseURL: string,
  name: string,
): Promise<string> {
  const organizationName = name.trim();
  if (!organizationName) {
    throw new Error("Le nom de l'organisation est obligatoire.");
  }

  const payload = await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.create(), {
      method: "POST",
      body: JSON.stringify({ name: organizationName }),
    }),
    "Impossible de creer l'organisation.",
  );

  const organization = unwrapData(payload);
  const organizationId = isRecord(organization)
    ? getIDString(organization.id ?? organization.ID)
    : "";
  if (!organizationId) {
    throw new Error("L'organisation a ete creee mais son identifiant est introuvable.");
  }

  storeSelectedOrganizationID(organizationId);
  return organizationId;
}

export async function createStripeCheckoutSession(
  apiBaseURL: string,
  input: CreateCheckoutInput,
): Promise<string> {
  const organizationId = input.organizationId.trim();
  if (!organizationId) {
    throw new Error("Selectionne ou cree une organisation avant de continuer.");
  }

  const payload = await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.billing.stripeCheckoutSession(), {
      method: "POST",
      organizationId,
      body: JSON.stringify({
        organization_id: parseNumericOrganizationId(organizationId),
        plan: input.plan,
        billing_cycle: input.billingCycle,
        seats: 1,
        success_url: `${window.location.origin}/billing?checkout=success`,
        cancel_url: `${window.location.origin}/billing?checkout=cancel`,
        request_id: getRequestId(),
      }),
    }),
    "Impossible de creer la session Stripe.",
  );

  const checkout = unwrapData(payload);
  const checkoutURL = isRecord(checkout) ? getString(checkout.checkout_url) : "";
  if (!checkoutURL) {
    throw new Error("Stripe n'a pas renvoye d'URL de paiement.");
  }
  return checkoutURL;
}
