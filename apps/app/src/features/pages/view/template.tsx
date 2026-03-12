"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ExternalLink, RotateCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DashboardSectionTitle } from "@/features/monitoring/components/dashboard-section-title";
import { PageHeader } from "@/features/shared/view/page-header";
import { appQueryKeys } from "@/lib/query-keys";
import {
  getDashboardQueryContext,
  loadDashboardData,
  type DashboardData,
  type DashboardPrompt,
} from "@/lib/dashboard-data";
import { toSafeImageAssetPath } from "@/lib/safe-asset-path";
import { cn } from "@/lib/utils";

type PagesTemplateProps = {
  apiBaseURL: string;
  routeSearch: string;
};

type PagePromptHit = {
  id: string;
  prompt: string;
  model: PageModelBadge | null;
  persona: string;
  time: string;
  createdAt?: string;
  citationCount: number;
};

type PageModelBadge = {
  id: string;
  label: string;
  iconPath: string;
};

type PageInsight = {
  url: string;
  hostname: string;
  path: string;
  citationShare: number;
  citationCount: number;
  promptCount: number;
  modelCount: number;
  models: PageModelBadge[];
  personas: string[];
  lastSeen?: string;
  samples: PagePromptHit[];
};

export function PagesTemplate({ apiBaseURL, routeSearch }: PagesTemplateProps) {
  const queryContext = useMemo(() => getDashboardQueryContext(routeSearch), [routeSearch]);
  const [search, setSearch] = useState("");
  const [selectedPageUrl, setSelectedPageUrl] = useState<string | null>(null);

  const dashboardQuery = useQuery({
    queryKey: appQueryKeys.dashboard(apiBaseURL, queryContext.projectId, queryContext.mode),
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) => loadDashboardData(apiBaseURL, routeSearch, { signal }),
  });

  const dashboard = dashboardQuery.data?.data ?? null;
  const pageInsights = useMemo(
    () => (dashboard ? buildPageInsights(dashboard) : []),
    [dashboard],
  );

  const filteredPages = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return pageInsights;

    return pageInsights.filter((page) =>
      [
        page.url,
        page.hostname,
        page.path,
        page.models.map((model) => model.label).join(" "),
        page.personas.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [pageInsights, search]);

  useEffect(() => {
    if (filteredPages.length === 0) {
      setSelectedPageUrl(null);
      return;
    }

    if (!selectedPageUrl || !filteredPages.some((page) => page.url === selectedPageUrl)) {
      setSelectedPageUrl(filteredPages[0]!.url);
    }
  }, [filteredPages, selectedPageUrl]);

  const selectedPage = filteredPages.find((page) => page.url === selectedPageUrl) ?? filteredPages[0] ?? null;
  const metrics = useMemo(() => buildPageMetrics(pageInsights, dashboard), [pageInsights, dashboard]);

  if (dashboardQuery.isLoading && !dashboard) {
    return <PagesLoadingState />;
  }

  if (!dashboard) {
    return (
      <PagesUnavailableState
        error={dashboardQuery.error instanceof Error ? dashboardQuery.error.message : null}
        onReload={async () => {
          await dashboardQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title="Pages"
        baseline="Identifiez les pages de votre site réellement citées dans les réponses IA, celles qui portent la visibilité et celles qui restent absentes."
        actionsVariant="classic"
        actions={
          <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
            {selectedPage ? (
              <Button asChild variant="default">
                <a href={selectedPage.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ouvrir la page
                </a>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PagesTopKpiCard
          title="Pages citées"
          value={String(metrics.pageCount)}
          sub="Nombre total d’URLs différentes citées dans les réponses."
          variant="active"
        />
        <PagesTopKpiCard
          title="Citations relevées"
          value={String(metrics.citationCount)}
          sub="Nombre total de citations de pages détectées dans les réponses."
        />
        <PagesTopKpiCard
          title="Réponses avec source"
          value={String(metrics.promptCount)}
          sub="Nombre de réponses qui s’appuient sur au moins une page du site."
        />
        <PagesTopKpiCard
          title="Couverture du top 3"
          value={`${metrics.topThreeShare}%`}
          sub="Part des réponses captées par vos 3 pages les plus citées."
          className="rounded-tr-none"
        />
      </div>

      {pageInsights.length === 0 ? (
        <PagesEmptyState projectName={dashboard.project.name} />
      ) : (
        <div className="mt-4 grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.55fr)]">
          <Card className="min-h-0 border-border/60">
            <CardHeader>
              <CardTitle className="text-base">
                <DashboardSectionTitle>Pages citées</DashboardSectionTitle>
              </CardTitle>
              <CardDescription>
                Classement des URLs qui servent réellement de source aux IA.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher une URL, un modèle ou un persona"
                  className="pl-9"
                />
              </div>

              <ScrollArea className="min-h-0 flex-1 pr-3 [&_[data-slot=scroll-area-scrollbar]]:w-2.5 [&_[data-slot=scroll-area-scrollbar]]:bg-muted/35 [&_[data-slot=scroll-area-thumb]]:rounded-full [&_[data-slot=scroll-area-thumb]]:border [&_[data-slot=scroll-area-thumb]]:border-background/60 [&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/55">
                <div className="space-y-2">
                  {filteredPages.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-10 text-sm text-muted-foreground">
                      Aucune page ne correspond à la recherche.
                    </div>
                  ) : (
                    filteredPages.map((page, index) => {
                      const isActive = selectedPage?.url === page.url;
                      return (
                        <button
                          key={page.url}
                          type="button"
                          onClick={() => setSelectedPageUrl(page.url)}
                          className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                            isActive
                              ? "border-primary/40 bg-primary/6 shadow-sm"
                              : "border-border/60 bg-background/80 hover:border-primary/25 hover:bg-muted/20"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                                  {index + 1}
                                </span>
                                <span className="truncate text-sm font-semibold text-foreground">{page.hostname}</span>
                              </div>
                              <p className="mt-1 truncate text-xs text-muted-foreground">{page.path}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-lg font-semibold text-foreground">{page.citationShare}%</div>
                              <div className="text-[11px] text-muted-foreground">part des réponses</div>
                            </div>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(100, page.citationShare)}%` }}
                            />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                            <span>{page.promptCount} réponses</span>
                            <span>{page.modelCount} modèles</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="min-h-0 border-border/60">
            {selectedPage ? (
              <>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base">
                        <DashboardSectionTitle>Détail de la page</DashboardSectionTitle>
                      </CardTitle>
                      <CardDescription className="truncate">{selectedPage.url}</CardDescription>
                    </div>
                    <Badge variant="secondary">{selectedPage.citationShare}% des réponses</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <DetailKpiCard
                      title="Citations"
                      sub="Nombre total de citations détectées pour cette URL."
                      variant="active"
                    >
                      <span className="text-[26px] font-bold tracking-tight md:text-[28px]">
                        {selectedPage.citationCount}
                      </span>
                    </DetailKpiCard>
                    <DetailKpiCard
                      title="Réponses"
                      sub="Réponses IA qui s’appuient sur cette page."
                    >
                      <span className="text-[26px] font-bold tracking-tight md:text-[28px]">
                        {selectedPage.promptCount}
                      </span>
                    </DetailKpiCard>
                    <DetailKpiCard
                      title="Modèles"
                      sub="IA qui citent cette page."
                      footer={<ModelIconStack models={selectedPage.models} />}
                    >
                      <span className="text-[26px] font-bold tracking-tight md:text-[28px]">
                        {selectedPage.modelCount}
                      </span>
                    </DetailKpiCard>
                  </div>

                  <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/60 bg-background/70">
                    <div className="border-b border-border/60 px-4 py-3">
                      <div className="text-sm font-semibold text-foreground">Exemples de réponses qui citent cette page</div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Les prompts et modèles dans lesquels cette URL est réutilisée comme source.
                      </p>
                    </div>
                    <ScrollArea className="h-[360px] overflow-hidden [&_[data-slot=scroll-area-viewport]]:overflow-x-hidden [&_[data-slot=scroll-area-scrollbar]]:w-2.5 [&_[data-slot=scroll-area-scrollbar]]:bg-muted/35 [&_[data-slot=scroll-area-thumb]]:rounded-full [&_[data-slot=scroll-area-thumb]]:border [&_[data-slot=scroll-area-thumb]]:border-background/60 [&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/55">
                      <div className="space-y-3 p-4 pr-6 pb-8">
                        {selectedPage.samples.map((sample) => (
                          <div key={sample.id} className="min-w-0 rounded-xl border border-border/60 bg-background px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {sample.model ? (
                                <ModelBadgeItem badge={sample.model} />
                              ) : (
                                <Badge variant="outline" className="font-normal">
                                  Modèle inconnu
                                </Badge>
                              )}
                              {sample.persona ? <Badge variant="outline">{sample.persona}</Badge> : null}
                              <span className="text-[11px] text-muted-foreground">
                                {sample.citationCount} {sample.citationCount > 1 ? "citations" : "citation"}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-foreground">{sample.prompt}</p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
                Sélectionnez une page pour voir son détail.
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function PagesTopKpiCard({
  title,
  value,
  sub,
  variant = "default",
  className,
}: {
  title: string;
  value: string;
  sub?: string;
  variant?: "default" | "active";
  className?: string;
}) {
  const isActive = variant === "active";

  return (
    <div
      className={cn(
        "relative flex min-h-[136px] flex-col rounded-md px-4 py-3 transition-all md:min-h-[148px]",
        isActive
          ? "bg-linear-to-br from-primary via-primary to-primary/80 text-primary-foreground shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.14)]"
          : "bg-card text-card-foreground",
        className,
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <span
          className={cn(
            "text-sm font-medium leading-tight",
            isActive ? "text-primary-foreground/90" : "text-muted-foreground",
          )}
        >
          {title}
        </span>
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
            isActive
              ? "border-transparent bg-white/20 text-white backdrop-blur-sm"
              : "border-border bg-background text-foreground",
          )}
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>

      <div className="mb-2">
        <span className="text-[28px] font-bold tracking-tight md:text-[30px]">{value}</span>
      </div>

      {sub ? (
        <span
          className={cn(
            "mt-auto text-[11px] leading-relaxed",
            isActive ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {sub}
        </span>
      ) : null}
    </div>
  );
}

function DetailKpiCard({
  title,
  sub,
  children,
  footer,
  variant = "default",
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "default" | "active";
}) {
  const isActive = variant === "active";

  return (
    <div
      className={cn(
        "relative flex min-h-[148px] flex-col rounded-md px-4 py-3 transition-all md:min-h-[156px] md:px-4 md:py-3.5",
        isActive
          ? "bg-linear-to-br from-primary via-primary to-primary/80 text-primary-foreground shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.14)]"
          : "border border-border/60 bg-card text-card-foreground",
      )}
    >
      <div className="mb-1.5 flex items-start justify-between gap-3">
        <span
          className={cn(
            "text-sm font-medium leading-tight",
            isActive ? "text-primary-foreground/90" : "text-muted-foreground",
          )}
        >
          {title}
        </span>
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
            isActive
              ? "border-transparent bg-white/20 text-white backdrop-blur-sm"
              : "border-border bg-background text-foreground",
          )}
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>

      <div className="min-w-0 flex-1">{children}</div>

      {footer ? <div className="mt-2.5">{footer}</div> : null}

      {sub ? (
        <span
          className={cn(
            "mt-1.5 text-[11px] leading-relaxed",
            isActive ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {sub}
        </span>
      ) : null}
    </div>
  );
}

function ModelBadgeItem({ badge }: { badge: PageModelBadge }) {
  return (
    <Badge
      variant="outline"
      title={badge.label}
      className="inline-flex max-w-full items-center gap-2 rounded-full border-border/70 bg-background/90 px-2.5 py-1 font-normal text-foreground"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted/55 p-0.5">
        <img
          src={toSafeImageAssetPath(badge.iconPath)}
          alt=""
          width={12}
          height={12}
          loading="lazy"
          decoding="async"
          className="h-3 w-3 object-contain"
        />
      </span>
      <span className="truncate">{badge.label}</span>
    </Badge>
  );
}

function ModelIconStack({ models }: { models: PageModelBadge[] }) {
  if (models.length === 0) {
    return <span className="text-xs text-muted-foreground">Aucun modèle identifié.</span>;
  }

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-2">
        {models.map((model) => (
          <Tooltip key={model.id}>
            <TooltipTrigger asChild>
              <span className="flex h-9 w-9 shrink-0 cursor-default items-center justify-center rounded-2xl border border-border/70 bg-background/90">
                <img
                  src={toSafeImageAssetPath(model.iconPath)}
                  alt=""
                  width={18}
                  height={18}
                  loading="lazy"
                  decoding="async"
                  className="h-[18px] w-[18px] object-contain"
                />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
              {model.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

function PagesLoadingState() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <div className="space-y-3 px-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-[40rem] max-w-full" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>

      <div className="mt-4 grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.55fr)]">
        <Skeleton className="h-full min-h-[420px] rounded-xl" />
        <Skeleton className="h-full min-h-[420px] rounded-xl" />
      </div>
    </div>
  );
}

function PagesUnavailableState({
  error,
  onReload,
}: {
  error: string | null;
  onReload: () => Promise<void>;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title="Pages"
        baseline="Identifiez les pages de votre site réellement citées par les IA."
        actions={
          <Button variant="outline" onClick={() => void onReload()}>
            Réessayer
          </Button>
        }
      />

      <Card className="mt-4 border-border/60">
        <CardHeader>
          <CardTitle>Impossible de charger les pages</CardTitle>
          <CardDescription>
            {error || "Aucune donnée de pages n’est disponible pour ce projet."}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function PagesEmptyState({ projectName }: { projectName: string }) {
  return (
    <Card className="mt-4 border-border/60 rounded-tr-none">
      <CardHeader>
        <CardTitle>Aucune page citée pour le moment</CardTitle>
        <CardDescription>
          {projectName
            ? `Les réponses analysées pour ${projectName} ne citent encore aucune page du site.`
            : "Les réponses analysées ne citent encore aucune page du site."}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm leading-6 text-muted-foreground">
        Cette vue se remplira dès que les réponses IA s’appuieront sur des URLs précises de votre site.
      </CardContent>
    </Card>
  );
}

function buildPageMetrics(pages: PageInsight[], dashboard: DashboardData | null) {
  const citationCount = pages.reduce((sum, page) => sum + page.citationCount, 0);
  const topThreeShare = Number(
    pages
      .slice(0, 3)
      .reduce((sum, page) => sum + page.citationShare, 0)
      .toFixed(1),
  );
  const promptCount = dashboard?.recent_prompts.filter((prompt) => prompt.citedUrls.length > 0).length ?? 0;

  return {
    pageCount: pages.length,
    citationCount,
    promptCount,
    topThreeShare,
  };
}

function buildPageInsights(dashboard: DashboardData): PageInsight[] {
  const byUrl = new Map<
    string,
    {
      url: string;
      hostname: string;
      path: string;
      citationCount: number;
      promptCount: number;
      models: Map<string, PageModelBadge>;
      personas: Set<string>;
      lastSeen?: string;
      samples: PagePromptHit[];
    }
  >();

  const totalResponses = Math.max(1, dashboard.recent_prompts.length);

  for (const prompt of dashboard.recent_prompts) {
    const citationCounts = countCitationsByUrl(prompt);

    for (const [url, citationCount] of citationCounts.entries()) {
      const existing = byUrl.get(url) ?? {
        url,
        ...parsePageUrl(url),
        citationCount: 0,
        promptCount: 0,
        models: new Map<string, PageModelBadge>(),
        personas: new Set<string>(),
        samples: [],
      };

      existing.citationCount += citationCount;
      existing.promptCount += 1;
      const modelBadge = toPageModelBadge(prompt);
      if (modelBadge) {
        existing.models.set(modelBadge.id, modelBadge);
      }
      if (prompt.persona.trim()) {
        existing.personas.add(prompt.persona.trim());
      }
      if (prompt.createdAt && (!existing.lastSeen || prompt.createdAt > existing.lastSeen)) {
        existing.lastSeen = prompt.createdAt;
      }
      existing.samples.push({
        id: `${prompt.responseId}-${url}`,
        prompt: prompt.text.trim() || "Prompt sans libellé",
        model: modelBadge,
        persona: prompt.persona.trim(),
        time: prompt.time,
        createdAt: prompt.createdAt,
        citationCount,
      });

      byUrl.set(url, existing);
    }
  }

  return Array.from(byUrl.values())
    .map((page) => ({
      url: page.url,
      hostname: page.hostname,
      path: page.path,
      citationCount: page.citationCount,
      promptCount: page.promptCount,
      citationShare: Number(((page.citationCount / totalResponses) * 100).toFixed(1)),
      modelCount: page.models.size,
      models: Array.from(page.models.values()).sort((a, b) => a.label.localeCompare(b.label)),
      personas: Array.from(page.personas.values()).sort((a, b) => a.localeCompare(b)),
      lastSeen: page.lastSeen,
      samples: page.samples.sort(comparePromptHitDates).slice(0, 12),
    }))
    .sort((a, b) => {
      if (b.citationShare !== a.citationShare) return b.citationShare - a.citationShare;
      if (b.citationCount !== a.citationCount) return b.citationCount - a.citationCount;
      return a.url.localeCompare(b.url);
    });
}

function countCitationsByUrl(prompt: DashboardPrompt): Map<string, number> {
  const counts = new Map<string, number>();

  for (const rawUrl of prompt.citedUrls) {
    const url = rawUrl.trim();
    if (!url) continue;
    counts.set(url, (counts.get(url) ?? 0) + 1);
  }

  return counts;
}

function parsePageUrl(url: string): { hostname: string; path: string } {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "") || url;
    const path = `${parsed.pathname || "/"}${parsed.search || ""}${parsed.hash || ""}` || "/";
    return { hostname, path };
  } catch {
    return { hostname: url, path: url };
  }
}

function comparePromptHitDates(a: PagePromptHit, b: PagePromptHit) {
  if (a.createdAt && b.createdAt) {
    return b.createdAt.localeCompare(a.createdAt);
  }
  if (a.createdAt) return -1;
  if (b.createdAt) return 1;
  return 0;
}

function toPageModelBadge(prompt: DashboardPrompt): PageModelBadge | null {
  const label =
    prompt.modelDisplayName.trim() ||
    prompt.modelGroupName.trim() ||
    prompt.modelProviderModelId.trim() ||
    prompt.modelId.trim();

  if (!label) {
    return null;
  }

  return {
    id:
      prompt.modelId.trim() ||
      prompt.modelProviderModelId.trim() ||
      prompt.modelDisplayName.trim() ||
      prompt.modelGroupName.trim(),
    label,
    iconPath: toSafeImageAssetPath(prompt.modelIconPath),
  };
}
