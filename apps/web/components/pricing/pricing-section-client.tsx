"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  BillingCycle,
  PlanTemplate,
  PricingData,
} from "./pricing-types";
import { startCustomerPortal, startPricingCheckout } from "./pricing-checkout";
import { formatCredits, normalizePlanCode } from "./pricing-utils";
import { consumeCheckoutIntent } from "@/src/auth/browser-intent";
import type { Locale } from "@/src/i18n/config";

const sectionHeadingClass =
  "font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl";

const sectionIntroTextClass =
  "text-base leading-7 text-muted-foreground sm:text-lg";

const sectionCompactBodyClass = "text-sm leading-6 text-muted-foreground";

const billingCopy = {
  fr: {
    monthly: "Mensuel",
    annual: "Annuel",
    annualBadge: "-20%",
    billedMonthly: "/mois",
    billedAnnually: "/mois",
    annualHelper: "Économisez avec la facturation annuelle.",
    monthlyHelper: "Facturation mensuelle, sans engagement annuel.",
    annualBillingPrefix: "Facturé",
    annualBillingSuffix: "par an",
    creditsSuffix: "crédits / mois",
    custom: "Sur devis",
    currentPlan: "Plan actuel",
    currentPlanPrefix: "Plan actif :",
    switchPlanPrefix: "Passer à",
    manageSubscription: "Gérer l’abonnement",
    checkoutLoading: "Préparation du paiement...",
    checkoutError: "Impossible de démarrer le paiement. Connectez-vous puis réessayez.",
    portalError: "Impossible d’ouvrir la gestion d’abonnement. Réessayez.",
  },
  en: {
    monthly: "Monthly",
    annual: "Annual",
    annualBadge: "-20%",
    billedMonthly: "/month",
    billedAnnually: "/month",
    annualHelper: "Save with annual billing.",
    monthlyHelper: "Monthly billing, no annual commitment.",
    annualBillingPrefix: "Billed",
    annualBillingSuffix: "per year",
    creditsSuffix: "credits / month",
    custom: "Custom",
    currentPlan: "Current plan",
    currentPlanPrefix: "Active plan:",
    switchPlanPrefix: "Switch to",
    manageSubscription: "Manage subscription",
    checkoutLoading: "Preparing payment...",
    checkoutError: "Unable to start payment. Sign in and try again.",
    portalError: "Unable to open subscription management. Try again.",
  },
};

type JsonRecord = Record<string, unknown>;

type ActiveBillingState = {
  organizationId: string;
  plan: string;
  isPaid: boolean;
  subscriptionStatus: string;
};

