import {
  AlertCircle,
  FileText,
  Search,
  SlidersHorizontal,
  Copy,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
} from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { PageHeader } from "@/components/shared/page-header";
import { SectionTitle } from "@/components/shared/section-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/shared/utils";
import { useContentOptimizerViewModel } from "../../_lib/crawl/use-content-optimizer-view-model";
import type { ContentOptimizerCrawlRecord } from "../../_lib/content-optimizer-api";

type CrawlPanelProps = {
  apiBaseURL: string;
  routeSearch: string;
};

type CrawlColumn = {
  id: string;
  label: string;
  className?: string;
};

type SeverityFilter = "all" | "high" | "medium" | "low" | "none";
type StatusFilter = "all" | "completed" | "running" | "errored" | "cancelled";
type SortKey = "page" | "http" | "status" | "priority" | "findings";

const columns: CrawlColumn[] = [
  { id: "page", label: "Page", className: "min-w-[260px]" },
  { id: "url", label: "URL", className: "min-w-[260px]" },
  { id: "http", label: "HTTP", className: "w-[88px]" },
  { id: "status", label: "Statut", className: "w-[120px]" },
  { id: "priority", label: "Priorité", className: "w-[120px]" },
  { id: "findings", label: "Constats", className: "min-w-[240px]" },
  { id: "action", label: "Action recommandée", className: "min-w-[260px]" },
];

function statusTone(status: string): "default" | "outline" | "destructive" | "secondary" {
  if (status === "completed") return "default";
  if (status === "running") return "secondary";
  if (status.includes("cancelled") || status === "errored") return "destructive";
  return "outline";
}

function statusLabel(status: string): string {
  if (status === "completed") return "Terminé";
  if (status === "running") return "En cours";
  if (status === "errored") return "En erreur";
  if (status.includes("cancelled")) return "Annulé";
  return status;
}

function contentLabel(record: ContentOptimizerCrawlRecord): string {
  if (record.markdown?.trim()) return "Markdown";
  if (record.html?.trim()) return "HTML";
  if (record.json != null) return "JSON";
  return "Aucun";
}

function pageContent(record: ContentOptimizerCrawlRecord): string {
  if (record.markdown?.trim()) return record.markdown.trim();
  if (record.html?.trim()) return record.html.trim();
  if (record.json != null) return JSON.stringify(record.json, null, 2);
  return "Aucun contenu extrait pour cette page.";
}

function severityTone(severity: string): string {
  if (severity === "high") return "border-transparent bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200";
  if (severity === "medium") return "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
  if (severity === "low") return "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200";
  return "";
}

function severityLabel(severity: string): string {
  if (severity === "high") return "Haute";
  if (severity === "medium") return "Moyenne";
  if (severity === "low") return "Faible";
  return "-";
}

function severityRank(severity: string): number {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  if (severity === "low") return 1;
  return 0;
}

function primaryIssue(record: ContentOptimizerCrawlRecord) {
  return [...(record.issues ?? [])].sort(
    (left, right) => severityRank(right.severity) - severityRank(left.severity),
  )[0] ?? null;
}

function totalIssueCount(records: ContentOptimizerCrawlRecord[]): number {
  return records.reduce((total, record) => total + (record.issues?.length ?? 0), 0);
}

function hostnameFromURL(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function pathnameFromURL(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
  } catch {
    return url;
  }
}

