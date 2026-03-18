"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, Check, Crown, Layers3, Rocket, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/features/shared/view/page-header";
import type { SimulatedPlan } from "@/features/models/core/model-access";
import { buildScopedHref, readOrganizationIdFromSearch, readSelectedOrganizationID, storeSelectedOrganizationID } from "@/shared/selection";
import { cn } from "@/shared/utils";
import { buildBillingBusinessModes, readStoredBillingPlan, storeBillingPlan, type BillingCycle } from "../core/business-modes";

type BillingTemplateProps = {
  routeSearch: string;
};

type BillingModeCopy = {
  description: string;
  fit: string;
  highlights: string[];
};

const MODE_COPY: Record<SimulatedPlan, BillingModeCopy> = {
  starter: {
    description: "Pour une marque qui lance ses premiers audits IA et veut garder une structure simple.",
    fit: "Ideal pour une seule marque ou une equipe fondatrice.",
    highlights: [
      "Pilotage simple sur un seul scope",
      "Audit IA initial et boucles d apprentissage rapides",
      "Operation lean sans gouvernance lourde",
    ],
  },
  growth: {
    description: "Pour une equipe qui industrialise les usages, ajoute des contributors et monte en cadence.",
    fit: "Ideal pour une marque en acceleration ou une BU en croissance.",
    highlights: [
      "Plus de volume sur les analyses et les corrections",
      "Couverture elargie des modeles IA suivis",
      "Meilleur cadence pour les equipes marketing et SEO",
    ],
  },
  pro: {
    description: "Pour un portefeuille de marques, un hub central ou une equipe qui veut operer a grande echelle.",
    fit: "Ideal pour des structures multi-marques ou des equipes centrales.",
    highlights: [
      "Quasi illimite pour piloter plusieurs flux simultanement",
      "Gouvernance plus robuste sur les usages internes",
      "Capacite a suivre des portefeuilles et des standards communs",
    ],
  },
  "agency-enterprise": {
    description: "Pour des organisations avec plusieurs clients, contraintes d achat, process securite et besoins custom.",
    fit: "Ideal pour les agences, groupes et environnements enterprise.",
    highlights: [
      "Mode sur mesure pour la gouvernance et le support",
      "Couverture client ou portefeuille a grande echelle",
      "Cadrage contractuel annuel et accompagnement dedie",
    ],
  },
};

const MODE_ICONS: Record<SimulatedPlan, LucideIcon> = {
  starter: Rocket,
  growth: Layers3,
  pro: Crown,
  "agency-enterprise": BriefcaseBusiness,
};

const COMPARISON_ROWS: Array<{
  label: string;
  values: Record<SimulatedPlan, string>;
}> = [
  {
    label: "Organisation cible",
    values: {
      starter: "Une marque, une equipe compacte, un premier terrain de jeu.",
      growth: "Une equipe qui monte en charge et structure ses rituels.",
      pro: "Portefeuille multi-marques ou equipe centrale.",
      "agency-enterprise": "Agence, groupe ou organisation avec achats et gouvernance dedies.",
    },
  },
  {
    label: "Cadence de travail",
    values: {
      starter: "Cycles courts, arbitrages manuels, priorisation simple.",
      growth: "Routines hebdo avec plus de volume et plusieurs interlocuteurs.",
      pro: "Pilotage continu sur plusieurs streams et arbitrages transverses.",
      "agency-enterprise": "Cadence custom avec pilotage client, legal et securite.",
    },
  },
  {
    label: "Gouvernance",
    values: {
      starter: "Decision rapide, peu de couches de validation.",
      growth: "Coordination marketing, produit et contenu.",
      pro: "Standardisation, partage des bonnes pratiques et ownership clair.",
      "agency-enterprise": "Workflow sur mesure, governance et accompagnement dedie.",
    },
  },
];

