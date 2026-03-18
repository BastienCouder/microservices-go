import { SIM_PLAN_KEY_PREFIX, normalizeStoredPlan, type SimulatedPlan } from "@/features/models/core/model-access";

export type BillingCycle = "monthly" | "yearly";

export type BillingBusinessMode = {
  id: SimulatedPlan;
  label: string;
  badge: string;
  isCurrent: boolean;
  quotaLabel: string;
  modelLimitLabel: string;
  cycleLabel: string;
  ctaLabel: string;
};

const BUSINESS_MODE_ORDER: SimulatedPlan[] = [
  "starter",
  "growth",
  "pro",
  "agency-enterprise",
];

export function buildBillingBusinessModes(currentPlan: SimulatedPlan, cycle: BillingCycle): BillingBusinessMode[] {
  return BUSINESS_MODE_ORDER.map((mode) => {
    const isCurrent = currentPlan === mode;

    if (mode === "starter") {
      return {
        id: mode,
        label: "Starter",
        badge: "Lancement rapide",
        isCurrent,
        quotaLabel: "50 analyses / mois",
        modelLimitLabel: "3 modeles IA actifs",
        cycleLabel: cycle === "yearly" ? "Annuel" : "Mensuel",
        ctaLabel: isCurrent ? "Plan actuel" : "Passer en Starter",
      };
    }

    if (mode === "growth") {
      return {
        id: mode,
        label: "Growth",
        badge: "Equipe en acceleration",
        isCurrent,
        quotaLabel: "200 analyses / mois",
        modelLimitLabel: "6 modeles IA actifs",
        cycleLabel: cycle === "yearly" ? "Annuel" : "Mensuel",
        ctaLabel: isCurrent ? "Plan actuel" : "Passer en Growth",
      };
    }

    if (mode === "pro") {
      return {
        id: mode,
        label: "Pro",
        badge: "Scale multi-marques",
        isCurrent,
        quotaLabel: "Quota quasi illimite",
        modelLimitLabel: "Modeles IA illimites",
        cycleLabel: cycle === "yearly" ? "Annuel" : "Mensuel",
        ctaLabel: isCurrent ? "Plan actuel" : "Passer en Pro",
      };
    }

    return {
      id: mode,
      label: "Agency / Enterprise",
      badge: "Sur mesure",
      isCurrent,
      quotaLabel: "Quota personnalise",
      modelLimitLabel: "Modeles IA illimites",
      cycleLabel: "Contrat annuel",
      ctaLabel: isCurrent ? "Plan actuel" : "Parler a l equipe",
    };
  });
}

export function readStoredBillingPlan(organizationId: string): SimulatedPlan {
  if (typeof window === "undefined" || organizationId.trim() === "") {
    return "starter";
  }

  try {
    return normalizeStoredPlan(window.localStorage.getItem(`${SIM_PLAN_KEY_PREFIX}${organizationId}`));
  } catch {
    return "starter";
  }
}

export function storeBillingPlan(organizationId: string, plan: SimulatedPlan): void {
  if (typeof window === "undefined") return;

  const normalizedOrganizationId = organizationId.trim();
  if (normalizedOrganizationId === "") return;

  try {
    window.localStorage.setItem(`${SIM_PLAN_KEY_PREFIX}${normalizedOrganizationId}`, plan);
  } catch {
    // Ignore storage failures in the browser shell.
  }
}
