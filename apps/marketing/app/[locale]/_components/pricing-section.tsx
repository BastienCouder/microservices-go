"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Building2, Check, Code, Terminal, Zap } from "lucide-react";
import { Button } from "../../../components/ui/button";
import {
  sectionCompactBodyClass,
  sectionHeadingClass,
  sectionIntroTextClass,
} from "./section-styles";

type MarketingPricingTier = {
  prompt_volume: number;
  label: string;
  prices?: Record<string, number | null>;
  developer_price_cents?: number | null;
  starter_price_cents?: number | null;
  growth_price_cents?: number | null;
  pro_price_cents?: number | null;
};

type MarketingPlanSettings = {
  plan: string;
  monthly_quota: number;
  model_selection_limit: number;
  monthly_model_change_limit: number;
  max_projects: number;
  is_most_chosen: boolean;
};

type PriceValue = number | "custom" | null;

type VolumeConfig = {
  prompts: number;
  label: string;
  prices: Record<string, PriceValue>;
};

type PlanTemplate = {
  name: string;
  icon: ReactNode;
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
};

type PlanConfig = PlanTemplate & {
  id: string;
  name: string;
  price: PriceValue;
  prompts: number;
};

const DEFAULT_VOLUMES: VolumeConfig[] = [
  {
    prompts: 50,
    label: "50",
    prices: { developer: 29, starter: 79, growth: 299, pro: 799 },
  },
  {
    prompts: 100,
    label: "100",
    prices: { developer: 49, starter: 149, growth: 349, pro: 849 },
  },
  {
    prompts: 250,
    label: "250",
    prices: { developer: 99, starter: 249, growth: 499, pro: 999 },
  },
  {
    prompts: 500,
    label: "500",
    prices: { developer: 149, starter: 399, growth: 599, pro: 1199 },
  },
  {
    prompts: 1000,
    label: "1k",
    prices: { developer: 249, starter: null, growth: 899, pro: 1499 },
  },
  {
    prompts: 5000,
    label: "5k+",
    prices: { developer: "custom", starter: null, growth: null, pro: "custom" },
  },
];

const DEFAULT_PLAN_IDS = ["developer", "starter", "growth", "pro"];
const PLAN_ORDER = ["developer", "starter", "growth", "pro"];

function centsToPrice(value: unknown): PriceValue {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value / 100);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.data)) return value.data;
  return [];
}

function normalizePlanCode(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).trim().toLowerCase().replace(/_/g, "-");
}

function normalizePriceMap(value: unknown): Record<string, PriceValue> {
  if (!isRecord(value)) return {};
  const prices: Record<string, PriceValue> = {};
  for (const [plan, price] of Object.entries(value)) {
    const normalizedPlan = normalizePlanCode(plan);
    if (!normalizedPlan) continue;
    prices[normalizedPlan] = typeof price === "number" ? centsToPrice(price) : null;
  }
  return prices;
}

function normalizePricingTier(tier: MarketingPricingTier) {
  const prices = normalizePriceMap(tier.prices);
  const assignLegacyPrice = (plan: string, value: number | null | undefined) => {
    if (value !== undefined) {
      prices[plan] = centsToPrice(value);
    }
  };
  assignLegacyPrice("developer", tier.developer_price_cents);
  assignLegacyPrice("starter", tier.starter_price_cents);
  assignLegacyPrice("growth", tier.growth_price_cents);
  assignLegacyPrice("pro", tier.pro_price_cents);

  return {
    prompts: tier.prompt_volume,
    label: tier.label,
    prices,
  };
}

