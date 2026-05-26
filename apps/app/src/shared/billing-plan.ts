export type SimulatedPlan =
  | "starter"
  | "developer"
  | "growth"
  | "pro"
  | "agency-enterprise";

const LEGACY_PLAN_ALIASES: Record<string, SimulatedPlan> = {
  free: "starter",
  dev: "developer",
  "pro-monthly": "growth",
  "pro-yearly": "pro",
};

const BILLING_PLAN_LABELS: Record<SimulatedPlan, string> = {
  starter: "Starter",
  developer: "Developer",
  growth: "Growth",
  pro: "Pro",
  "agency-enterprise": "Agency / Enterprise",
};

const BILLING_PLAN_TRANSLATION_KEYS: Record<SimulatedPlan, string> = {
  starter: "planStarter",
  developer: "planDeveloper",
  growth: "planGrowth",
  pro: "planPro",
  "agency-enterprise": "planAgencyEnterprise",
};

export function normalizeBillingPlan(rawPlan: string | null): string | null {
  if (!rawPlan) {
    return null;
  }

  const normalized = rawPlan.trim().toLowerCase();
  if (
    normalized === "starter" ||
    normalized === "developer" ||
    normalized === "growth" ||
    normalized === "pro" ||
    normalized === "agency-enterprise"
  ) {
    return normalized;
  }

  return LEGACY_PLAN_ALIASES[normalized] ?? normalized;
}

export function getBillingPlanLabel(plan: string): string {
  if (plan in BILLING_PLAN_LABELS) {
    return BILLING_PLAN_LABELS[plan as SimulatedPlan];
  }
  return plan
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getBillingPlanTranslationKey(plan: SimulatedPlan): string {
  return BILLING_PLAN_TRANSLATION_KEYS[plan];
}

export function isDeveloperBillingPlan(plan: string | null): boolean {
  return plan === "developer";
}
