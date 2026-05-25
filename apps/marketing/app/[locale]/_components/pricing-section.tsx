"use client";

import { useEffect, useMemo, useState } from "react";
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
  developer_price_cents: number | null;
  starter_price_cents: number | null;
  growth_price_cents: number | null;
  pro_price_cents: number | null;
};

type PriceValue = number | "custom" | null;

type VolumeConfig = {
  prompts: number;
  label: string;
  dev: PriceValue;
  starter: PriceValue;
  growth: PriceValue;
  pro: PriceValue;
};

const DEFAULT_VOLUMES: VolumeConfig[] = [
  { prompts: 50, label: "50", dev: 29, starter: 79, growth: 299, pro: 799 },
  { prompts: 100, label: "100", dev: 49, starter: 149, growth: 349, pro: 849 },
  { prompts: 250, label: "250", dev: 99, starter: 249, growth: 499, pro: 999 },
  { prompts: 500, label: "500", dev: 149, starter: 399, growth: 599, pro: 1199 },
  { prompts: 1000, label: "1k", dev: 249, starter: null, growth: 899, pro: 1499 },
  { prompts: 5000, label: "5k+", dev: "custom", starter: null, growth: null, pro: "custom" },
];

function centsToPrice(value: number | null): PriceValue {
  return value === null ? null : Math.round(value / 100);
}

function normalizePricingTier(tier: MarketingPricingTier) {
  return {
    prompts: tier.prompt_volume,
    label: tier.label,
    dev: centsToPrice(tier.developer_price_cents),
    starter: centsToPrice(tier.starter_price_cents),
    growth: centsToPrice(tier.growth_price_cents),
    pro: centsToPrice(tier.pro_price_cents),
  };
}

export function PricingSection() {
  const t = useTranslations("pricing");
  const [volumes, setVolumes] = useState(() => [...DEFAULT_VOLUMES]);
  const [volumeIndex, setVolumeIndex] = useState(2);
  const currentVolume = volumes[Math.min(volumeIndex, volumes.length - 1)];

  useEffect(() => {
    const controller = new AbortController();
    const gatewayURL = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "http://localhost:50000";
    void fetch(`${gatewayURL.replace(/\/$/, "")}/billing/public/pricing-tiers`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: unknown) => {
        if (!Array.isArray(payload)) return;
        const nextVolumes = payload
          .map((item) => normalizePricingTier(item as MarketingPricingTier))
          .filter((item) => item.prompts > 0)
          .sort((left, right) => left.prompts - right.prompts);
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

  const plans = useMemo(
    () => [
      {
        name: t("plans.developer.name"),
        icon: <Terminal className="w-4 h-4" />,
        description: t("plans.developer.description"),
        price: currentVolume.dev,
        prompts: currentVolume.prompts,
        features: [
          t("plans.developer.features.0"),
          t("plans.developer.features.1"),
          t("plans.developer.features.2"),
          t("plans.developer.features.3"),
        ],
        cta: t("plans.developer.cta"),
        popular: false,
      },
      {
        name: t("plans.starter.name"),
        icon: <Code className="w-4 h-4" />,
        description: t("plans.starter.description"),
        price: currentVolume.starter,
        prompts: currentVolume.prompts,
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
      {
        name: t("plans.growth.name"),
        icon: <Zap className="w-4 h-4" />,
        description: t("plans.growth.description"),
        price: currentVolume.growth,
        prompts: currentVolume.prompts,
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
      {
        name: t("plans.pro.name"),
        icon: <Building2 className="w-4 h-4" />,
        description: t("plans.pro.description"),
        price: currentVolume.pro,
        prompts: currentVolume.prompts,
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
    ],
    [currentVolume, t],
  );

  const formatPrice = (price: number | string | null) => {
    if (price === null) {
      return t("custom");
    }

    if (typeof price === "string") {
      return t("custom");
    }

    return `${price}€`;
  };

  const formatPrompts = (value: number) => {
    if (value >= 5000) {
      return "5k+";
    }

    if (value >= 1000) {
      return `${value / 1000}k`;
    }

    return `${value}`;
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
                key={plan.name}
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