function normalizePlanSettings(value: unknown): MarketingPlanSettings | null {
  if (!isRecord(value)) return null;
  const plan = normalizePlanCode(value.plan);
  if (!plan) return null;
  const numberValue = (field: string) => {
    const raw = value[field];
    return typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
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

function formatPlanLabel(plan: string) {
  return plan
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sortPlanIds(planIds: string[]) {
  return Array.from(new Set(planIds.filter(Boolean))).sort((left, right) => {
    const leftRank = PLAN_ORDER.indexOf(left);
    const rightRank = PLAN_ORDER.indexOf(right);
    const normalizedLeftRank = leftRank === -1 ? 100 : leftRank;
    const normalizedRightRank = rightRank === -1 ? 100 : rightRank;
    if (normalizedLeftRank === normalizedRightRank) return left.localeCompare(right);
    return normalizedLeftRank - normalizedRightRank;
  });
}

export function PricingSection() {
  const t = useTranslations("pricing");
  const [volumes, setVolumes] = useState(() => [...DEFAULT_VOLUMES]);
  const [configuredPlans, setConfiguredPlans] = useState<MarketingPlanSettings[]>([]);
  const [volumeIndex, setVolumeIndex] = useState(2);
  const currentVolume = volumes[Math.min(volumeIndex, volumes.length - 1)];

  useEffect(() => {
    const controller = new AbortController();
    const gatewayURL = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "http://localhost:50000";
    const baseURL = gatewayURL.replace(/\/$/, "");

    void Promise.all([
      fetch(`${baseURL}/billing/public/plans`, { signal: controller.signal }),
      fetch(`${baseURL}/billing/public/pricing-tiers`, { signal: controller.signal }),
    ])
      .then(async ([plansResponse, tiersResponse]) => {
        if (!plansResponse.ok || !tiersResponse.ok) {
          throw new Error("pricing unavailable");
        }
        const [plansPayload, tiersPayload] = await Promise.all([
          plansResponse.json(),
          tiersResponse.json(),
        ]);
        return { plansPayload, tiersPayload };
      })
      .then(({ plansPayload, tiersPayload }: { plansPayload: unknown; tiersPayload: unknown }) => {
        const nextPlans = unwrapArray(plansPayload)
          .map(normalizePlanSettings)
          .filter((item): item is MarketingPlanSettings => item !== null);
        const nextVolumes = unwrapArray(tiersPayload)
          .map((item) => normalizePricingTier(item as MarketingPricingTier))
          .filter((item) => item.prompts > 0)
          .sort((left, right) => left.prompts - right.prompts);

        if (nextPlans.length > 0) {
          setConfiguredPlans(nextPlans);
        }
        if (nextVolumes.length > 0) {
          setVolumes(nextVolumes);
          setVolumeIndex((current) => Math.min(current, nextVolumes.length - 1));
        }
      })
      .catch(() => {
        // Keep the static marketing fallback if the billing API is unavailable.
      });
    return () => controller.abort();
  }, []);

  const formatPrompts = (value: number) => {
    if (value >= 5000) {
      return "5k+";
    }

    if (value >= 1000) {
      return `${value / 1000}k`;
    }

    return `${value}`;
  };

  const planTemplates = useMemo<Record<string, PlanTemplate>>(
    () => ({
      developer: {
        name: t("plans.developer.name"),
        icon: <Terminal className="w-4 h-4" />,
        description: t("plans.developer.description"),
        features: [
          t("plans.developer.features.0"),
          t("plans.developer.features.1"),
          t("plans.developer.features.2"),
          t("plans.developer.features.3"),
        ],
        cta: t("plans.developer.cta"),
        popular: false,
      },
      starter: {
        name: t("plans.starter.name"),
        icon: <Code className="w-4 h-4" />,
        description: t("plans.starter.description"),
        features: [
          t("plans.starter.features.0"),
          t("plans.starter.features.1"),
          t("plans.starter.features.2"),
          t("plans.starter.features.3"),
          t("plans.starter.features.4"),
        ],
        cta: t("plans.starter.cta"),
        popular: false,
      },
      growth: {
        name: t("plans.growth.name"),
        icon: <Zap className="w-4 h-4" />,
        description: t("plans.growth.description"),
        features: [
          t("plans.growth.features.0"),
          t("plans.growth.features.1"),
          t("plans.growth.features.2"),
          t("plans.growth.features.3"),
          t("plans.growth.features.4"),
        ],
        cta: t("plans.growth.cta"),
        popular: true,
      },
      pro: {
        name: t("plans.pro.name"),
        icon: <Building2 className="w-4 h-4" />,
        description: t("plans.pro.description"),
        features: [
          t("plans.pro.features.0"),
          t("plans.pro.features.1"),
          t("plans.pro.features.2"),
          t("plans.pro.features.3"),
          t("plans.pro.features.4"),
        ],
        cta: t("plans.pro.cta"),
        popular: false,
      },
    }),
    [t],
  );

  const plans = useMemo<PlanConfig[]>(() => {
    const settingsByPlan = new Map(
      configuredPlans.map((settings) => [settings.plan, settings]),
    );
    const dynamicPlanIds = volumes.flatMap((volume) => Object.keys(volume.prices));
    const planIds = sortPlanIds([
      ...(configuredPlans.length > 0 ? configuredPlans.map((settings) => settings.plan) : DEFAULT_PLAN_IDS),
      ...dynamicPlanIds,
    ]);

    return planIds.map((planId) => {
      const template = planTemplates[planId];
      const settings = settingsByPlan.get(planId);
      const name = template?.name ?? formatPlanLabel(planId);
      const features =
        template?.features ??
        [
          t("dynamic.features.monthlyQuota", {
            value: formatPrompts(settings?.monthly_quota || currentVolume.prompts),
          }),
          settings?.model_selection_limit
            ? t("dynamic.features.models", { value: settings.model_selection_limit })
            : t("dynamic.features.unlimitedModels"),
          settings?.monthly_model_change_limit
            ? t("dynamic.features.modelChanges", {
                value: settings.monthly_model_change_limit,
              })
            : t("dynamic.features.unlimitedModelChanges"),
          settings?.max_projects
            ? t("dynamic.features.projects", { value: settings.max_projects })
            : t("dynamic.features.unlimitedProjects"),
        ];

      return {
        id: planId,
        name,
        icon: template?.icon ?? <Building2 className="w-4 h-4" />,
        description: template?.description ?? t("dynamic.description"),
        price: currentVolume.prices[planId] ?? null,
        prompts: currentVolume.prompts,
        features,
        cta: template?.cta ?? t("dynamic.cta", { plan: name }),
        popular: settings?.is_most_chosen ?? (configuredPlans.length === 0 && (template?.popular ?? false)),
      };
    });
  }, [configuredPlans, currentVolume, planTemplates, t, volumes]);

  const formatPrice = (price: number | string | null) => {
    if (price === null) {
      return t("custom");
    }

    if (typeof price === "string") {
      return t("custom");
    }

    return `${price}€`;
  };

  return (
    <section id="pricing" className="relative py-16 sm:py-20 lg:py-28">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="max-w-3xl mb-20">
          <h2 className={`${sectionHeadingClass} text-foreground mb-6`}>{t("title")}</h2>
          <p className={sectionIntroTextClass}>{t("description")}</p>
        </div>

        <div className="space-y-10 mb-16">
          <div className="rounded-2xl border border-foreground/10 bg-background p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-6">
              <div>
                <p className="text-xs font-mono uppercase text-muted-foreground mb-2">{t("volumeLabel")}</p>
                <div className="flex items-end gap-3">
                  <span className="font-display text-4xl lg:text-5xl text-primary">{formatPrompts(currentVolume.prompts)}</span>
                  <span className="text-muted-foreground pb-1">{t("volumeSuffix")}</span>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">{t("volumeHelper")}</div>
            </div>

            <input
              type="range"
              min="0"
              max={volumes.length - 1}
              step="1"
              value={volumeIndex}
              onChange={(event) => setVolumeIndex(Number.parseInt(event.target.value, 10))}
              className="w-full h-2 bg-foreground/10 rounded-full appearance-none cursor-pointer accent-foreground"
            />

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
              {volumes.map((volume, index) => {
                const active = index === volumeIndex;

                return (
                  <Button
                    key={volume.label}
                    onClick={() => setVolumeIndex(index)}
                    className={`rounded-full px-3 py-3 text-center border transition-all ${
                      active
                        ? "border-primary bg-primary text-background"
                        : "bg-transparent border-foreground/10 text-muted-foreground hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
                    }`}
                  >
                    <div className="text-sm font-medium">{volume.label}</div>
                    <div className="text-[10px] font-mono uppercase mt-1">{t("promptsShort")}</div>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-px">
          {plans.map((plan, index) => {
            const unavailable = plan.price === null;

            return (
              <div
                key={plan.id}
                className={`relative p-8 lg:p-10 bg-background ${
                  plan.popular ? "xl:-my-4 xl:py-12 border-2 rounded-2xl border-primary z-10" : ""
                } ${unavailable ? "opacity-80 grayscale" : "border border-foreground/5 rounded-2xl"}`}
              >
                {plan.popular ? (
                  <span className="absolute -top-3 left-8 px-3 py-1 bg-primary text-background text-xs font-mono uppercase">
                    {t("mostPopular")}
                  </span>
                ) : null}

                <div className="mb-8">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    {plan.icon}
                    <span className="font-mono text-xs">{String(index + 1).padStart(2, "0")}</span>
                  </div>

                  <h3 className="font-display tracking-tight text-2xl sm:text-3xl text-primary mt-3">{plan.name}</h3>
                  <p className={`${sectionCompactBodyClass} mt-2 min-h-[40px]`}>{plan.description}</p>

                  <div className="mt-4 inline-flex px-3 py-1 border border-foreground/10 text-xs font-mono uppercase text-foreground">
                    {formatPrompts(plan.prompts)} {t("promptsShort")}
                  </div>
                </div>

                <div className="mb-8 pb-8 border-b border-foreground/10">
                  {plan.price !== null ? (
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-5xl lg:text-6xl text-foreground">{formatPrice(plan.price)}</span>
                      {typeof plan.price === "number" ? <span className="text-muted-foreground">{t("perMonth")}</span> : null}
                    </div>
                  ) : (
                    <span className="font-display text-4xl text-foreground">{t("custom")}</span>
                  )}
                </div>

                <ul className="space-y-4 mb-10 min-h-[240px]">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-foreground mt-0.5 shrink-0" />
                      <span className={sectionCompactBodyClass}>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`rounded-full w-full py-4 flex items-center justify-center gap-2 text-sm font-medium transition-all group ${
                    plan.popular
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-transparent border border-foreground/20 text-foreground hover:border-primary hover:bg-primary/5"
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
