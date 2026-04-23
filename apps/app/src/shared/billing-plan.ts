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

export function normalizeBillingPlan(rawPlan: string | null): SimulatedPlan | null {
  if (
    rawPlan === "starter" ||
    rawPlan === "developer" ||
    rawPlan === "growth" ||
    rawPlan === "pro" ||
    rawPlan === "agency-enterprise"
  ) {
    return rawPlan;
  }

  if (!rawPlan) {
    return null;
  }

  return LEGACY_PLAN_ALIASES[rawPlan] ?? null;
}

export function getBillingPlanLabel(plan: SimulatedPlan): string {
  return BILLING_PLAN_LABELS[plan];
}

export function getBillingPlanTranslationKey(plan: SimulatedPlan): string {
  return BILLING_PLAN_TRANSLATION_KEYS[plan];
}

export function isDeveloperBillingPlan(plan: SimulatedPlan | null): boolean {
  return plan === "developer";
}
