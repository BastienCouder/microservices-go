import type { ReactNode } from "react";

export type MarketingPricingTier = {
  prompt_volume?: number;
  credit_volume?: number;
  label: string;
  prices?: Record<string, number | null>;
  developer_price_cents?: number | null;
  starter_price_cents?: number | null;
  growth_price_cents?: number | null;
  pro_price_cents?: number | null;
};

export type MarketingPlanSettings = {
  plan: string;
  monthly_quota: number;
  model_selection_limit: number;
  monthly_model_change_limit: number;
  max_projects: number;
  is_most_chosen: boolean;
};

export type PriceValue = number | "custom" | null;

export type BillingCycle = "monthly" | "annual";

export type PricingTier = {
  credits: number;
  label: string;
  prices: Record<string, PriceValue>;
};

export type PlanTemplate = {
  name: string;
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
};

export type PricingPlanData = {
  id: string;
  publicName: string;
  monthlyPrice: number | null;
  annualMonthlyPrice: number | null;
  monthlyCredits: number | null;
  maxProjects: number | null;
  modelSelectionLimit: number | null;
  seats: number | null;
  popular: boolean;
};

export type PricingData = {
  source: "database" | "fallback";
  plans: PricingPlanData[];
};