type PlanCopy = {
  name: string;
  description: string;
  cta: string;
  features: string[];
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

function readOrganizationId(value: unknown): string {
  if (!isRecord(value)) return "";
  return getString(
    value.internalId ??
      value.InternalID ??
      value.id ??
      value.ID ??
      value.organizationId ??
      value.OrganizationID ??
      value.organization_id,
  );
}

async function loadActiveBillingState(
  gatewayURL: string,
  signal: AbortSignal,
): Promise<ActiveBillingState | null> {
  const baseURL = gatewayURL.replace(/\/$/, "");

  const authResponse = await fetch(`${baseURL}/auth/me`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    signal,
  });
  if (authResponse.status === 401) {
    return null;
  }
  if (!authResponse.ok) {
    throw new Error("auth unavailable");
  }

  const membershipsResponse = await fetch(`${baseURL}/organizations/me`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    signal,
  });
  if (!membershipsResponse.ok) {
    throw new Error("organizations unavailable");
  }

  const membershipsPayload = unwrapGatewayPayload(await parseJSON(membershipsResponse));
  const memberships = Array.isArray(membershipsPayload) ? membershipsPayload : [];
  const organizationId = memberships.map(readOrganizationId).find(Boolean) ?? "";
  if (!organizationId) {
    return null;
  }

  const quotaResponse = await fetch(`${baseURL}/billing/quotas/${organizationId}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "X-Organization-ID": organizationId,
    },
    signal,
  });
  if (!quotaResponse.ok) {
    throw new Error("billing unavailable");
  }

  const quotaPayload = unwrapGatewayPayload(await parseJSON(quotaResponse));
  const payload = isRecord(quotaPayload) ? quotaPayload : {};

  return {
    organizationId,
    plan: normalizePlanCode(payload.plan),
    isPaid: payload.is_paid === true,
    subscriptionStatus: getString(payload.subscription_status),
  };
}

function formatPlanLabel(plan: string) {
  return plan
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isPlanCopy(value: unknown): value is PlanCopy {
  if (!isRecord(value)) return false;

  return (
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    typeof value.cta === "string" &&
    Array.isArray(value.features) &&
    value.features.every((feature) => typeof feature === "string")
  );
}

type PricingSectionClientProps = {
  pricing: PricingData;
};

export function PricingSectionClient({
  pricing,
}: PricingSectionClientProps) {
  const t = useTranslations("pricing");
  const locale = useLocale() as Locale;
  const copy = locale.startsWith("fr") ? billingCopy.fr : billingCopy.en;

  const [billingCycle, setBillingCycle] =
    useState<BillingCycle>("monthly");
  const [busyPlan, setBusyPlan] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [activeBilling, setActiveBilling] = useState<ActiveBillingState | null>(null);
  const didAutoStartCheckout = useRef(false);

  const gatewayURL =
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "http://localhost:50000";
  const appURL =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:30004";

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void loadActiveBillingState(gatewayURL, controller.signal)
      .then((value) => {
        if (active) {
          setActiveBilling(value);
        }
      })
      .catch(() => {
        if (active) {
          setActiveBilling(null);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [gatewayURL]);

  async function handlePlanAction(plan: string, cycle: BillingCycle = billingCycle) {
    if (busyPlan) return;

    setBusyPlan(plan);
    setCheckoutError("");

    try {
      await startPricingCheckout({
        appURL,
        gatewayURL,
        locale,
        origin: window.location.origin,
        plan,
        billingCycle: cycle,
      });
    } catch (error) {
      console.error("[Pricing] checkout failed", error);
      setCheckoutError(copy.checkoutError);
      setBusyPlan("");
    }
  }

  async function handleManageSubscription() {
    if (busyPlan || !activeBilling?.organizationId) return;

    setBusyPlan(activeBilling.organizationId);
    setCheckoutError("");

    try {
      await startCustomerPortal({
        gatewayURL,
        locale,
        origin: window.location.origin,
        organizationId: activeBilling.organizationId,
      });
    } catch (error) {
      console.error("[Pricing] customer portal failed", error);
      setCheckoutError(copy.portalError);
      setBusyPlan("");
    }
  }

  useEffect(() => {
    if (didAutoStartCheckout.current || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const cleanURL = new URL(window.location.href);
    let shouldCleanURL = false;

    if (params.get("checkout") === "cancel") {
      cleanURL.searchParams.delete("checkout");
      cleanURL.searchParams.delete("checkout_plan");
      cleanURL.searchParams.delete("billing_cycle");
      cleanURL.hash = "pricing";
      window.history.replaceState({}, "", cleanURL.toString());
      return;
    }

    const requestedPlan = params.get("checkout_plan")?.trim() ?? "";
    const requestedCycle = params.get("billing_cycle") === "annual" ? "annual" : "monthly";
    const isAvailablePlan = pricing.plans.some((plan) => plan.id === requestedPlan);
    if (requestedPlan && isAvailablePlan) {
      didAutoStartCheckout.current = true;
      setBillingCycle(requestedCycle);
      cleanURL.searchParams.delete("checkout_plan");
      cleanURL.searchParams.delete("billing_cycle");
      cleanURL.hash = "pricing";
      shouldCleanURL = true;
      if (shouldCleanURL) {
        window.history.replaceState({}, "", cleanURL.toString());
      }
      void handlePlanAction(requestedPlan, requestedCycle);
      return;
    }

    const storedIntent = consumeCheckoutIntent();
    const isStoredPlanAvailable = storedIntent
      ? pricing.plans.some((plan) => plan.id === storedIntent.plan)
      : false;
    if (!storedIntent || !isStoredPlanAvailable) return;

    didAutoStartCheckout.current = true;
    setBillingCycle(storedIntent.billingCycle);
    void handlePlanAction(storedIntent.plan, storedIntent.billingCycle);
  }, [pricing.plans]);

  const activePlanId =
    activeBilling?.isPaid === true ? normalizePlanCode(activeBilling.plan) : "";
  const activePlanName =
    pricing.plans.find((plan) => plan.id === activePlanId)?.publicName ??
    (activePlanId ? formatPlanLabel(activePlanId) : "");
  const hasActivePaidPlan = activePlanId !== "";

  const planTemplates = useMemo<Record<string, PlanTemplate>>(
    () =>
      pricing.plans.reduce<Record<string, PlanTemplate>>((templates, plan) => {
        const copy = t.raw(`plans.${plan.id}`);

        if (isPlanCopy(copy)) {
          templates[plan.id] = {
            ...copy,
            popular: plan.popular,
          };
        }

        return templates;
      }, {}),
    [pricing.plans, t],
  );

  function getDisplayPrice(
    monthlyPrice: number | null,
    annualMonthlyPrice: number | null,
  ) {
    if (monthlyPrice === null) {
      return copy.custom;
    }

    if (billingCycle === "annual") {
      return `${annualMonthlyPrice ?? monthlyPrice}€`;
    }

    return `${monthlyPrice}€`;
  }

  function getAnnualBillingText(annualMonthlyPrice: number | null) {
    if (billingCycle !== "annual" || annualMonthlyPrice === null) {
      return null;
    }

    return `${copy.annualBillingPrefix} ${
      annualMonthlyPrice * 12
    }€ ${copy.annualBillingSuffix}`;
  }

  return (
    <section id="pricing" className="relative py-16 sm:py-20 lg:py-28">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="mb-12 max-w-3xl lg:mb-16">
          <h2 className={`${sectionHeadingClass} mb-6 text-foreground`}>
            {t("title")}
          </h2>

          <p className={sectionIntroTextClass}>{t("description")}</p>
        </div>

        <div className="mb-12 flex justify-start lg:mb-16">
          <div className="grid grid-cols-2 rounded-full border border-foreground/10 bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                billingCycle === "monthly"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {copy.monthly}
            </button>

            <button
              type="button"
              onClick={() => setBillingCycle("annual")}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                billingCycle === "annual"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{copy.annual}</span>
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {copy.annualBadge}
              </span>
            </button>
          </div>
        </div>

        {hasActivePaidPlan ? (
          <p className="mb-4 text-sm text-foreground">
            {copy.currentPlanPrefix} {activePlanName}
          </p>
        ) : null}

        {busyPlan ? (
          <p className="mb-4 text-sm text-primary">{copy.checkoutLoading}</p>
        ) : checkoutError ? (
          <p className="mb-4 text-sm text-destructive">{checkoutError}</p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pricing.plans.map((plan) => {
            const template = planTemplates[plan.id];
            const isCustom = plan.monthlyPrice === null;
            const popular = plan.popular || template?.popular;
            const isCurrentPlan = hasActivePaidPlan && plan.id === activePlanId;
            const name =
              template?.name ?? plan.publicName ?? formatPlanLabel(plan.id);

            const features =
              template?.features ??
              [
                `${formatCredits(plan.monthlyCredits)} ${copy.creditsSuffix}`,
                plan.modelSelectionLimit && plan.modelSelectionLimit > 0
                  ? t("dynamic.features.models", {
                      value: plan.modelSelectionLimit,
                    })
                  : t("dynamic.features.unlimitedModels"),
                plan.maxProjects && plan.maxProjects > 0
                  ? t("dynamic.features.projects", {
                      value: plan.maxProjects,
                    })
                  : t("dynamic.features.unlimitedProjects"),
                plan.seats && plan.seats > 0
                  ? t("dynamic.features.seats", {
                      value: plan.seats,
                    })
                  : t("dynamic.features.unlimitedSeats"),
              ];

            const annualBillingText = getAnnualBillingText(
              plan.annualMonthlyPrice,
            );
            const ctaLabel = isCurrentPlan
              ? copy.manageSubscription
              : plan.id === "enterprise"
                ? (template?.cta ?? t("dynamic.cta", { plan: name }))
                : hasActivePaidPlan
                  ? `${copy.switchPlanPrefix} ${name}`
                  : (template?.cta ?? t("dynamic.cta", { plan: name }));

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl bg-background p-8 lg:p-10 ${
                  popular
                    ? "border-2 border-primary xl:-my-4 xl:py-12"
                    : "border border-foreground/10"
                } ${isCustom ? "" : ""}`}
              >
                {popular ? (
                  <span className="absolute -top-3 left-8 bg-primary px-3 py-1 font-mono text-xs uppercase text-primary-foreground">
                    {t("mostPopular")}
                  </span>
                ) : null}

                {isCurrentPlan ? (
                  <span className="absolute right-8 top-8 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {copy.currentPlan}
                  </span>
                ) : null}

                <div className="mb-8">
                  <h3 className="font-display text-2xl tracking-tight text-primary sm:text-3xl">
                    {name}
                  </h3>

                  <p className={`${sectionCompactBodyClass} mt-2 min-h-[40px]`}>
                    {template?.description ?? t("dynamic.description")}
                  </p>

                  <div className="mt-4 inline-flex border border-foreground/10 px-3 py-1 font-mono text-xs uppercase text-foreground">
                    {formatCredits(plan.monthlyCredits)} {copy.creditsSuffix}
                  </div>
                </div>

                <div className="mb-8 border-b border-foreground/10 pb-8">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`font-display text-foreground ${
                        isCustom
                          ? "text-4xl lg:text-5xl"
                          : "text-5xl lg:text-6xl"
                      }`}
                    >
                      {getDisplayPrice(
                        plan.monthlyPrice,
                        plan.annualMonthlyPrice,
                      )}
                    </span>

                    {!isCustom ? (
                      <span className="text-muted-foreground">
                        {billingCycle === "annual"
                          ? copy.billedAnnually
                          : copy.billedMonthly}
                      </span>
                    ) : null}
                  </div>

                  {annualBillingText ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {annualBillingText}
                    </p>
                  ) : null}
                </div>

                <ul className="mb-10 min-h-[240px] space-y-4">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                      <span className={sectionCompactBodyClass}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`group flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm font-medium transition-all ${
                    isCurrentPlan
                      ? "border border-primary/20 bg-primary/10 text-primary hover:bg-primary/15"
                      : popular
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-foreground/20 bg-transparent text-foreground hover:border-primary hover:bg-primary/5"
                  }`}
                  disabled={busyPlan !== ""}
                  onClick={() =>
                    void (isCurrentPlan
                      ? handleManageSubscription()
                      : handlePlanAction(plan.id))
                  }
                  type="button"
                >
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
