"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Coins,
  Database,
  Globe2,
  Link as LinkIcon,
  RefreshCcw,
  Rocket,
  Sparkles,
  Target,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { KpiCard } from "@/features/monitoring/components/analytics-panel/kpi-card";
import { DashboardSectionTitle } from "@/features/monitoring/components/dashboard-section-title";
import { PageHeader } from "@/features/shared/view/page-header";
import { apiRoutes } from "@/lib/api-config";
import { getDashboardQueryContext } from "@/lib/dashboard-data";
import { gatewayJSON } from "@/shared/api/gateway";
import { cn } from "@/shared/utils";

type ImpactTemplateProps = {
  apiBaseURL: string;
  routeSearch: string;
};

type ImpactProject = {
  id: string;
  name: string;
};

type ImpactFunnelSource = {
  source: string;
  visits: number;
  signups: number;
  trials: number;
  paid: number;
  revenueCents: number;
};

type ImpactFunnel = {
  projectId: string;
  visits: number;
  signups: number;
  trials: number;
  paid: number;
  revenueCents: number;
  visitToSignupRate: number;
  signupToTrialRate: number;
  trialToPaidRate: number;
  windowStart: string;
  windowEnd: string;
  visitsSource: string;
  sources: ImpactFunnelSource[];
};

type ImpactEvent = {
  id: number;
  stage: string;
  source: string;
  count: number;
  revenueCents: number;
  occurredAt: string;
  createdAt: string;
};

type ImpactData = {
  project: ImpactProject;
  funnel: ImpactFunnel;
  events: ImpactEvent[];
  integrations: ImpactIntegrations;
  warning: string | null;
};

type ImpactIntegrations = {
  projectId: string;
  ga4: {
    propertyId: string;
    hasServiceAccount: boolean;
    isConnected: boolean;
    connectedAt: string;
    updatedAt: string;
  };
  stripe: {
    hasWebhookSecret: boolean;
    isConnected: boolean;
    webhookPath: string;
    connectedAt: string;
    updatedAt: string;
  };
  ingestion: {
    hasSigningToken: boolean;
    isConnected: boolean;
    ingestPath: string;
    connectedAt: string;
    updatedAt: string;
    generatedToken: string;
  };
};

type ImpactSourceSummary = {
  source: string;
  visits: number;
  signups: number;
  trials: number;
  paid: number;
  revenueCents: number;
  share: number;
};

type ImpactRequestScope = "projects" | "project" | "funnel" | "events" | "integrations";

class ImpactRequestError extends Error {
  scope: ImpactRequestScope;
  status: number;

  constructor(scope: ImpactRequestScope, status: number, message?: string) {
    super(message || `impact request failed: ${scope}`);
    this.name = "ImpactRequestError";
    this.scope = scope;
    this.status = status;
  }
}

