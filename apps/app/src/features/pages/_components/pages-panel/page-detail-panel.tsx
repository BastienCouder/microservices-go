import { ExternalLink, Lightbulb, Link2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { KpiCard, type KpiCardProps } from "@/components/shared/kpi-card";
import { SectionTitle } from "@/components/shared/section-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDateTime } from "@/shared/utils";

import {
  buildPageCitationSamples,
  buildPageGeoNeed,
  buildPageModelBreakdown,
  type PageCitationSample,
  type PageGeoNeed,
  type PageModelBreakdownItem,
} from "../../_lib/pages-panel/page-detail-view-data";
import type { PageInsight } from "../../_lib/pages-panel/types";
import { ModelBadgeItem } from "./model-badge";

type PageDetailPanelProps = {
  errorLabel?: string | null;
  page: PageInsight | null;
  loading?: boolean;
};

function PageKpiGrid({ page }: { page: PageInsight }) {
  const metrics: Array<
    Pick<KpiCardProps, "title" | "value" | "sub" | "variant">
  > = [
    {
      title: "Visibilité",
      value: `${page.citationShare}%`,
      sub: "Part des réponses qui citent cette URL",
      variant: "active" as const,
    },
    {
      title: "Citations",
      value: String(page.citationCount),
      sub: "Occurrences détectées",
    },
    {
      title: "Réponses",
      value: String(page.promptCount),
      sub: "Réponses avec cette page",
    },
    {
      title: "LLMs",
      value: String(page.modelCount),
      sub: "Modèles qui la reprennent",
    },
  ];

  return (
    <div className="grid w-full grid-cols-2 gap-3">
      {metrics.map((metric) => (
        <KpiCard
          mini={true}
          key={metric.title}
          title={metric.title}
          value={metric.value}
          sub={metric.sub}
          variant={metric.variant}
          className="h-full min-w-0"
        />
      ))}
    </div>
  );
}

function ModelBreakdown({ models }: { models: PageModelBreakdownItem[] }) {
  if (models.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <SectionTitle>Répartition LLM</SectionTitle>
      <div className="overflow-hidden rounded-md border border-border/60 bg-background">
        {models.map((model, index) => (
          <div key={model.id}>
            {index > 0 ? <Separator /> : null}
            <div className="px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <ModelBadgeItem badge={model} />
                <span className="shrink-0 font-mono text-xs font-semibold text-foreground">
                  {model.coverageShare}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, model.coverageShare)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  <strong className="font-semibold text-foreground">{model.responseCount}</strong>{" "}
                  réponses
                </span>
                <span className="h-3 w-px bg-border" />
                <span>
                  <strong className="font-semibold text-foreground">{model.citationCount}</strong>{" "}
                  citations
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CitationSamplesList({ samples }: { samples: PageCitationSample[] }) {
  const navigate = useNavigate();

  return (
    <section className="min-h-0 flex-1 space-y-3 overflow-hidden">
      <SectionTitle>Réponses qui citent cette page</SectionTitle>
      <div className="h-[300px] overflow-y-auto rounded-md border border-border/60 bg-background">
        {samples.map((sample, index) => (
          <div key={sample.detailKey}>
            {index > 0 ? <Separator /> : null}
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams();
                params.set("tab", "responses");
                if (sample.promptId) {
                  params.set("focusPromptId", sample.promptId);
                }
                if (sample.responseId) {
                  params.set("responseId", sample.responseId);
                }
                navigate({
                  pathname: "/prompts",
                  search: `?${params.toString()}`,
                });
              }}
              className="group w-full p-4 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
            >
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {sample.model ? (
                    <ModelBadgeItem badge={sample.model} />
                  ) : (
                    <Badge variant="outline" className="font-normal">
                      Modèle inconnu
                    </Badge>
                  )}
                  {sample.persona ? (
                    <Badge variant="outline" className="max-w-[140px] truncate font-normal">
                      {sample.persona}
                    </Badge>
                  ) : null}
                </div>
                {sample.time ? (
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {sample.time}
                  </span>
                ) : null}
              </div>

              <p className="mb-2 line-clamp-2 text-xs font-medium leading-relaxed text-muted-foreground">
                {sample.prompt}
              </p>
              <p className="line-clamp-4 text-sm font-medium leading-relaxed text-foreground/90 transition-colors group-hover:text-foreground">
                {sample.response}
              </p>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function DetailSeparator() {
  return <Separator className="bg-border/70" />;
}

function LastSeenMeta({ value }: { value?: string }) {
  if (!value) {
    return null;
  }

  return (
    <div className="text-xs text-muted-foreground">
      Dernière citation <span className="font-medium text-foreground">{formatDateTime(value)}</span>
    </div>
  );
}

function GeoNeedBlock({ need }: { need: PageGeoNeed | null }) {
  if (!need) {
    return null;
  }

  return (
    <section className="space-y-3">
      <SectionTitle>Besoin GEO détecté</SectionTitle>
      <div className="rounded-md border border-border/60 bg-background p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-md",
              need.tone === "primary" && "bg-primary/10 text-primary",
              need.tone === "warning" && "bg-amber-100 text-amber-700",
              need.tone === "neutral" && "bg-muted text-muted-foreground",
            )}
          >
            <Lightbulb className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold leading-5">{need.title}</h3>
              <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                {need.metric}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {need.description}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PageDetailPanel({ errorLabel, page, loading = false }: PageDetailPanelProps) {
  if (loading) {
    return <PageDetailSkeleton />;
  }

  if (!page) {
    return (
      <Card className="flex min-h-0 overflow-hidden rounded-md border-border/60 bg-card/95">
        <CardHeader className="border-b border-border/60 bg-muted/10">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">
              <SectionTitle>Détail de la page</SectionTitle>
            </CardTitle>
            <CardDescription className="flex min-w-0 items-center gap-2">
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              <span>Aucune URL sélectionnée</span>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <EmptyStateCard
            label={errorLabel || "Aucune page citée pour le moment."}
            className="h-[300px]"
          />
        </CardContent>
      </Card>
    );
  }

  const modelBreakdown = buildPageModelBreakdown(page);
  const citationSamples = buildPageCitationSamples(page);
  const geoNeed = buildPageGeoNeed(page);

  return (
    <Card className="flex min-h-0 overflow-hidden rounded-md border-border/60 bg-card/95">
      <CardHeader className="border-b border-border/60 bg-muted/10 space-y-4">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div className="w-full min-w-0 flex-1 space-y-3">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">
                <SectionTitle>Détail de la page</SectionTitle>
              </CardTitle>
              <CardDescription className="flex min-w-0 items-center gap-2">
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{page.url}</span>
              </CardDescription>
              <LastSeenMeta value={page.lastSeen} />
            </div>
          </div>
     
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button asChild className="rounded-md">
              <a href={page.url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Ouvrir
              </a>
            </Button>
          </div>
        </div>
        <PageKpiGrid page={page} />
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-5">
        {modelBreakdown.length > 0 ? (
          <>
            <ModelBreakdown models={modelBreakdown} />
            <DetailSeparator />
          </>
        ) : null}

        <CitationSamplesList samples={citationSamples} />

        {geoNeed ? (
          <>
            <DetailSeparator />
            <GeoNeedBlock need={geoNeed} />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PageDetailSkeleton() {
  return (
    <Card className="flex min-h-0 overflow-hidden rounded-md border-border/60 bg-card/95 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/10">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">
                <SectionTitle>Détail de la page</SectionTitle>
              </CardTitle>
              <CardDescription className="flex min-w-0 items-center gap-2">
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                <Skeleton className="h-4 w-[28rem] max-w-full" />
              </CardDescription>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-md bg-card p-4 md:p-5">
                  <div className="mb-2 flex items-start justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                  <Skeleton className="mb-2 h-8 w-20" />
                  <Skeleton className="mt-4 h-3 w-full" />
                </div>
              ))}
            </div>
          </div>
          <Skeleton className="h-10 w-24 shrink-0 rounded-md" />
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="px-1 py-1">
            <div className="text-sm font-semibold text-foreground">
              <SectionTitle>Réponses qui citent cette page</SectionTitle>
            </div>
          </div>
          <div className="space-y-3 px-1 py-3 pr-5 pb-8">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="min-w-0 rounded-md border border-border/60 bg-background px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-6 w-24 rounded-md" />
                  <Skeleton className="h-6 w-20 rounded-md" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-5/6" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
