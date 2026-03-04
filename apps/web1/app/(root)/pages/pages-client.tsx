"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, FileText, Search } from "lucide-react";
import { DashboardDataProvider, useDashboardData, type DashboardData } from "@/hooks/use-dashboard-data";
import type { RuntimeMode } from "@/lib/runtime-mode";
import { API_CONFIG, apiRoutes, buildApiPath } from "@/lib/api-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PagesClientProps = {
  initialData: DashboardData;
  initialMode: RuntimeMode;
  initialProjectId: string | null;
};

type BrandPageStats = {
  id: string;
  path: string;
  pageType: "money" | "comparison" | "blog" | "feature" | "docs";
  citationShare: number;
  mentions: number;
  avgRank: number;
  sentiment: number;
  visibilityScore: number;
  topModels: string[];
  lastSeen: string;
  summary: string;
  optimizeHint: string;
};

export function PagesClient({ initialData, initialMode, initialProjectId }: PagesClientProps) {
  return (
    <DashboardDataProvider
      initialData={initialData}
      initialMode={initialMode}
      initialProjectId={initialProjectId}
    >
      <PagesWorkspace />
    </DashboardDataProvider>
  );
}

function PagesWorkspace() {
  const { data, mode, projectId } = useDashboardData();
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | BrandPageStats["pageType"]>("all");
  const [selectedPage, setSelectedPage] = useState<BrandPageStats | null>(null);
  const [serverPages, setServerPages] = useState<BrandPageStats[] | null>(null);

  useEffect(() => {
    if (!projectId) {
      setServerPages(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const result = await getJson<{
          pages: Array<{
            pageUrl: string;
            pageType: BrandPageStats["pageType"];
            citations: number;
            citationShare: number;
            visibilityScore: number;
            sentimentScore: number;
            avgRank: number;
            topModels: string[];
            summary: string;
            optimizeHint: string;
            lastSeenAt: string | null;
          }>;
        }>(apiRoutes.analysis.pagesStats(projectId));
        if (cancelled) return;
        setServerPages(
          (result.pages || []).map((page, index) => ({
            id: `server-page-${index + 1}-${page.pageUrl}`,
            path: page.pageUrl,
            pageType: page.pageType,
            citationShare: page.citationShare,
            mentions: page.citations,
            avgRank: page.avgRank,
            sentiment: page.sentimentScore,
            visibilityScore: page.visibilityScore,
            topModels: page.topModels || [],
            lastSeen: page.lastSeenAt ? new Date(page.lastSeenAt).toLocaleDateString() : "-",
            summary: page.summary,
            optimizeHint: page.optimizeHint,
          })),
        );
      } catch {
        if (!cancelled) setServerPages(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const pages = useMemo(() => serverPages ?? buildBrandPagesStats(data), [data, serverPages]);

  const filteredPages = useMemo(() => {
    return pages.filter((page) => {
      const matchType = selectedType === "all" || page.pageType === selectedType;
      const q = search.trim().toLowerCase();
      const matchSearch =
        q.length === 0 ||
        page.path.toLowerCase().includes(q) ||
        page.summary.toLowerCase().includes(q);
      return matchType && matchSearch;
    });
  }, [pages, search, selectedType]);

  const totals = useMemo(() => {
    const citationCoverage = filteredPages.reduce((acc, item) => acc + item.citationShare, 0);
    const avgVisibility = filteredPages.length
      ? Math.round(filteredPages.reduce((acc, item) => acc + item.visibilityScore, 0) / filteredPages.length)
      : 0;
    const avgSentiment = filteredPages.length
      ? Math.round(filteredPages.reduce((acc, item) => acc + item.sentiment, 0) / filteredPages.length)
      : 0;
    return { citationCoverage: Math.min(100, citationCoverage), avgVisibility, avgSentiment };
  }, [filteredPages]);

  return (
    <div className="h-full min-h-0 overflow-hidden p-2 md:p-4">
      <div className="flex h-full min-h-0 flex-col rounded-md bg-background">
        <div className="border-b p-3 md:p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">Pages Stats</h1>
                <Badge variant="outline">{filteredPages.length} pages</Badge>
                {mode === "demo" && <Badge className="bg-amber-100 text-amber-800">Demo</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                Statistiques de citation, visibilité et perception des pages de votre brand dans les réponses IA.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Export stats
              </Button>
              <Button className="gap-2">
                <FileText className="h-4 w-4" />
                Prioriser pages
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une URL ou un contenu..."
                className="pl-8"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(["all", "money", "comparison", "feature", "blog", "docs"] as const).map((type) => (
                <Button
                  key={type}
                  size="sm"
                  variant={selectedType === type ? "default" : "outline"}
                  onClick={() => setSelectedType(type)}
                  className="capitalize"
                >
                  {type === "all" ? "Tous" : type}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 xl:grid-cols-12">
          <div className="border-b p-3 xl:col-span-8 xl:border-b-0 xl:border-r md:p-4">
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <MiniStatCard label="Couverture citations" value={`${totals.citationCoverage}%`} />
              <MiniStatCard label="Visibility moyenne" value={`${totals.avgVisibility}/100`} />
              <MiniStatCard label="Sentiment moyen" value={`${totals.avgSentiment}/100`} />
            </div>

            <div className="min-h-0 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Citations</TableHead>
                    <TableHead className="text-right">Visibility</TableHead>
                    <TableHead className="text-right">Sentiment</TableHead>
                    <TableHead className="text-right">Rang moy.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPages.map((page) => (
                    <TableRow
                      key={page.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedPage(page)}
                    >
                      <TableCell className="min-w-[220px]">
                        <div className="font-medium">{page.path}</div>
                        <div className="line-clamp-1 text-xs text-muted-foreground">{page.summary}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {page.pageType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{page.citationShare}%</TableCell>
                      <TableCell className="text-right tabular-nums">{page.visibilityScore}</TableCell>
                      <TableCell className="text-right tabular-nums">{page.sentiment}</TableCell>
                      <TableCell className="text-right tabular-nums">{page.avgRank}</TableCell>
                    </TableRow>
                  ))}
                  {filteredPages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                        Aucune page trouvée pour ces filtres.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="p-3 xl:col-span-4 md:p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Top pages à optimiser</h4>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {filteredPages.length}
                </Badge>
              </div>

              <div className="space-y-2">
                {filteredPages.slice(0, 6).map((page) => (
                  <button
                    key={`side-${page.id}`}
                    type="button"
                    onClick={() => setSelectedPage(page)}
                    className="w-full rounded-md bg-background p-3 text-left transition hover:bg-muted/40"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium">{page.path}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {page.pageType}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                      <span>Citations: {page.citationShare}%</span>
                      <span>Vis: {page.visibilityScore}</span>
                      <span>Sent: {page.sentiment}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={selectedPage !== null} onOpenChange={(open) => !open && setSelectedPage(null)}>
        <SheetContent side="right" className="w-full p-0 sm:w-[460px] sm:max-w-[460px]">
          {selectedPage ? (
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b border-border/60 p-4 text-left">
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="capitalize">
                    {selectedPage.pageType}
                  </Badge>
                  <Badge variant="secondary">Citations {selectedPage.citationShare}%</Badge>
                </div>
                <SheetTitle className="break-all text-base">{selectedPage.path}</SheetTitle>
                <SheetDescription>Statistiques de perception et opportunités d’optimisation pour cette page.</SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-2">
                  <MiniStatCard label="Mentions" value={String(selectedPage.mentions)} />
                  <MiniStatCard label="Rang moyen" value={String(selectedPage.avgRank)} />
                  <MiniStatCard label="Visibility" value={`${selectedPage.visibilityScore}/100`} />
                  <MiniStatCard label="Sentiment" value={`${selectedPage.sentiment}/100`} />
                </div>

                <div className="space-y-1">
                  <h5 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Résumé</h5>
                  <p className="text-sm leading-relaxed">{selectedPage.summary}</p>
                </div>

                <div className="space-y-1">
                  <h5 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Recommandation Optimize
                  </h5>
                  <p className="text-sm leading-relaxed">{selectedPage.optimizeHint}</p>
                </div>

                <div className="space-y-2">
                  <h5 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Modèles les plus actifs</h5>
                  <div className="flex flex-wrap gap-2">
                    {selectedPage.topModels.map((model) => (
                      <Badge key={`${selectedPage.id}-${model}`} variant="secondary">
                        {model}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MiniStatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-md">
      <CardContent className="p-3">
        <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
        <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function buildBrandPagesStats(data: DashboardData): BrandPageStats[] {
  const brandName = data.project?.name || "Brand";
  const models = (data.models || []).map((m) => m.name);
  const prompts = data.recent_prompts || [];
  const mentionCount = Math.max(1, prompts.filter((p) => p.mention).length);
  const seed = `${brandName}-${prompts.length}-${mentionCount}`;
  const h = (value: string) =>
    value.split("").reduce((acc, c, idx) => (acc + c.charCodeAt(0) * (idx + 3)) % 1009, 0);
  const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)));

  const canonical = [
    { path: "/pricing", type: "money", summary: "Pricing principal et packages de la marque." },
    { path: "/features", type: "feature", summary: "Vue globale des fonctionnalités clés." },
    { path: "/compare/hubspot-vs-nikebot", type: "comparison", summary: "Page de comparaison concurrentielle." },
    { path: "/solutions/smb", type: "money", summary: "Page solution orientée PME / SMB." },
    { path: "/blog/ai-brand-monitoring-guide", type: "blog", summary: "Guide éducatif pour la découverte." },
    { path: "/docs/api", type: "docs", summary: "Documentation technique et intégration." },
    { path: "/integrations", type: "feature", summary: "Connecteurs et écosystème d’intégration." },
    { path: "/case-studies/retail", type: "blog", summary: "Cas client et preuves d’usage sectoriel." },
  ] as const;

  const rows = canonical.map((item, index) => {
    const k = h(`${seed}-${item.path}`);
    const citationShare = clamp(8 + ((k + index * 7) % 22), 3, 35);
    const visibilityScore = clamp(48 + ((k + index * 9) % 40));
    const sentiment = clamp(52 + ((k + index * 5) % 35));
    const avgRank = clamp(1 + ((k + index) % 7), 1, 10);
    const mentions = Math.max(1, Math.round((citationShare / 100) * mentionCount * 8));
    const topModels = models.length > 0 ? rotate(models, index).slice(0, 3) : ["ChatGPT", "Claude", "Perplexity"];
    const optimizeHint =
      item.type === "money"
        ? "Clarifier le positionnement et les fourchettes de prix sur la page pour réduire les hallucinations pricing."
        : item.type === "comparison"
          ? "Renforcer les différenciateurs factuels (features, audience, use cases) avec wording structuré."
          : item.type === "feature"
            ? "Ajouter des blocs FAQ / schema et des exemples de use cases pour améliorer la couverture IA."
            : item.type === "docs"
              ? "Mieux exposer les cas d’usage métier et bénéfices, pas seulement les détails techniques."
              : "Ajouter des signaux de crédibilité et des formulations canoniques réutilisables par les IA.";

    return {
      id: `page-${index + 1}`,
      path: item.path,
      pageType: item.type,
      citationShare,
      mentions,
      avgRank,
      sentiment,
      visibilityScore,
      topModels,
      lastSeen: `${(index % 5) + 1}h`,
      summary: item.summary,
      optimizeHint,
    } satisfies BrandPageStats;
  });

  const total = rows.reduce((acc, row) => acc + row.citationShare, 0);
  return rows
    .map((row) => ({
      ...row,
      citationShare: Math.max(1, Math.round((row.citationShare / Math.max(total, 1)) * 100)),
    }))
    .sort((a, b) => b.citationShare - a.citationShare);
}

function rotate<T>(arr: T[], offset: number): T[] {
  if (arr.length === 0) return arr;
  const n = offset % arr.length;
  return [...arr.slice(n), ...arr.slice(0, n)];
}

async function getJson<T>(path: string): Promise<T> {
  const base = API_CONFIG.BASE_URL?.trim();
  const url = base ? `${base}${buildApiPath(path)}` : buildApiPath(path);
  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data?: T; message?: string };
  if (json?.data !== undefined) return json.data;
  throw new Error(json?.message || "Réponse API invalide");
}