export function ImpactTemplate({ apiBaseURL, routeSearch }: ImpactTemplateProps) {
  const queryContext = useMemo(() => getDashboardQueryContext(routeSearch), [routeSearch]);

  const impactQuery = useQuery({
    queryKey: ["impact", apiBaseURL, queryContext.projectId ?? "__default__"],
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) => loadImpactData(apiBaseURL, routeSearch, signal),
  });

  const impact = impactQuery.data ?? null;
  const sourceSummary = useMemo(
    () => (impact ? buildSourceSummary(impact.funnel) : []),
    [impact],
  );
  const businessSummary = useMemo(
    () => (impact ? buildBusinessSummary(impact.funnel) : []),
    [impact],
  );

  if (impactQuery.isLoading && !impact) {
    return <ImpactLoadingState />;
  }

  if (!impact) {
    return (
      <ImpactUnavailableState
        error={impactQuery.error instanceof Error ? impactQuery.error.message : null}
        onReload={async () => {
          await impactQuery.refetch();
        }}
      />
    );
  }

  const connectedToolsCount =
    Number(impact.integrations.ga4.isConnected) +
    Number(impact.integrations.stripe.isConnected) +
    Number(impact.integrations.ingestion.isConnected);
  const hasConnectedTools = connectedToolsCount > 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-2 md:p-4">
      <PageHeader
        title="Impact"
        baseline="Reliez votre visibilite IA au trafic, aux inscriptions, aux essais et au revenu avec des sources backend reelles."
        meta={
          <>
            <Badge variant="outline">{impact.project.name}</Badge>
            {hasConnectedTools && impact.funnel.windowStart && impact.funnel.windowEnd ? (
              <Badge variant="outline">{formatWindowLabel(impact.funnel.windowStart, impact.funnel.windowEnd)}</Badge>
            ) : null}
            {hasConnectedTools ? (
              <Badge variant="outline">
              Visites: {impact.funnel.visitsSource === "ga4" ? "GA4" : "backend"}
              </Badge>
            ) : null}
          </>
        }
        actionsVariant="classic"
        actions={
          <Button type="button" variant="outline" onClick={() => void impactQuery.refetch()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Actualiser
          </Button>
        }
      />

      {impact.warning ? (
        <Card className="mt-4 border-amber-200 bg-amber-50/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-amber-900">Attribution partiellement indisponible</CardTitle>
            <CardDescription className="text-amber-800">{impact.warning}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!hasConnectedTools ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <ImpactActivationOverview projectName={impact.project.name} />
          <ImpactConnectionsPanel
            apiBaseURL={apiBaseURL}
            projectId={impact.project.id}
            integrations={impact.integrations}
            onRefresh={async () => {
              await impactQuery.refetch();
            }}
          />
        </div>
      ) : null}

      {hasConnectedTools ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Visites IA"
          value={formatCompactNumber(impact.funnel.visits)}
          sub={impact.funnel.visitsSource === "ga4" ? "Sessions IA lues depuis Google Analytics 4." : "Visites IA remontées par les événements backend."}
          trend={`${impact.funnel.visitToSignupRate}% vers inscription`}
          trendDir={impact.funnel.visitToSignupRate > 0 ? "up" : "stable"}
          variant="active"
        />
        <KpiCard
          title="Inscriptions"
          value={formatCompactNumber(impact.funnel.signups)}
          sub="Inscriptions ou créations de compte attribuées aux IA."
          trend={`${impact.funnel.signupToTrialRate}% vers essai`}
          trendDir={impact.funnel.signupToTrialRate > 0 ? "up" : "stable"}
        />
        <KpiCard
          title="Essais IA"
          value={formatCompactNumber(impact.funnel.trials)}
          sub="Essais detectes via les evenements backend et la facturation."
          trend={`${impact.funnel.trialToPaidRate}% vers paye`}
          trendDir={impact.funnel.trialToPaidRate > 0 ? "up" : "stable"}
        />
        <KpiCard
          title="Revenu IA"
          value={formatCurrency(impact.funnel.revenueCents)}
          sub="Revenu remonté automatiquement par les paiements Stripe."
          trend={
            impact.funnel.paid > 0
              ? `${formatCompactNumber(impact.funnel.paid)} clients payants`
              : "Aucun client payant"
          }
          trendDir={impact.funnel.paid > 0 ? "up" : "stable"}
        />
        </div>
      ) : null}

      {hasConnectedTools ? (
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
        <div className="space-y-4">
          <Card className="border-border/60 rounded-tr-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                <DashboardSectionTitle>Funnel IA</DashboardSectionTitle>
              </CardTitle>
              <CardDescription>
                Lecture directe du chemin visites {"->"} inscriptions {"->"} essais {"->"} paye sur les donnees d’attribution reelles.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 lg:grid-cols-4">
              <FunnelStageCard
                title="Visites"
                value={impact.funnel.visits}
                subtitle={impact.funnel.visitsSource === "ga4" ? "Source Google Analytics 4" : "Source backend"}
                icon={Sparkles}
                accent="primary"
              />
              <FunnelStageCard
                title="Inscriptions"
                value={impact.funnel.signups}
                subtitle={`${impact.funnel.visitToSignupRate}% des visites`}
                icon={UserPlus}
              />
              <FunnelStageCard
                title="Essais"
                value={impact.funnel.trials}
                subtitle={`${impact.funnel.signupToTrialRate}% des inscriptions`}
                icon={Target}
              />
              <FunnelStageCard
                title="Payé"
                value={impact.funnel.paid}
                subtitle={formatCurrency(impact.funnel.revenueCents)}
                icon={Coins}
              />
            </CardContent>
          </Card>

          <Card className="min-h-0 border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                <DashboardSectionTitle>Événements récents</DashboardSectionTitle>
              </CardTitle>
              <CardDescription>
                Derniers événements business remontés par le backend pour ce projet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {impact.events.length === 0 ? (
                <EmptyPanel
                  title="Aucun événement business récent"
                  description="Les inscriptions, essais et paiements apparaîtront ici des qu’ils seront recus par les services backend."
                />
              ) : (
                <ScrollArea className="h-[360px] pr-3 [&_[data-slot=scroll-area-scrollbar]]:w-2.5 [&_[data-slot=scroll-area-scrollbar]]:bg-muted/35 [&_[data-slot=scroll-area-thumb]]:rounded-full [&_[data-slot=scroll-area-thumb]]:border [&_[data-slot=scroll-area-thumb]]:border-background/60 [&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/55">
                  <div className="space-y-3 pb-4">
                    {impact.events.map((event) => (
                      <div key={event.id} className="rounded-xl border border-border/60 bg-background/80 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{formatStageLabel(event.stage)}</Badge>
                              <span className="text-sm font-medium text-foreground">{formatSourceLabel(event.source)}</span>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              {formatDateTime(event.occurredAt || event.createdAt)}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-lg font-semibold tabular-nums text-foreground">
                              {formatCompactNumber(event.count)}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {event.revenueCents > 0 ? formatCurrency(event.revenueCents) : "Sans revenu"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <ImpactConnectionsPanel
            apiBaseURL={apiBaseURL}
            projectId={impact.project.id}
            integrations={impact.integrations}
            onRefresh={async () => {
              await impactQuery.refetch();
            }}
          />

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                <DashboardSectionTitle>Sources IA</DashboardSectionTitle>
              </CardTitle>
              <CardDescription>
                Repartition du trafic et des conversions par source IA sur la fenetre affichee.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sourceSummary.length === 0 ? (
                <EmptyPanel
                  title="Aucune source IA detectee"
                  description="Des que GA4 ou les evenements backend remontent des sources IA, elles apparaissent ici."
                />
              ) : (
                <div className="space-y-3">
                  {sourceSummary.map((source) => (
                    <div key={source.source} className="rounded-xl border border-border/60 bg-background/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground">{formatSourceLabel(source.source)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatCompactNumber(source.visits)} visites • {source.share}% du trafic IA
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-semibold text-foreground">{formatCurrency(source.revenueCents)}</div>
                          <div className="text-[11px] text-muted-foreground">{formatCompactNumber(source.paid)} payants</div>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                        <div>{formatCompactNumber(source.signups)} inscriptions</div>
                        <div>{formatCompactNumber(source.trials)} essais</div>
                        <div>{formatCompactNumber(source.paid)} payants</div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted/60">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(6, Math.min(100, source.share))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                <DashboardSectionTitle>Lecture business</DashboardSectionTitle>
              </CardTitle>
              <CardDescription>
                Synthese rapide pour piloter l’impact business des IA.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {businessSummary.map((item) => (
                <div key={item.title} className="rounded-xl border border-border/60 bg-background/80 p-4">
                  <div className="text-sm font-semibold text-foreground">{item.title}</div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      ) : null}
    </div>
  );
}

function ImpactActivationOverview({
  projectName,
}: {
  projectName: string;
}) {
  return (
    <Card className="overflow-hidden border-border/60 rounded-tr-none">
      <CardHeader className="border-b border-border/60 bg-gradient-to-br from-primary/8 via-background to-background pb-5">
        <CardTitle className="flex items-center gap-2 text-base">
          <Rocket className="h-4 w-4 text-primary" />
          Activez Impact pour {projectName}
        </CardTitle>
        <CardDescription className="max-w-2xl">
          Tant qu’aucun outil n’est connecté, nous n’affichons pas de KPI ni de graphiques. Commencez par brancher
          une première source pour lancer l’analyse.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <ImpactSetupHint
            title="1. Trafic"
            description="Connectez Google Analytics pour voir les visites IA automatiquement."
          />
          <ImpactSetupHint
            title="2. Revenu"
            description="Ajoutez Stripe pour relier ce trafic aux essais et aux paiements."
          />
          <ImpactSetupHint
            title="3. Inscriptions"
            description="Terminez avec votre app ou votre CRM si vous voulez un funnel complet."
          />
        </div>

        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
          <div className="text-sm font-semibold text-foreground">Ce qui apparaîtra ensuite</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-background/85 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Globe2 className="h-4 w-4 text-primary" />
                Sources IA
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                ChatGPT, Perplexity et les autres sources commenceront à remonter.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/85 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Target className="h-4 w-4 text-primary" />
                Funnel
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Visites, inscriptions, essais et payants seront affichés étape par étape.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/85 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Coins className="h-4 w-4 text-primary" />
                Revenu
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Vous verrez enfin quelles sources IA génèrent du revenu, pas seulement du trafic.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelStageCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = "default",
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: typeof Sparkles;
  accent?: "default" | "primary";
}) {
  const isPrimary = accent === "primary";

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isPrimary ? "border-primary/25 bg-primary/5" : "border-border/60 bg-background/80"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{title}</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{formatCompactNumber(value)}</div>
        </div>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full ${
            isPrimary ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-xs leading-5 text-muted-foreground">{subtitle}</div>
    </div>
  );
}

function ImpactConnectionsPanel({
  apiBaseURL,
  projectId,
  integrations,
  onRefresh,
}: {
  apiBaseURL: string;
  projectId: string;
  integrations: ImpactIntegrations;
  onRefresh: () => Promise<void>;
}) {
  const [ga4PropertyId, setGa4PropertyId] = useState(integrations.ga4.propertyId);
  const [ga4ServiceAccountJSON, setGa4ServiceAccountJSON] = useState("");
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState("");
  const [generatedIngestionToken, setGeneratedIngestionToken] = useState("");
  const [openSection, setOpenSection] = useState<"ga4" | "ingestion" | "stripe" | null>(null);

  useEffect(() => {
    setGa4PropertyId(integrations.ga4.propertyId);
    setGa4ServiceAccountJSON("");
    setStripeWebhookSecret("");
  }, [integrations.ga4.propertyId, integrations.ga4.updatedAt, integrations.stripe.updatedAt, projectId]);

  useEffect(() => {
    setGeneratedIngestionToken("");
  }, [projectId]);

  const saveMutation = useMutation({
    mutationFn: async (body: unknown) => {
      const result = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.impactIntegrations(encodeURIComponent(projectId)), {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!result.ok) {
        throw new Error(result.error);
      }
      return normalizeIntegrations(unwrapRequiredEnvelope(result, "integrations"), projectId);
    },
    onSuccess: async (value, body) => {
      const payload = asObject(body);
      if (payload.ingestion && typeof payload.ingestion === "object") {
        const ingestionBody = payload.ingestion as { disconnect?: unknown };
        setGeneratedIngestionToken(
          ingestionBody.disconnect ? "" : value.ingestion.generatedToken,
        );
      }
      await onRefresh();
    },
  });

  const webhookURL = buildAbsoluteURL(apiBaseURL, integrations.stripe.webhookPath || apiRoutes.attribution.stripeWebhook(projectId));
  const ingestionURL = buildAbsoluteURL(apiBaseURL, integrations.ingestion.ingestPath || apiRoutes.attribution.ingest(projectId));
  const isSaving = saveMutation.isPending;
  const error = saveMutation.error instanceof Error ? saveMutation.error.message : null;
  const canSaveGA4 = ga4PropertyId.trim() !== "" && (integrations.ga4.hasServiceAccount || ga4ServiceAccountJSON.trim() !== "");
  const ingestionSample = buildIngestionSample(ingestionURL, generatedIngestionToken);
  const setupSteps = [
    {
      id: "ga4" as const,
      title: "Connecter Google Analytics",
      connected: integrations.ga4.isConnected,
      summary: "Pour voir automatiquement les visites IA sur votre site et connaître les sources comme ChatGPT ou Perplexity.",
    },
    {
      id: "stripe" as const,
      title: "Connecter Stripe",
      connected: integrations.stripe.isConnected,
      summary: "Pour remonter automatiquement les essais et les paiements, sans ressaisie manuelle.",
    },
    {
      id: "ingestion" as const,
      title: "Relier votre app ou CRM",
      connected: integrations.ingestion.isConnected,
      summary: "Pour compter les inscriptions. Cette étape peut venir après le trafic et le revenu.",
    },
  ];
  const connectedCount = setupSteps.filter((step) => step.connected).length;
  const completion = Math.round((connectedCount / setupSteps.length) * 100);
  const nextAction = !integrations.ga4.isConnected
    ? "Commencez par Google Analytics. C’est la première étape pour voir votre trafic IA."
    : !integrations.stripe.isConnected
      ? "Ajoutez ensuite Stripe pour relier ce trafic aux essais et au revenu."
      : !integrations.ingestion.isConnected
        ? "Il ne reste plus qu’à connecter votre app ou votre CRM pour compter les inscriptions."
        : "Le projet est branché de bout en bout. Impact peut maintenant lire tout votre funnel.";
  const noCodeNote = !integrations.ingestion.isConnected
    ? "Vous pouvez commencer sans l’étape App / CRM. Le trafic et le revenu fonctionneront déjà avec Google Analytics et Stripe."
    : "Toutes les sources utiles sont branchées pour ce projet.";

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          <DashboardSectionTitle>Connexions du projet</DashboardSectionTitle>
        </CardTitle>
        <CardDescription>
          Activez `Impact` étape par étape. Le panneau masque la technique et vous guide sur l’ordre le plus simple.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/8 via-background to-background p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Rocket className="h-4 w-4 text-primary" />
                Activation guidée
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                L’objectif est simple: brancher votre trafic, votre revenu puis, si besoin, vos inscriptions. Vous
                pouvez avancer étape par étape.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {setupSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium",
                      step.connected
                        ? "border-primary/20 bg-primary/10 text-foreground"
                        : "border-border/70 bg-background/80 text-muted-foreground",
                    )}
                  >
                    {step.connected ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <CircleDashed className="h-3.5 w-3.5" />}
                    <span>{index + 1}. {step.title}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full rounded-2xl border border-border/60 bg-background/90 p-4 xl:max-w-[240px]">
              <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Progression</div>
              <div className="mt-2 text-3xl font-semibold text-foreground">{connectedCount}/3</div>
              <div className="mt-1 text-sm text-muted-foreground">sources principales connectées</div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted/70">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(completion, 8)}%` }} />
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm leading-6 text-muted-foreground">
            <span className="font-medium text-foreground">Prochaine étape:</span> {nextAction}
            <div className="mt-1 text-xs text-muted-foreground">{noCodeNote}</div>
          </div>
        </div>

        <ImpactSetupCard
          step={1}
          title="Connecter Google Analytics"
          description="Pour détecter les visites IA qui arrivent sur votre site."
          connected={integrations.ga4.isConnected}
          recommended={!integrations.ga4.isConnected}
          summary={setupSteps[0].summary}
          updatedAt={integrations.ga4.updatedAt}
          onToggle={() => setOpenSection((current) => (current === "ga4" ? null : "ga4"))}
          open={openSection === "ga4"}
          actionLabel={integrations.ga4.isConnected ? "Modifier" : "Configurer"}
          icon={<Globe2 className="h-4 w-4" />}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <ImpactSetupHint
              title="Ce que vous obtenez"
              description="Les visites IA remontent automatiquement dans Impact, source par source."
            />
            <ImpactSetupHint
              title="Ce qu’il faut préparer"
              description="L’ID de propriété GA4 du projet et la clé Google du compte de service."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="impact-ga4-property">ID de propriété Google Analytics</Label>
            <Input
              id="impact-ga4-property"
              value={ga4PropertyId}
              onChange={(event) => setGa4PropertyId(event.target.value)}
              placeholder="123456789"
            />
            <p className="text-xs text-muted-foreground">
              Ce numéro permet de savoir quelle propriété GA4 lire pour ce projet.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="impact-ga4-service-account">Clé Google Analytics</Label>
            <Textarea
              id="impact-ga4-service-account"
              value={ga4ServiceAccountJSON}
              onChange={(event) => setGa4ServiceAccountJSON(event.target.value)}
              placeholder={
                integrations.ga4.hasServiceAccount
                  ? "Laissez vide pour conserver la clé déjà enregistrée."
                  : "Collez ici la clé Google fournie pour ce projet."
              }
              className="min-h-28"
            />
            <p className="text-xs text-muted-foreground">
              Si vous l’avez déjà enregistrée, il n’est pas nécessaire de la recoller.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {integrations.ga4.updatedAt
                ? `Dernière mise à jour: ${formatDateTime(integrations.ga4.updatedAt)}`
                : "Google Analytics n’est pas encore connecté pour ce projet."}
            </div>
            <div className="flex flex-wrap gap-2">
              {integrations.ga4.isConnected ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => saveMutation.mutate({ ga4: { disconnect: true } })}
                >
                  Déconnecter
                </Button>
              ) : null}
              <Button
                type="button"
                disabled={isSaving || !canSaveGA4}
                onClick={() =>
                  saveMutation.mutate({
                    ga4: {
                      propertyId: ga4PropertyId.trim(),
                      ...(ga4ServiceAccountJSON.trim() !== ""
                        ? { serviceAccountJSON: ga4ServiceAccountJSON.trim() }
                        : {}),
                    },
                  })
                }
              >
                Enregistrer Google Analytics
              </Button>
            </div>
          </div>
        </ImpactSetupCard>

        <ImpactSetupCard
          step={2}
          title="Connecter Stripe"
          description="Pour relier les essais et le revenu au trafic IA."
          connected={integrations.stripe.isConnected}
          recommended={integrations.ga4.isConnected && !integrations.stripe.isConnected}
          summary={setupSteps[1].summary}
          updatedAt={integrations.stripe.updatedAt}
          onToggle={() => setOpenSection((current) => (current === "stripe" ? null : "stripe"))}
          open={openSection === "stripe"}
          actionLabel={integrations.stripe.isConnected ? "Modifier" : "Configurer"}
          icon={<Coins className="h-4 w-4" />}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <ImpactSetupHint
              title="Ce que vous obtenez"
              description="Les essais et les paiements Stripe alimentent automatiquement votre funnel Impact."
            />
            <ImpactSetupHint
              title="Ce qu’il faut préparer"
              description="Le secret du webhook Stripe du projet, plus l’URL à coller dans Stripe."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="impact-stripe-webhook-url">URL webhook à coller dans Stripe</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="impact-stripe-webhook-url" value={webhookURL} readOnly />
              <Button
                type="button"
                variant="outline"
                onClick={() => void navigator.clipboard?.writeText(webhookURL)}
              >
                <LinkIcon className="mr-2 h-4 w-4" />
                Copier
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="impact-stripe-webhook-secret">Secret Stripe</Label>
            <Input
              id="impact-stripe-webhook-secret"
              type="password"
              value={stripeWebhookSecret}
              onChange={(event) => setStripeWebhookSecret(event.target.value)}
              placeholder={
                integrations.stripe.hasWebhookSecret
                  ? "Laissez vide pour conserver le secret déjà enregistré."
                  : "whsec_..."
              }
            />
            <p className="text-xs text-muted-foreground">
              Stripe vous donne ce secret lorsque vous créez le webhook du projet.
            </p>
          </div>

          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-xs leading-6 text-muted-foreground">
            Astuce: ajoutez aussi `ai_source` ou `attribution_source` dans les métadonnées Stripe pour rattacher plus
            finement les conversions à la bonne source IA.
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {integrations.stripe.updatedAt
                ? `Dernière mise à jour: ${formatDateTime(integrations.stripe.updatedAt)}`
                : "Stripe n’est pas encore connecté pour ce projet."}
            </div>
            <div className="flex flex-wrap gap-2">
              {integrations.stripe.isConnected ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => saveMutation.mutate({ stripe: { disconnect: true } })}
                >
                  Déconnecter
                </Button>
              ) : null}
              <Button
                type="button"
                disabled={isSaving || stripeWebhookSecret.trim() === ""}
                onClick={() =>
                  saveMutation.mutate({
                    stripe: {
                      webhookSecret: stripeWebhookSecret.trim(),
                    },
                  })
                }
              >
                Enregistrer Stripe
              </Button>
            </div>
          </div>
        </ImpactSetupCard>

        <ImpactSetupCard
          step={3}
          title="Relier votre app ou votre CRM"
          description="Pour compter les inscriptions, si vous voulez un funnel complet."
          connected={integrations.ingestion.isConnected}
          recommended={integrations.ga4.isConnected && integrations.stripe.isConnected && !integrations.ingestion.isConnected}
          summary={setupSteps[2].summary}
          updatedAt={integrations.ingestion.updatedAt}
          onToggle={() => setOpenSection((current) => (current === "ingestion" ? null : "ingestion"))}
          open={openSection === "ingestion"}
          actionLabel={integrations.ingestion.isConnected ? "Voir les détails" : "Configurer"}
          icon={<Database className="h-4 w-4" />}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <ImpactSetupHint
              title="Ce que vous obtenez"
              description="Les inscriptions remontent dans Impact et complètent le funnel entre les visites et le revenu."
            />
            <ImpactSetupHint
              title="Quand le faire"
              description="Cette étape est utile si vous voulez un funnel complet. Elle peut venir après GA4 et Stripe."
            />
          </div>

          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm leading-6 text-muted-foreground">
            Si vous utilisez déjà un CRM, un outil comme Zapier ou un backend maison, il suffit de générer une clé puis
            de transmettre l’exemple ci-dessous à la personne qui gère votre stack.
          </div>

          <div className="grid gap-2">
            <Label htmlFor="impact-ingestion-url">URL d’ingestion</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="impact-ingestion-url" value={ingestionURL} readOnly />
              <Button
                type="button"
                variant="outline"
                onClick={() => void navigator.clipboard?.writeText(ingestionURL)}
              >
                <LinkIcon className="mr-2 h-4 w-4" />
                Copier
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="impact-ingestion-token">Clé projet</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="impact-ingestion-token"
                type="password"
                value={generatedIngestionToken}
                readOnly
                placeholder={
                  integrations.ingestion.isConnected
                    ? "La clé n’est visible qu’après génération ou rotation."
                    : "Générez une clé projet pour votre app ou votre CRM."
                }
              />
              <Button
                type="button"
                variant="outline"
                disabled={generatedIngestionToken.trim() === ""}
                onClick={() => void navigator.clipboard?.writeText(generatedIngestionToken)}
              >
                <LinkIcon className="mr-2 h-4 w-4" />
                Copier
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="impact-ingestion-sample">Exemple prêt à partager</Label>
            <Textarea
              id="impact-ingestion-sample"
              value={ingestionSample}
              readOnly
              className="min-h-32 font-mono text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {integrations.ingestion.updatedAt
                ? `Dernière mise à jour: ${formatDateTime(integrations.ingestion.updatedAt)}`
                : "Aucune connexion App / CRM enregistrée."}
            </div>
            <div className="flex flex-wrap gap-2">
              {integrations.ingestion.isConnected ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => {
                    setGeneratedIngestionToken("");
                    saveMutation.mutate({ ingestion: { disconnect: true } });
                  }}
                >
                  Déconnecter
                </Button>
              ) : null}
              <Button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setOpenSection("ingestion");
                  saveMutation.mutate({ ingestion: { rotate: true } });
                }}
              >
                {integrations.ingestion.isConnected ? "Régénérer la clé" : "Générer la clé"}
              </Button>
            </div>
          </div>
        </ImpactSetupCard>

        {error ? <div className="text-sm text-destructive">{error}</div> : null}
      </CardContent>
    </Card>
  );
}

