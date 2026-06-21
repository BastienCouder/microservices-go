import { getLocalizedPathname, type Locale } from "@/src/i18n/config";
import type { BillingCycle } from "./pricing-types";

type JsonRecord = Record<string, unknown>;

type CheckoutInput = {
  appURL: string;
  gatewayURL: string;
  locale: Locale;
  origin: string;
  plan: string;
  billingCycle: BillingCycle;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function unwrapGatewayPayload(value: unknown): unknown {
  if (!isRecord(value) || !("data" in value)) {
    return value;
  }

  return value.data;
}

async function parseJSON(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json() as Promise<unknown>;
}

async function fetchGatewayJSON(
  gatewayURL: string,
  path: string,
  init?: RequestInit & { organizationId?: string },
): Promise<unknown> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init?.organizationId) {
    headers.set("X-Organization-ID", init.organizationId);
  }

  const response = await fetch(`${gatewayURL.replace(/\/$/, "")}${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  const payload = await parseJSON(response);

  if (!response.ok) {
    throw new Error(readGatewayError(payload, response.status));
  }

  return unwrapGatewayPayload(payload);
}

function readGatewayError(payload: unknown, status: number): string {
  if (isRecord(payload) && isRecord(payload.error)) {
    const message = getString(payload.error.message);
    if (message) return message;
  }
  if (isRecord(payload)) {
    const message = getString(payload.error);
    if (message) return message;
  }
  if (status === 401) return "unauthorized";
  return "request failed";
}

function readOrganizationId(value: unknown): string {
  if (!isRecord(value)) return "";
  return getString(
    value.organizationId ??
      value.OrganizationID ??
      value.organization_id ??
      value.internalId ??
      value.InternalID ??
      value.id ??
      value.ID,
  );
}

function readCheckoutURL(value: unknown): string {
  if (!isRecord(value)) return "";
  return getString(value.checkout_url ?? value.checkoutURL ?? value.url);
}

function readUserWorkspaceName(value: unknown): string {
  const payload = unwrapGatewayPayload(value);
  if (!isRecord(payload)) return "Visia workspace";

  const email = getString(payload.email ?? payload.Email);
  const prefix = email.split("@", 1)[0]?.trim();
  if (prefix) return `${prefix} workspace`;

  const name = getString(payload.name ?? payload.Name ?? payload.firstName ?? payload.FirstName);
  return name ? `${name} workspace` : "Visia workspace";
}

function toBackendBillingCycle(cycle: BillingCycle): "monthly" | "yearly" {
  return cycle === "annual" ? "yearly" : "monthly";
}

function getRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `web-checkout-${Date.now()}`;
}

function buildLoginURL(input: CheckoutInput): string {
  const loginPath = getLocalizedPathname(input.locale, "/login");
  const pricingURL = new URL(getLocalizedPathname(input.locale, "/"), input.origin);
  pricingURL.searchParams.set("checkout_plan", input.plan);
  pricingURL.searchParams.set("billing_cycle", input.billingCycle);
  pricingURL.hash = "pricing";
  return `${input.origin}${loginPath}?return_to=${encodeURIComponent(pricingURL.toString())}`;
}

async function resolveOrganizationId(input: CheckoutInput, userPayload: unknown): Promise<string> {
  const membershipsPayload = await fetchGatewayJSON(input.gatewayURL, "/organizations/me", {
    method: "GET",
  });
  const memberships = Array.isArray(membershipsPayload) ? membershipsPayload : [];
  const firstOrganizationId = memberships.map(readOrganizationId).find(Boolean) ?? "";
  if (firstOrganizationId) return firstOrganizationId;

  const createdOrganization = await fetchGatewayJSON(input.gatewayURL, "/organizations", {
    method: "POST",
    body: JSON.stringify({ name: readUserWorkspaceName(userPayload) }),
  });
  const createdOrganizationId = readOrganizationId(createdOrganization);
  if (!createdOrganizationId) {
    throw new Error("organization missing");
  }
  return createdOrganizationId;
}

export async function startPricingCheckout(input: CheckoutInput): Promise<void> {
  if (input.plan === "enterprise") {
    window.location.href = "mailto:sales@riligar.com?subject=Enterprise%20plan";
    return;
  }

  let userPayload: unknown;
  try {
    userPayload = await fetchGatewayJSON(input.gatewayURL, "/auth/me", {
      method: "GET",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "unauthorized") {
      window.location.href = buildLoginURL(input);
      return;
    }
    throw error;
  }

  const organizationId = await resolveOrganizationId(input, userPayload);
  const appURL = (input.appURL.trim() || "http://localhost:30004").replace(/\/$/, "");
  const successURL = new URL("/onboarding", appURL);
  successURL.searchParams.set("setup", "account");
  successURL.searchParams.set("checkout", "success");

  const cancelURL = new URL(getLocalizedPathname(input.locale, "/"), input.origin);
  cancelURL.searchParams.set("checkout", "cancel");
  cancelURL.searchParams.set("checkout_plan", input.plan);
  cancelURL.searchParams.set("billing_cycle", input.billingCycle);
  cancelURL.hash = "pricing";

  const checkoutPayload = await fetchGatewayJSON(
    input.gatewayURL,
    "/billing/stripe/checkout-session",
    {
      method: "POST",
      organizationId,
      body: JSON.stringify({
        organization_id: Number.parseInt(organizationId, 10),
        plan: input.plan,
        billing_cycle: toBackendBillingCycle(input.billingCycle),
        prompt_volume: 0,
        seats: 1,
        success_url: successURL.toString(),
        cancel_url: cancelURL.toString(),
        request_id: getRequestId(),
      }),
    },
  );
  const checkoutURL = readCheckoutURL(checkoutPayload);
  if (!checkoutURL) {
    throw new Error("Stripe checkout URL missing");
  }
  window.location.assign(checkoutURL);
}