export function BillingTemplate({ routeSearch }: BillingTemplateProps) {
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(
    readOrganizationIdFromSearch(routeSearch) || readSelectedOrganizationID(),
  );
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [currentPlan, setCurrentPlan] = useState<SimulatedPlan>(() =>
    readStoredBillingPlan(readOrganizationIdFromSearch(routeSearch) || readSelectedOrganizationID()),
  );

  useEffect(() => {
    const nextOrganizationId = readOrganizationIdFromSearch(routeSearch) || readSelectedOrganizationID() || "";

    setSelectedOrganizationId((current) => (current === nextOrganizationId ? current : nextOrganizationId));

    if (nextOrganizationId !== "") {
      storeSelectedOrganizationID(nextOrganizationId);
    }
  }, [routeSearch]);

  useEffect(() => {
    setCurrentPlan(readStoredBillingPlan(selectedOrganizationId));
  }, [selectedOrganizationId]);

  const modes = buildBillingBusinessModes(currentPlan, billingCycle);
  const currentMode = modes.find((mode) => mode.isCurrent) ?? modes[0]!;
  const currentModeCopy = MODE_COPY[currentMode.id];
  const currentOrganizationLabel =
    selectedOrganizationId.trim() === "" ? "Aucune organisation selectionnee" : `Organisation ${selectedOrganizationId}`;

  const handleBillingCycleChange = (value: string) => {
    if (value === "monthly" || value === "yearly") {
      setBillingCycle(value);
    }
  };

  const handleSelectPlan = (plan: SimulatedPlan) => {
    if (selectedOrganizationId.trim() === "") return;

    storeBillingPlan(selectedOrganizationId, plan);
    setCurrentPlan(plan);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-2 pb-8 md:p-4 md:pb-10">
      <PageHeader
        title="Billing"
        baseline="Choisis le mode business de ton organisation pour piloter les quotas, la gouvernance et les limites visibles ailleurs dans l app."
        meta={
          <>
            <Badge variant="outline">Simulation locale</Badge>
            <Badge variant="outline">{currentOrganizationLabel}</Badge>
          </>
        }
        actions={
          <>
            <Tabs value={billingCycle} onValueChange={handleBillingCycleChange} className="w-full sm:w-auto">
              <TabsList aria-label="Billing cycle">
                <TabsTrigger value="monthly">Mensuel</TabsTrigger>
                <TabsTrigger value="yearly">Annuel</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button asChild variant="outline">
              <Link to={buildScopedHref("/organizations", { org: selectedOrganizationId })}>Voir l organisation</Link>
            </Button>
          </>
        }
        actionsClassName="gap-2"
      />

      <div className="space-y-4">
        {selectedOrganizationId.trim() === "" ? (
          <Card className="border-dashed border-border/70 bg-muted/20">
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Layers3 className="h-4 w-4 text-primary" />
                Selectionne une organisation depuis la sidebar pour enregistrer le mode business.
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                La page reste consultable sans contexte, mais la simulation billing n est sauvegardee que quand une organisation est active.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
          <Card className="overflow-hidden border-transparent bg-linear-to-br from-primary via-primary to-primary/80 text-primary-foreground shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.14)]">
            <CardContent className="relative p-6 md:p-7">
              <div className="absolute -right-12 -top-10 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
              <div className="relative space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge className="border-white/10 bg-white/15 text-primary-foreground hover:bg-white/15">
                      Mode actif
                    </Badge>
                    <h2 className="mt-3 text-3xl font-semibold tracking-tight">{currentMode.label}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-primary-foreground/84">
                      {currentModeCopy.description}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/12 bg-white/10 p-3">
                    <ArrowUpRight className="h-5 w-5 text-primary-foreground" />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/12 bg-white/10 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-primary-foreground/72">Quota</p>
                    <p className="mt-2 text-lg font-semibold">{currentMode.quotaLabel}</p>
                  </div>
                  <div className="rounded-2xl border border-white/12 bg-white/10 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-primary-foreground/72">Catalogue IA</p>
                    <p className="mt-2 text-lg font-semibold">{currentMode.modelLimitLabel}</p>
                  </div>
                  <div className="rounded-2xl border border-white/12 bg-white/10 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-primary-foreground/72">Cycle</p>
                    <p className="mt-2 text-lg font-semibold">{currentMode.cycleLabel}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm text-primary-foreground/84">
                  <Check className="h-4 w-4" />
                  {currentModeCopy.fit}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <Card className="border-border/70 bg-card/92">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Impact dans l app</CardTitle>
                <CardDescription>
                  Le choix active une simulation locale utilisee par les vues de pilotage.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>Les limites de modeles sur la page Models suivent directement le plan choisi ici.</p>
                <p>Le mode business donne aussi un cadre plus clair pour lire les besoins de gouvernance et de volume.</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/92">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Lecture business</CardTitle>
                <CardDescription>
                  Mensuel pour garder de la flexibilite, annuel pour structurer la projection.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>
                  {billingCycle === "yearly"
                    ? "Le mode annuel te force a penser capacite, gouvernance et arbitrage budgetaire sur la duree."
                    : "Le mode mensuel garde une lecture tactique et rapide pour ajuster le scope au fil des besoins."}
                </p>
                <p>Agency / Enterprise reste traite comme un cadre sur mesure plutot qu un package standardise.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {modes.map((mode) => {
            const Icon = MODE_ICONS[mode.id];
            const copy = MODE_COPY[mode.id];
            const hasOrganization = selectedOrganizationId.trim() !== "";

            return (
              <Card
                key={mode.id}
                className={cn(
                  "flex h-full flex-col border-border/70 transition-all",
                  mode.isCurrent
                    ? "border-transparent bg-linear-to-br from-primary via-primary to-primary/80 text-primary-foreground shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.14)]"
                    : "bg-card/95 hover:border-primary/28 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]",
                )}
              >
                <CardHeader className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "w-fit",
                          mode.isCurrent
                            ? "border-white/15 bg-white/12 text-primary-foreground"
                            : "border-primary/15 bg-primary/6 text-primary",
                        )}
                      >
                        {mode.badge}
                      </Badge>
                      <div className="space-y-1">
                        <CardTitle className={cn("text-xl", mode.isCurrent ? "text-primary-foreground" : "text-foreground")}>
                          {mode.label}
                        </CardTitle>
                        <CardDescription className={mode.isCurrent ? "text-primary-foreground/78" : "text-muted-foreground"}>
                          {copy.description}
                        </CardDescription>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
                        mode.isCurrent
                          ? "border-white/12 bg-white/12 text-primary-foreground"
                          : "border-primary/12 bg-primary/6 text-primary",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-5">
                  <div className="space-y-3">
                    <div className="grid gap-2 rounded-2xl border border-current/10 bg-black/0 p-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className={mode.isCurrent ? "text-primary-foreground/72" : "text-muted-foreground"}>Quota</span>
                        <span className="font-semibold">{mode.quotaLabel}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className={mode.isCurrent ? "text-primary-foreground/72" : "text-muted-foreground"}>Modeles</span>
                        <span className="font-semibold">{mode.modelLimitLabel}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className={mode.isCurrent ? "text-primary-foreground/72" : "text-muted-foreground"}>Cycle</span>
                        <span className="font-semibold">{mode.cycleLabel}</span>
                      </div>
                    </div>

                    <ul className={cn("space-y-2 text-sm leading-6", mode.isCurrent ? "text-primary-foreground/84" : "text-muted-foreground")}>
                      {copy.highlights.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Check className={cn("mt-1 h-4 w-4 shrink-0", mode.isCurrent ? "text-primary-foreground" : "text-primary")} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-auto space-y-3">
                    <p className={cn("text-sm leading-6", mode.isCurrent ? "text-primary-foreground/84" : "text-muted-foreground")}>
                      {copy.fit}
                    </p>
                    <Button
                      type="button"
                      variant={mode.isCurrent ? "outline" : "default"}
                      className={cn(
                        "w-full",
                        mode.isCurrent &&
                          "border-white/18 bg-white/10 text-primary-foreground hover:bg-white/14 hover:text-primary-foreground",
                      )}
                      disabled={!hasOrganization || mode.isCurrent}
                      onClick={() => handleSelectPlan(mode.id)}
                    >
                      {!hasOrganization
                        ? "Choisir une organisation"
                        : mode.isCurrent
                          ? "Plan actuel"
                          : `Activer ${mode.label}`}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <Card className="border-border/70 bg-card/92">
          <CardHeader>
            <CardTitle>Comparaison rapide des modes business</CardTitle>
            <CardDescription>
              Une lecture orientee organisation pour choisir la structure de pilotage la plus adaptee.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {COMPARISON_ROWS.map((row) => (
              <div
                key={row.label}
                className="grid gap-3 rounded-2xl border border-border/60 bg-background/72 p-3 md:grid-cols-[190px_repeat(4,minmax(0,1fr))]"
              >
                <div className="flex items-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {row.label}
                </div>
                {modes.map((mode) => (
                  <div
                    key={`${row.label}-${mode.id}`}
                    className={cn(
                      "rounded-xl border border-transparent p-3 text-sm leading-6",
                      mode.isCurrent ? "bg-primary/8 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)]" : "bg-muted/35 text-muted-foreground",
                    )}
                  >
                    <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/72">
                      {mode.label}
                    </div>
                    <p>{row.values[mode.id]}</p>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