function ImpactSetupCard({
  step,
  title,
  description,
  connected,
  recommended,
  summary,
  updatedAt,
  icon,
  open,
  actionLabel,
  onToggle,
  children,
}: {
  step: number;
  title: string;
  description: string;
  connected: boolean;
  recommended?: boolean;
  summary: string;
  updatedAt: string;
  icon: React.ReactNode;
  open: boolean;
  actionLabel: string;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/90 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-muted/35 text-foreground">
            <div className="flex flex-col items-center justify-center">
              {icon}
              <span className="mt-1 text-[10px] font-semibold">{step}</span>
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-foreground">{title}</div>
              {recommended ? <Badge className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">Recommandé</Badge> : null}
              <Badge variant="outline" className={cn(connected ? "border-primary/20 text-primary" : "")}>
                {connected ? "Connecté" : "À faire"}
              </Badge>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>

        <Button type="button" variant="outline" onClick={onToggle} className="gap-2">
          {actionLabel}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open ? "rotate-180" : "")} />
        </Button>
      </div>

      <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm leading-6 text-muted-foreground">
        {summary}
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        {updatedAt ? `Dernière mise à jour: ${formatDateTime(updatedAt)}` : "Pas encore de connexion enregistrée."}
      </div>

      {open ? <div className="mt-4 space-y-4 rounded-2xl border border-dashed border-border/70 bg-background/70 p-4">{children}</div> : null}
    </div>
  );
}