function computePriority(record: ContentOptimizerCrawlRecord): {
  label: "Critique" | "Haute" | "Moyenne" | "Basse";
  rank: number;
  className: string;
} {
  const issues = record.issues ?? [];
  const highCount = issues.filter((issue) => issue.severity === "high").length;
  const mediumCount = issues.filter((issue) => issue.severity === "medium").length;
  const httpStatus = record.httpStatus ?? 200;

  if (httpStatus >= 500 || highCount >= 2) {
    return {
      label: "Critique",
      rank: 4,
      className: "border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    };
  }

  if (highCount >= 1 || httpStatus >= 400) {
    return {
      label: "Haute",
      rank: 3,
      className: "border-transparent bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
    };
  }

  if (mediumCount >= 1) {
    return {
      label: "Moyenne",
      rank: 2,
      className: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    };
  }

  return {
    label: "Basse",
    rank: 1,
    className: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  };
}

function loadingRows() {
  return Array.from({ length: 6 }).map((_, index) => (
    <TableRow key={index}>
      <TableCell>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full max-w-[280px]" />
          <Skeleton className="h-3 w-2/3 max-w-[220px]" />
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full max-w-[220px]" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-12" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-24 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-20 rounded-full" />
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-3 w-full max-w-[180px]" />
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <Skeleton className="h-3 w-full max-w-[220px]" />
          <Skeleton className="h-3 w-2/3 max-w-[180px]" />
        </div>
      </TableCell>
    </TableRow>
  ));
}

export function CrawlPanel({ apiBaseURL, routeSearch }: CrawlPanelProps) {
  const viewModel = useContentOptimizerViewModel({ apiBaseURL, routeSearch });
  const records = viewModel.crawlRecords;

  const [query, setQuery] = useState("");
  const [reanalyzeDialogOpen, setReanalyzeDialogOpen] = useState(false);
  const [reanalyzeLimit, setReanalyzeLimit] = useState(50);
  const [reanalyzeURLs, setReanalyzeURLs] = useState<Set<string>>(() => new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const nextRecords = records.filter((record) => {
      const issue = primaryIssue(record);
      const matchesQuery =
        normalizedQuery.length === 0 ||
        record.url.toLowerCase().includes(normalizedQuery) ||
        (record.title ?? "").toLowerCase().includes(normalizedQuery);

      const matchesStatus = statusFilter === "all" || record.status === statusFilter;
      const matchesSeverity =
        severityFilter === "all" ||
        (severityFilter === "none"
          ? !issue
          : issue?.severity === severityFilter);
      const matchesIssuesOnly = !issuesOnly || (record.issues?.length ?? 0) > 0;

      return matchesQuery && matchesStatus && matchesSeverity && matchesIssuesOnly;
    });

    return [...nextRecords].sort((left, right) => {
      let comparison = 0;

      if (sortKey === "findings") {
        comparison = (left.issues?.length ?? 0) - (right.issues?.length ?? 0);
      } else if (sortKey === "http") {
        comparison = (left.httpStatus ?? 0) - (right.httpStatus ?? 0);
      } else if (sortKey === "status") {
        comparison = statusLabel(left.status).localeCompare(statusLabel(right.status));
      } else if (sortKey === "page") {
        comparison = (left.title ?? left.url).localeCompare(right.title ?? right.url);
      } else {
        comparison = computePriority(left).rank - computePriority(right).rank;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [issuesOnly, query, records, severityFilter, sortDirection, sortKey, statusFilter]);

  const selectedRecord =
    filteredRecords.find((record) => record.url === viewModel.selectedResult?.url) ??
    filteredRecords[0] ??
    null;

  const recordsWithIssues = filteredRecords.filter((record) => (record.issues?.length ?? 0) > 0).length;
  const criticalCount = filteredRecords.filter((record) => computePriority(record).label === "Critique").length;
  const reanalyzing = viewModel.discovering || viewModel.crawling;
  const reanalyzePages = useMemo(
    () => records.filter((record) => record.url.trim() !== ""),
    [records],
  );
  const allReanalyzePagesSelected =
    reanalyzePages.length > 0 &&
    reanalyzePages.every((record) => reanalyzeURLs.has(record.url.trim()));

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "page" || nextKey === "status" ? "asc" : "desc");
  }

  function renderSortIcon(columnKey: SortKey) {
    if (sortKey !== columnKey) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  }

  async function copySelectedContent() {
    if (!selectedRecord) return;
    try {
      await navigator.clipboard.writeText(pageContent(selectedRecord));
    } catch {
      // no-op
    }
  }

  function handleReanalyzeDialogOpenChange(open: boolean) {
    setReanalyzeDialogOpen(open);
    if (!open) return;

    const selected = viewModel.selectedURLs.size > 0
      ? viewModel.selectedURLs
      : new Set(reanalyzePages.map((record) => record.url.trim()).filter(Boolean));
    setReanalyzeURLs(new Set(selected));
    setReanalyzeLimit(50);
  }

  function toggleReanalyzePage(nextURL: string, checked: boolean) {
    setReanalyzeURLs((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(nextURL);
      } else {
        next.delete(nextURL);
      }
      return next;
    });
  }

  function toggleAllReanalyzePages(checked: boolean) {
    if (!checked) {
      setReanalyzeURLs(new Set());
      return;
    }
    setReanalyzeURLs(new Set(reanalyzePages.map((record) => record.url.trim()).filter(Boolean)));
  }

  function submitReanalysis() {
    const normalizedLimit = Math.max(1, Math.floor(reanalyzeLimit || 1));
    const includePatterns = Array.from(reanalyzeURLs);

    viewModel.reanalyze({
      limit: normalizedLimit,
      includePatterns,
    });
    setReanalyzeDialogOpen(false);
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <PageHeader
        title="Crawler"
        baseline="Résultats du dernier crawl avec erreurs SEO/GEO et actions recommandées."
        actions={
          <Button
            type="button"
            onClick={() => handleReanalyzeDialogOpenChange(true)}
            disabled={!viewModel.canReanalyze || viewModel.loadingLatest}
            aria-label="Réanalyser le site"
          >
            <RefreshCw className={cn("h-4 w-4", reanalyzing && "animate-spin")} />
            {reanalyzing ? "Analyse en cours" : "Réanalyser"}
          </Button>
        }
        actionsVariant="classic"
      />

      <Dialog open={reanalyzeDialogOpen} onOpenChange={handleReanalyzeDialogOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Réanalyser le crawl</DialogTitle>
           
          </DialogHeader>

          <div className="grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-foreground">
              Limite de pages
              <Input
                type="number"
                min={1}
                max={1000}
                value={reanalyzeLimit}
                onChange={(event) => setReanalyzeLimit(Number(event.target.value))}
              />
            </label>

            <div className="rounded-md border">
              <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
                <label className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={allReanalyzePagesSelected}
                    onCheckedChange={(checked) => toggleAllReanalyzePages(checked === true)}
                  />
                  <span>Toutes les pages</span>
                </label>
                <span className="text-xs text-muted-foreground">
                  {reanalyzeURLs.size}/{reanalyzePages.length}
                </span>
              </div>

              <div className="max-h-[360px] overflow-auto p-2">
                {reanalyzePages.length === 0 ? (
                  <EmptyStateCard label="Aucune page disponible pour cette réanalyse." className="h-24" />
                ) : (
                  <div className="space-y-1">
                    {reanalyzePages.map((record) => {
                      const recordURL = record.url.trim();

                      return (
                        <label
                          key={recordURL}
                          className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={reanalyzeURLs.has(recordURL)}
                            onCheckedChange={(checked) => toggleReanalyzePage(recordURL, checked === true)}
                          />
                          <span className="min-w-0 space-y-0.5">
                            <span className="block truncate text-sm font-medium">
                              {record.title || pathnameFromURL(recordURL)}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {recordURL}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReanalyzeDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={submitReanalysis}
              disabled={reanalyzing || !Number.isFinite(reanalyzeLimit) || reanalyzeLimit < 1}
            >
              <RefreshCw className={cn("h-4 w-4", reanalyzing && "animate-spin")} />
              Lancer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-background">
        {viewModel.error ? (
          <div className="mx-4 mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{viewModel.error}</span>
          </div>
        ) : null}

        <div className="border-b px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher par titre ou URL"
                  className="pl-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="completed">Terminé</SelectItem>
                  <SelectItem value="running">En cours</SelectItem>
                  <SelectItem value="errored">En erreur</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>

              <Select value={severityFilter} onValueChange={(value) => setSeverityFilter(value as SeverityFilter)}>
                <SelectTrigger className="w-full md:w-[190px]">
                  <SelectValue placeholder="Sévérité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les sévérités</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="low">Faible</SelectItem>
                  <SelectItem value="none">Aucune erreur</SelectItem>
                </SelectContent>
              </Select>
            </div></div>
          </div>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-h-0 overflow-auto border-r">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  {columns.map((column) => {
                  const sortMap: Partial<Record<CrawlColumn["id"], SortKey>> = {
                    page: "page",
                    http: "http",
                    status: "status",
                    priority: "priority",
                    findings: "findings",
                  };

                  const sortableKey = sortMap[column.id];

                  return (
                    <TableHead
                      className={cn(
                        "h-12 px-3 text-sm font-semibold text-muted-foreground",
                        column.className,
                      )}
                      key={column.id}
                    >
                      {sortableKey ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(sortableKey)}
                          className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                        >
                          <span>{column.label}</span>
                          {renderSortIcon(sortableKey)}
                        </button>
                      ) : (
                        column.label
                      )}
                    </TableHead>
                  );
                })}
                </TableRow>
              </TableHeader>
              <TableBody className="[&_td]:px-3 [&_td]:py-3">
                {viewModel.loadingLatest ? (
                  loadingRows()
                ) : filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="py-6">
                      <EmptyStateCard
                        label={
                          records.length === 0
                            ? "Aucun résultat de crawl enregistré."
                            : "Aucun résultat ne correspond aux filtres actuels."
                        }
                        className="h-24"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => {
                    const issue = primaryIssue(record);
                    const priority = computePriority(record);
                    const isSelected = selectedRecord?.url === record.url;

                    return (
                      <TableRow
                        key={record.url}
                        tabIndex={0}
                        aria-selected={isSelected}
                        data-state={isSelected ? "selected" : undefined}
                        onClick={() => viewModel.setSelectedResultURL(record.url)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            viewModel.setSelectedResultURL(record.url);
                          }
                        }}
                        className={cn(
                          "cursor-pointer border-l-2 border-l-transparent transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                          isSelected && "border-l-primary bg-muted/50",
                        )}
                      >
                        <TableCell className="max-w-[360px] whitespace-normal">
                          <div className="space-y-1">
                            <div className="line-clamp-2 text-sm font-medium leading-6">
                              {record.title || record.url}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {record.issues?.length ?? 0} point(s)
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="max-w-[320px] whitespace-normal">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-foreground">
                              {hostnameFromURL(record.url)}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {pathnameFromURL(record.url)}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>{record.httpStatus ?? "-"}</TableCell>

                        <TableCell>
                          <Badge variant={statusTone(record.status)}>{statusLabel(record.status)}</Badge>
                        </TableCell>

                        <TableCell>
                          <Badge className={priority.className}>{priority.label}</Badge>
                        </TableCell>

                        <TableCell className="max-w-[340px] whitespace-normal">
                          {issue ? (
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{record.issues?.length ?? 0} point(s)</Badge>
                                <Badge className={severityTone(issue.severity)}>
                                  {severityLabel(issue.severity)}
                                </Badge>
                              </div>
                              <div className="line-clamp-1 text-sm font-medium">{issue.title}</div>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Aucun point détecté</span>
                          )}
                        </TableCell>

                        <TableCell className="max-w-[360px] whitespace-normal">
                          <div className="line-clamp-2 text-sm text-foreground">
                            {issue?.recommendation ?? "Aucune action requise"}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <aside className="min-h-0 overflow-auto bg-background">
            {selectedRecord ? (
              <div className="flex h-full flex-col">
                <div className="border-b px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-foreground">
                        {selectedRecord.title || selectedRecord.url}
                      </h3>
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        {selectedRecord.url}
                      </p>
                    </div>
                    
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline">HTTP {selectedRecord.httpStatus ?? "-"}</Badge>
                    <Badge variant="outline">{selectedRecord.issues?.length ?? 0} point(s)</Badge>
                    <Badge className={computePriority(selectedRecord).className}>
                      {computePriority(selectedRecord).label}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-4 px-4 py-4">
                  {(selectedRecord.issues?.length ?? 0) > 0 ? (
                    <section className="space-y-4">
                      <SectionTitle showIndicator={false}>Points à corriger</SectionTitle>
                      <div className="space-y-3">
                        {selectedRecord.issues?.map((issue, index) => (
                          <button
                            type="button"
                            key={issue.id}
                            className="group w-full cursor-default rounded-md bg-background p-4 text-left transition-all ring-2 ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                            aria-label={issue.title}
                          >
                            <div className="mb-2.5 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-foreground md:text-sm">
                                  {issue.title}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground md:text-xs">
                                  Point #{index + 1}
                                </p>
                              </div>

                              <Badge className={cn("h-6 px-2 text-xs font-bold", severityTone(issue.severity))}>
                                {severityLabel(issue.severity)}
                              </Badge>
                            </div>

                            <p className="mb-3 text-xs font-medium leading-relaxed text-foreground/90 transition-colors group-hover:text-foreground md:text-sm">
                              {issue.recommendation}
                            </p>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : ( 
                    <EmptyStateCard label="Aucun point détecté sur cette page. Aucune action requise." />
                  )}

                  <section className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <SectionTitle showIndicator={false}>Contenu extrait</SectionTitle>
                    </div>

                    <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border bg-background p-4 text-sm leading-6 text-foreground">
                      {selectedRecord.markdown?.trim() || "Aucun contenu markdown extrait pour cette page."}
                    </pre>
               
                  </section>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-6">
                <EmptyStateCard label="Sélectionnez une page pour afficher le détail." className="h-24 w-full" />
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
