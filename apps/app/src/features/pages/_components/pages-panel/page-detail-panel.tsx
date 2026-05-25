import { ExternalLink, Link2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { KpiCard, type KpiCardProps } from "@/components/shared/kpi-card";
import { SectionTitle } from "@/components/shared/section-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

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

export function PageDetailPanel({ errorLabel, page, loading = false }: PageDetailPanelProps) {
  const navigate = useNavigate();

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

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="px-1 py-1">
            <div className="text-sm font-semibold text-foreground">
              <SectionTitle>Réponses qui citent cette page</SectionTitle>
            </div>
          </div>
          <div className="h-[300px] overflow-y-auto">
            <div className="space-y-3 px-1 py-3 pr-5 pb-8">
              {page.samples.map((sample) => (
                <button
                  type="button"
                  key={sample.id}
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
                  className="group w-full rounded-md bg-background p-4 text-left transition-all ring-2 ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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

                  <p className="mb-3 line-clamp-4 text-sm font-medium leading-relaxed text-foreground/90 transition-colors group-hover:text-foreground">
                    {sample.response}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
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
