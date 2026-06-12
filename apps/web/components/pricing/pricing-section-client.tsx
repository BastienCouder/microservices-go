"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  Building2,
  Check,
  Code,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  BillingCycle,
  PlanTemplate,
  PricingData,
} from "./pricing-types";
import { formatCredits } from "./pricing-utils";

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
  },
};

function formatPlanLabel(plan: string) {
  return plan
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type PricingSectionClientProps = {
  pricing: PricingData;
};

export function PricingSectionClient({
  pricing,
}: PricingSectionClientProps) {
  const t = useTranslations("pricing");
  const locale = useLocale();
  const copy = locale.startsWith("fr") ? billingCopy.fr : billingCopy.en;

  const [billingCycle, setBillingCycle] =
    useState<BillingCycle>("monthly");

  const planTemplates = useMemo<Record<string, PlanTemplate>>(
    () => ({
      starter: {
        name: "Starter",
        icon: <Code className="h-4 w-4" />,
        description:
          "Pour suivre votre présence IA sur un petit périmètre.",
        features: [
          "100 crédits inclus par mois",
          "1 projet",
          "2 modèles IA",
          "1 siège utilisateur",
          "Monitoring et premiers audits GEO",
        ],
        cta: "Commencer",
        popular: false,
      },
      growth: {
        name: "Growth",
        icon: <Zap className="h-4 w-4" />,
        description:
          "Pour piloter monitoring, perception, audits et recommandations.",
        features: [
          "750 crédits inclus par mois",
          "5 projets",
          "6 modèles IA",
          "3 sièges utilisateurs",
          "Plan recommandé pour les équipes en croissance",
        ],
        cta: "Choisir Growth",
        popular: true,
      },
      pro: {
        name: "Agency",
        icon: <Building2 className="h-4 w-4" />,
        description:
          "Pour les agences qui gèrent plusieurs clients et rapports.",
        features: [
          "3000 crédits inclus par mois",
          "20 projets",
          "15 modèles IA",
          "5 sièges utilisateurs",
          "Usage multi-client, crawls, rapports et recommandations",
        ],
        cta: "Choisir Agency",
        popular: false,
      },
      enterprise: {
        name: "Enterprise",
        icon: <Building2 className="h-4 w-4" />,
        description:
          "Pour les volumes élevés, besoins sécurité, SLA et accompagnement dédié.",
        features: [
          "Crédits sur mesure",
          "Projets sur mesure",
          "Modèles et limites personnalisés",
          "SLA, sécurité et support dédié",
          "Accompagnement commercial",
        ],
        cta: "Nous contacter",
        popular: false,
      },
    }),
    [],
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

        <div className="mb-12 flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-background p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 lg:mb-16">
          <div>
            <p className="text-sm font-medium text-foreground">
              {billingCycle === "annual"
                ? copy.annualHelper
                : copy.monthlyHelper}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {pricing.source === "database"
                ? "Tarifs synchronisés avec la configuration active."
                : "Tarifs par défaut affichés temporairement."}
            </p>
          </div>

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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pricing.plans.map((plan, index) => {
            const template = planTemplates[plan.id];
            const isCustom = plan.monthlyPrice === null;
            const popular = plan.popular || template?.popular;
            const name =
              template?.name ?? plan.publicName ?? formatPlanLabel(plan.id);

            const features =
              template?.features ??
              [
                `${formatCredits(plan.monthlyCredits)} ${copy.creditsSuffix}`,
                plan.modelSelectionLimit && plan.modelSelectionLimit > 0
                  ? `${plan.modelSelectionLimit} modèles sélectionnables`
                  : "Modèles sur mesure",
                plan.maxProjects && plan.maxProjects > 0
                  ? `${plan.maxProjects} projets`
                  : "Projets sur mesure",
                plan.seats && plan.seats > 0
                  ? `${plan.seats} sièges utilisateurs`
                  : "Sièges sur mesure",
              ];

            const annualBillingText = getAnnualBillingText(
              plan.annualMonthlyPrice,
            );

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

                <div className="mb-8">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    {template?.icon ?? <Building2 className="h-4 w-4" />}

                    <span className="font-mono text-xs">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <h3 className="mt-3 font-display text-2xl tracking-tight text-primary sm:text-3xl">
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
                    popular
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-foreground/20 bg-transparent text-foreground hover:border-primary hover:bg-primary/5"
                  }`}
                >
                  {template?.cta ?? t("dynamic.cta", { plan: name })}
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