function ImpactSetupHint({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/80 p-4">
      <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{title}</div>
      <div className="mt-2 text-sm leading-6 text-foreground">{description}</div>
    </div>
  );
}

function EmptyPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-8">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function ImpactLoadingState() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <div className="space-y-3 px-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-[40rem] max-w-full" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>

      <div className="mt-4 grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-[440px] w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function ImpactUnavailableState({
  error,
  onReload,
}: {
  error: string | null;
  onReload: () => Promise<void>;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title="Impact"
        baseline="Reliez la visibilite IA au trafic, aux leads, aux essais et au revenu."
        actionsVariant="classic"
        actions={
          <Button variant="outline" onClick={() => void onReload()}>
            Reessayer
          </Button>
        }
      />

      <Card className="mt-4 border-border/60">
        <CardHeader>
          <CardTitle>Impossible de charger l’impact</CardTitle>
          <CardDescription>
            {error || "Aucune donnee d’attribution n’est disponible pour ce projet."}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

async function loadImpactData(
  apiBaseURL: string,
  routeSearch: string,
  signal?: AbortSignal,
): Promise<ImpactData> {
  const { projectId: routeProjectId } = getDashboardQueryContext(routeSearch);
  let projectId = routeProjectId;

  if (!projectId) {
    const projectsPayload = unwrapRequiredEnvelope(
      await gatewayJSON<unknown>(apiBaseURL, "/projects", { method: "GET", signal }),
      "projects",
    );
    const projects = asArray(projectsPayload).map(asObject);
    const first = projects[0];
    if (first) {
      projectId = asString(first.id || first.ID);
    }
  }

  if (!projectId) {
    throw new Error("Aucun projet disponible.");
  }

  const encodedProjectId = encodeURIComponent(projectId);
  const projectRes = await gatewayJSON<unknown>(apiBaseURL, `/projects/${encodedProjectId}`, {
    method: "GET",
    signal,
  });
  const [funnelResult, eventsResult, integrationsResult] = await Promise.all([
    loadFunnelOrFallback(apiBaseURL, encodedProjectId, projectId, signal),
    loadEventsOrFallback(apiBaseURL, encodedProjectId, signal),
    loadIntegrationsOrFallback(apiBaseURL, encodedProjectId, projectId, signal),
  ]);

  const project = normalizeProject(unwrapRequiredEnvelope(projectRes, "project"));
  const warning = [funnelResult.warning, eventsResult.warning, integrationsResult.warning].filter(Boolean).join(" ");

  return {
    project,
    funnel: funnelResult.funnel,
    events: eventsResult.events,
    integrations: integrationsResult.integrations,
    warning: warning || null,
  };
}

async function loadFunnelOrFallback(
  apiBaseURL: string,
  encodedProjectId: string,
  projectId: string,
  signal?: AbortSignal,
): Promise<{ funnel: ImpactFunnel; warning: string | null }> {
  try {
    const result = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.attribution.funnel(encodedProjectId), {
      method: "GET",
      signal,
    });
    return {
      funnel: normalizeFunnel(unwrapRequiredEnvelope(result, "funnel"), projectId),
      warning: null,
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    return {
      funnel: createEmptyFunnel(projectId),
      warning:
        "Le service d’attribution n’a pas repondu. Les KPI impact affichent donc un etat vide temporaire.",
    };
  }
}

async function loadEventsOrFallback(
  apiBaseURL: string,
  encodedProjectId: string,
  signal?: AbortSignal,
): Promise<{ events: ImpactEvent[]; warning: string | null }> {
  try {
    const result = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.attribution.events(encodedProjectId, { limit: 30 }), {
      method: "GET",
      signal,
    });
    return {
      events: normalizeEvents(unwrapRequiredEnvelope(result, "events")),
      warning: null,
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    return {
      events: [],
      warning: "Les evenements recents d’attribution sont indisponibles pour le moment.",
    };
  }
}

async function loadIntegrationsOrFallback(
  apiBaseURL: string,
  encodedProjectId: string,
  projectId: string,
  signal?: AbortSignal,
): Promise<{ integrations: ImpactIntegrations; warning: string | null }> {
  try {
    const result = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.impactIntegrations(encodedProjectId), {
      method: "GET",
      signal,
    });
    return {
      integrations: normalizeIntegrations(unwrapRequiredEnvelope(result, "integrations"), projectId),
      warning: null,
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    return {
      integrations: createEmptyIntegrations(projectId),
      warning: "Les connexions GA4, Stripe et App / CRM du projet sont temporairement indisponibles.",
    };
  }
}

function unwrapRequiredEnvelope<T>(
  result: Awaited<ReturnType<typeof gatewayJSON<T>>>,
  scope: ImpactRequestScope,
): unknown {
  if (!result.ok) {
    throw new ImpactRequestError(scope, result.status, result.error);
  }

  const payload = result.data;
  if (payload && typeof payload === "object" && "data" in (payload as Record<string, unknown>)) {
    return (payload as unknown as { data: unknown }).data;
  }
  return payload;
}

function normalizeProject(payload: unknown): ImpactProject {
  const record = asObject(payload);
  return {
    id: asString(record.id || record.ID),
    name:
      asString(record.brandName || record.BrandName) ||
      asString(record.name || record.Name) ||
      "Projet sans nom",
  };
}

function normalizeFunnel(payload: unknown, projectId: string): ImpactFunnel {
  const record = asObject(payload);
  return {
    projectId: asString(record.projectId || record.ProjectID) || projectId,
    visits: asNumber(record.visits || record.Visits),
    signups: asNumber(record.signups || record.Signups),
    trials: asNumber(record.trials || record.Trials),
    paid: asNumber(record.paid || record.Paid),
    revenueCents: asNumber(record.revenueCents || record.RevenueCents),
    visitToSignupRate: asNumber(record.visitToSignupRate || record.VisitToSignupRate),
    signupToTrialRate: asNumber(record.signupToTrialRate || record.SignupToTrialRate),
    trialToPaidRate: asNumber(record.trialToPaidRate || record.TrialToPaidRate),
    windowStart: asString(record.windowStart || record.WindowStart),
    windowEnd: asString(record.windowEnd || record.WindowEnd),
    visitsSource: asString(record.visitsSource || record.VisitsSource),
    sources: normalizeSources(record.sources || record.Sources),
  };
}

function createEmptyFunnel(projectId: string): ImpactFunnel {
  return {
    projectId,
    visits: 0,
    signups: 0,
    trials: 0,
    paid: 0,
    revenueCents: 0,
    visitToSignupRate: 0,
    signupToTrialRate: 0,
    trialToPaidRate: 0,
    windowStart: "",
    windowEnd: "",
    visitsSource: "",
    sources: [],
  };
}

function normalizeIntegrations(payload: unknown, projectId: string): ImpactIntegrations {
  const record = asObject(payload);
  const ga4 = asObject(record.ga4 || record.GA4);
  const stripe = asObject(record.stripe || record.Stripe);
  const ingestion = asObject(record.ingestion || record.Ingestion);
  return {
    projectId: asString(record.projectId || record.ProjectID) || projectId,
    ga4: {
      propertyId: asString(ga4.propertyId || ga4.PropertyID),
      hasServiceAccount: asBool(ga4.hasServiceAccount || ga4.HasServiceAccount),
      isConnected: asBool(ga4.isConnected || ga4.IsConnected),
      connectedAt: asString(ga4.connectedAt || ga4.ConnectedAt),
      updatedAt: asString(ga4.updatedAt || ga4.UpdatedAt),
    },
    stripe: {
      hasWebhookSecret: asBool(stripe.hasWebhookSecret || stripe.HasWebhookSecret),
      isConnected: asBool(stripe.isConnected || stripe.IsConnected),
      webhookPath: asString(stripe.webhookPath || stripe.WebhookPath),
      connectedAt: asString(stripe.connectedAt || stripe.ConnectedAt),
      updatedAt: asString(stripe.updatedAt || stripe.UpdatedAt),
    },
    ingestion: {
      hasSigningToken: asBool(ingestion.hasSigningToken || ingestion.HasSigningToken),
      isConnected: asBool(ingestion.isConnected || ingestion.IsConnected),
      ingestPath: asString(ingestion.ingestPath || ingestion.IngestPath),
      connectedAt: asString(ingestion.connectedAt || ingestion.ConnectedAt),
      updatedAt: asString(ingestion.updatedAt || ingestion.UpdatedAt),
      generatedToken: asString(ingestion.generatedToken || ingestion.GeneratedToken),
    },
  };
}

function createEmptyIntegrations(projectId: string): ImpactIntegrations {
  return {
    projectId,
    ga4: {
      propertyId: "",
      hasServiceAccount: false,
      isConnected: false,
      connectedAt: "",
      updatedAt: "",
    },
    stripe: {
      hasWebhookSecret: false,
      isConnected: false,
      webhookPath: apiRoutes.attribution.stripeWebhook(projectId),
      connectedAt: "",
      updatedAt: "",
    },
    ingestion: {
      hasSigningToken: false,
      isConnected: false,
      ingestPath: apiRoutes.attribution.ingest(projectId),
      connectedAt: "",
      updatedAt: "",
      generatedToken: "",
    },
  };
}

function normalizeSources(payload: unknown): ImpactFunnelSource[] {
  return asArray(payload)
    .map(asObject)
    .map((record) => ({
      source: asString(record.source || record.Source),
      visits: asNumber(record.visits || record.Visits),
      signups: asNumber(record.signups || record.Signups),
      trials: asNumber(record.trials || record.Trials),
      paid: asNumber(record.paid || record.Paid),
      revenueCents: asNumber(record.revenueCents || record.RevenueCents),
    }))
    .filter((item) => item.source.trim() !== "");
}

function normalizeEvents(payload: unknown): ImpactEvent[] {
  return asArray(payload)
    .map(asObject)
    .map((record) => ({
      id: asNumber(record.id || record.ID),
      stage: asString(record.stage || record.Stage),
      source: asString(record.source || record.Source),
      count: asNumber(record.count || record.Count),
      revenueCents: asNumber(record.revenueCents || record.RevenueCents),
      occurredAt: asString(record.occurredAt || record.OccurredAt),
      createdAt: asString(record.createdAt || record.CreatedAt),
    }))
    .sort((left, right) => (right.occurredAt || right.createdAt).localeCompare(left.occurredAt || left.createdAt));
}

function buildAbsoluteURL(baseURL: string, path: string): string {
  const normalizedBase = baseURL.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function buildIngestionSample(ingestionURL: string, signingToken: string): string {
  return [
    "curl -X POST \\",
    `  '${ingestionURL}' \\`,
    `  -H 'Authorization: Bearer ${signingToken || "iat_votre_cle"}' \\`,
    "  -H 'Content-Type: application/json' \\",
    "  -d '{",
    '    "stage": "signup",',
    '    "source": "chatgpt",',
    '    "count": 1,',
    `    "occurredAt": "${new Date().toISOString()}"`,
    "  }'",
  ].join("\n");
}

function buildSourceSummary(funnel: ImpactFunnel): ImpactSourceSummary[] {
  const totalVisits = funnel.visits > 0 ? funnel.visits : funnel.sources.reduce((sum, item) => sum + item.visits, 0);
  const denominator = totalVisits > 0 ? totalVisits : 1;

  return [...funnel.sources]
    .map((item) => ({
      source: item.source,
      visits: item.visits,
      signups: item.signups,
      trials: item.trials,
      paid: item.paid,
      revenueCents: item.revenueCents,
      share: Math.round((item.visits / denominator) * 100),
    }))
    .sort((left, right) => right.visits - left.visits)
    .slice(0, 6);
}

function buildBusinessSummary(funnel: ImpactFunnel) {
  return [
    {
      title: "Trafic IA",
      description:
        funnel.visits > 0
          ? `${formatCompactNumber(funnel.visits)} visites IA detectees sur la periode, avec une source ${
              funnel.visitsSource === "ga4" ? "Google Analytics 4" : "backend"
            }.`
          : "Aucune visite IA attribuee n’a encore ete detectee.",
    },
    {
      title: "Conversion amont",
      description:
        funnel.signups > 0
          ? `${funnel.visitToSignupRate}% des visites passent en inscription, puis ${funnel.signupToTrialRate}% en essai.`
          : "Le funnel est branche, mais aucune inscription IA n’a encore ete remontee.",
    },
    {
      title: "Monetisation",
      description:
        funnel.paid > 0 || funnel.revenueCents > 0
          ? `${formatCompactNumber(funnel.paid)} clients payants attribues, pour ${formatCurrency(funnel.revenueCents)} de revenu IA.`
          : "Aucun revenu attribue aux IA pour le moment.",
    },
  ];
}

function formatStageLabel(stage: string) {
  if (stage === "visit") return "Visite";
  if (stage === "signup") return "Inscription";
  if (stage === "trial") return "Essai";
  if (stage === "paid") return "Paye";
  return stage || "Etape inconnue";
}

function formatSourceLabel(source: string) {
  const normalized = source.trim();
  if (!normalized) return "Source inconnue";

  return normalized
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDateTime(value: string) {
  if (!value) return "Date inconnue";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function formatWindowLabel(start: string, end: string) {
  return `${formatShortDate(start)} -> ${formatShortDate(end)}`;
}

function formatShortDate(value: string) {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asBool(value: unknown): boolean {
  return value === true;
}
