import type {
  MarketingPlanSettings,
  MarketingPricingTier,
  PriceValue,
  PricingTier,
} from "./pricing-types";

export const DEFAULT_PLAN_IDS = ["starter", "growth", "pro", "enterprise"];

export const FINAL_PUBLIC_PLANS = [
  {
    id: "starter",
    publicName: "Starter",
    monthlyPrice: 59,
    annualMonthlyPrice: 49,
    monthlyCredits: 100,
    maxProjects: 1,
    modelSelectionLimit: 2,
    seats: 1,
    popular: false,
  },
  {
    id: "growth",
    publicName: "Growth",
    monthlyPrice: 199,
    annualMonthlyPrice: 159,
    monthlyCredits: 750,
    maxProjects: 5,
    modelSelectionLimit: 6,
    seats: 3,
    popular: true,
  },
  {
    id: "pro",
    publicName: "Agency",
    monthlyPrice: 499,
    annualMonthlyPrice: 399,
    monthlyCredits: 3000,
    maxProjects: 20,
    modelSelectionLimit: 15,
    seats: 5,
    popular: false,
  },
  {
    id: "enterprise",
    publicName: "Enterprise",
    monthlyPrice: null,
    annualMonthlyPrice: null,
    monthlyCredits: null,
    maxProjects: null,
    modelSelectionLimit: null,
    seats: null,
    popular: false,
  },
] as const;

const PLAN_ORDER = ["starter", "growth", "pro", "enterprise"];

export function centsToPrice(value: unknown): PriceValue {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value / 100);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function unwrapArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (isRecord(value) && Array.isArray(value.data)) {
    return value.data;
  }

  return [];
}

export function normalizePlanCode(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }

  return String(value).trim().toLowerCase().replace(/_/g, "-");
}

export function normalizePriceMap(value: unknown): Record<string, PriceValue> {
  if (!isRecord(value)) {
    return {};
  }

  const prices: Record<string, PriceValue> = {};

  for (const [plan, price] of Object.entries(value)) {
    const normalizedPlan = normalizePlanCode(plan);

    if (!normalizedPlan) {
      continue;
    }

    prices[normalizedPlan] =
      typeof price === "number" ? centsToPrice(price) : null;
  }

  return prices;
}

export function normalizePricingTier(
  tier: MarketingPricingTier,
): PricingTier {
  const prices = normalizePriceMap(tier.prices);

  const assignLegacyPrice = (
    plan: string,
    value: number | null | undefined,
  ) => {
    if (value !== undefined) {
      prices[plan] = centsToPrice(value);
    }
  };

  assignLegacyPrice("developer", tier.developer_price_cents);
  assignLegacyPrice("starter", tier.starter_price_cents);
  assignLegacyPrice("growth", tier.growth_price_cents);
  assignLegacyPrice("pro", tier.pro_price_cents);

  return {
    credits: tier.credit_volume ?? tier.prompt_volume ?? 0,
    label: tier.label,
    prices,
  };
}

export function normalizePlanSettings(
  value: unknown,
): MarketingPlanSettings | null {
  if (!isRecord(value)) {
    return null;
  }

  const plan = normalizePlanCode(value.plan);

  if (!plan) {
    return null;
  }

  const numberValue = (field: string) => {
    const raw = value[field];

    return typeof raw === "number" && Number.isFinite(raw)
      ? Math.max(0, Math.floor(raw))
      : 0;
  };

  return {
    plan,
    monthly_quota: numberValue("monthly_quota"),
    model_selection_limit: numberValue("model_selection_limit"),
    monthly_model_change_limit: numberValue("monthly_model_change_limit"),
    max_projects: numberValue("max_projects"),
    is_most_chosen: value.is_most_chosen === true,
  };
}

export function sortPlanIds(planIds: string[]) {
  return Array.from(new Set(planIds.filter(Boolean))).sort((left, right) => {
    const leftRank = PLAN_ORDER.indexOf(left);
    const rightRank = PLAN_ORDER.indexOf(right);

    const normalizedLeftRank = leftRank === -1 ? 100 : leftRank;
    const normalizedRightRank = rightRank === -1 ? 100 : rightRank;

    if (normalizedLeftRank === normalizedRightRank) {
      return left.localeCompare(right);
    }

    return normalizedLeftRank - normalizedRightRank;
  });
}

export function formatCredits(value: number | null) {
  if (value === null) {
    return "Sur mesure";
  }

  if (value >= 3000) {
    return `${value / 1000}k`;
  }

  if (value >= 1000) {
    return `${value / 1000}k`;
  }

  return `${value}`;
}

export function getAnnualPriceFromMonthlyEquivalent(
  annualMonthlyPrice: number,
) {
  return annualMonthlyPrice * 12;
}