"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, Terminal, Code, Zap, Building2 } from "lucide-react";
import { Button } from "../ui/button";

const VOLUMES = [
  { prompts: 50, label: "50", dev: 29, starter: 79, growth: 299, pro: 799 },
  { prompts: 100, label: "100", dev: 49, starter: 149, growth: 349, pro: 849 },
  { prompts: 250, label: "250", dev: 99, starter: 249, growth: 499, pro: 999 },
  { prompts: 500, label: "500", dev: 149, starter: 399, growth: 599, pro: 1199 },
  { prompts: 1000, label: "1k", dev: 249, starter: null, growth: 899, pro: 1499 },
  { prompts: 5000, label: "5k+", dev: "Custom", starter: null, growth: null, pro: "Custom" },
];

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);
  const [volumeIndex, setVolumeIndex] = useState(2);

  const currentVolume = VOLUMES[volumeIndex];
  const annualDiscount = 0.8;

  const plans = useMemo(
    () => [
      {
        name: "Developer",
        icon: <Terminal className="w-4 h-4" />,
        description: "Data brute via API & MCP. Pas de dashboard.",
        price: currentVolume.dev,
        prompts: currentVolume.prompts,
        features: [
          "API REST complète",
          "Serveur MCP",
          "Choix de 2 LLMs",
          "Export JSON / Markdown",
        ],
        cta: "Obtenir une clé API",
        popular: false,
      },
      {
        name: "Starter",
        icon: <Code className="w-4 h-4" />,
        description: "Pour valider votre positionnement IA.",
        price: currentVolume.starter,
        prompts: currentVolume.prompts,
        features: [
          "Dashboard Monitoring",
          "Choix de 3 LLMs",
          "1 Marque trackée",
          "Module Understanding",
          "Rapports PDF mensuels",
        ],
        cta: "Commencer",
        popular: false,
      },
      {
        name: "Growth",
        icon: <Zap className="w-4 h-4" />,
        description: "Le standard pour les scale-ups SaaS.",
        price: currentVolume.growth,
        prompts: currentVolume.prompts,
        features: [
          "Dashboard complet",
          "Choix de 6 LLMs",
          "3 Marques trackées",
          "Correction (Drafts IA)",
          "Intégration GA4",
        ],
        cta: "Passer à Growth",
        popular: true,
      },
      {
        name: "Pro",
        icon: <Building2 className="w-4 h-4" />,
        description: "GEO totale et attribution de revenu.",
        price: currentVolume.pro,
        prompts: currentVolume.prompts,
        features: [
          "Accès à tous les LLMs",
          "Marques illimitées",
          "Attribution HubSpot/Stripe",
          "Push CMS natif",
          "Account Manager dédié",
        ],
        cta: "Contacter Sales",
        popular: false,
      },
    ],
    [currentVolume]
  );

  const formatPrice = (price: number | string | null) => {
    if (price === null) return "N/A";
    if (typeof price === "string") return price;
    const finalPrice = isAnnual ? Math.round(price * annualDiscount) : price;
    return `${finalPrice}€`;
  };

  const formatPrompts = (value: number) => {
    if (value >= 5000) return "5k+";
    if (value >= 1000) return `${value / 1000}k`;
    return `${value}`;
  };

  return (
    <section
      id="pricing"
      className="relative py-24 lg:py-32"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="max-w-3xl mb-20">
          <h2 className="text-primary font-display text-5xl md:text-6xl tracking-tight text-foreground mb-6">
            Des tarifs simples et transparents
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Des plans adaptés à votre stade de croissance. Choisissez votre volume de prompts et votre fréquence de facturation.
          </p>
        </div>
<div className="space-y-10 mb-16">
  {/* <div className="flex flex-wrap items-center gap-4">
    <div className="relative inline-grid grid-cols-2 rounded-full border border-foreground/10 bg-foreground/[0.04] p-1">
      <div
        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-background border border-foreground/10 shadow-sm transition-all duration-300 ${
          isAnnual ? "translate-x-[calc(100%+4px)]" : "translate-x-0"
        }`}
      />

      <Button
        type="button"
        variant="ghost"
        onClick={() => setIsAnnual(false)}
        className={`relative z-10 h-10 rounded-full px-5 text-sm font-medium transition-colors hover:bg-transparent ${
          !isAnnual ? "text-foreground" : "text-muted-foreground"
        }`}
        aria-pressed={!isAnnual}
      >
        Mensuel
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={() => setIsAnnual(true)}
        className={`relative z-10 h-10 rounded-full px-5 text-sm font-medium transition-colors hover:bg-transparent ${
          isAnnual ? "text-foreground" : "text-muted-foreground"
        }`}
        aria-pressed={isAnnual}
      >
        <span className="flex items-center gap-2">
          Annuel
          <span className="rounded-full bg-foreground text-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            -20%
          </span>
        </span>
      </Button>
    </div>
  </div>
 */}
          <div className="rounded-2xl border border-foreground/10 bg-background p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-6">
              <div>
                <p className="text-xs font-mono uppercase text-muted-foreground mb-2">
                  Volume de prompts mensuels
                </p>
                <div className="flex items-end gap-3">
                  <span className="font-display text-4xl lg:text-5xl text-primary">
                    {formatPrompts(currentVolume.prompts)}
                  </span>
                  <span className="text-muted-foreground pb-1">prompts / mois</span>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                Ajustez le volume selon votre usage
              </div>
            </div>

            <input
              type="range"
              min="0"
              max={VOLUMES.length - 1}
              step="1"
              value={volumeIndex}
              onChange={(e) => setVolumeIndex(parseInt(e.target.value))}
              className="w-full h-2 bg-foreground/10 rounded-full appearance-none cursor-pointer accent-foreground"
            />

            <div className="grid grid-cols-6 gap-2 mt-4">
              {VOLUMES.map((volume, index) => {
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
                    <div className="text-[10px] font-mono uppercase mt-1">
                      prompts
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-px bg-foreground/10">
          {plans.map((plan, idx) => {
            const unavailable = plan.price === null;

            return (
              <div
                key={plan.name}
                className={`relative p-8 lg:p-10 bg-background ${
                  plan.popular ? "xl:-my-4 xl:py-12 border-2 rounded-2xl border-primary z-10" : ""
                } ${unavailable ? "opacity-80 grayscale" : ""}`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-8 px-3 py-1 bg-primary text-background text-xs font-mono uppercase">
                    Le plus populaire
                  </span>
                )}

                <div className="mb-8">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    {plan.icon}
                    <span className="font-mono text-xs">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <h3 className="font-display text-3xl text-primary mt-3">
                    {plan.name}
                  </h3>

                  <p className="text-sm text-muted-foreground mt-2 min-h-[40px]">
                    {plan.description}
                  </p>

                  <div className="mt-4 inline-flex px-3 py-1 border border-foreground/10 text-xs font-mono uppercase text-foreground">
                    {formatPrompts(plan.prompts)} prompts
                  </div>
                </div>

                <div className="mb-8 pb-8 border-b border-foreground/10">
                  {plan.price !== null ? (
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-5xl lg:text-6xl text-foreground">
                        {formatPrice(plan.price)}
                      </span>
                      {typeof plan.price === "number" && (
                        <span className="text-muted-foreground">/mo</span>
                      )}
                    </div>
                  ) : (
                    <span className="font-display text-4xl text-foreground">Custom</span>
                  )}
                </div>

                <ul className="space-y-4 mb-10 min-h-[240px]">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-foreground mt-0.5 shrink-0" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
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