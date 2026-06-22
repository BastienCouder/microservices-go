"use client";

import type { BillingCycle } from "@/components/pricing/pricing-types";

const AUTH_RETURN_TO_KEY = "auth:return_to";
const CHECKOUT_INTENT_KEY = "pricing:checkout_intent";

type CheckoutIntent = {
  plan: string;
  billingCycle: BillingCycle;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function storeAuthReturnTo(value: string): void {
  if (!isBrowser()) return;
  const normalized = value.trim();
  if (!normalized) return;
  window.sessionStorage.setItem(AUTH_RETURN_TO_KEY, normalized);
}

export function readAuthReturnTo(): string {
  if (!isBrowser()) return "";
  return window.sessionStorage.getItem(AUTH_RETURN_TO_KEY)?.trim() ?? "";
}

export function clearAuthReturnTo(): void {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
}

export function storeCheckoutIntent(plan: string, billingCycle: BillingCycle): void {
  if (!isBrowser()) return;
  const normalizedPlan = plan.trim();
  if (!normalizedPlan) return;
  const payload: CheckoutIntent = {
    plan: normalizedPlan,
    billingCycle: billingCycle === "annual" ? "annual" : "monthly",
  };
  window.sessionStorage.setItem(CHECKOUT_INTENT_KEY, JSON.stringify(payload));
}

export function consumeCheckoutIntent(): CheckoutIntent | null {
  if (!isBrowser()) return null;
  const raw = window.sessionStorage.getItem(CHECKOUT_INTENT_KEY);
  window.sessionStorage.removeItem(CHECKOUT_INTENT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<CheckoutIntent>;
    const plan = typeof parsed.plan === "string" ? parsed.plan.trim() : "";
    if (!plan) {
      return null;
    }
    return {
      plan,
      billingCycle: parsed.billingCycle === "annual" ? "annual" : "monthly",
    };
  } catch {
    return null;
  }
}

export function clearCheckoutIntent(): void {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(CHECKOUT_INTENT_KEY);
}
