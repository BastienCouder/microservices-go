"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Search,
} from "lucide-react";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FloatingPanelHeader } from "@/components/ui/floating-panel-header";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toSafeImageAssetPath } from "@/lib/safe-asset-path";
import { cn } from "@/shared/utils";

import type { PageInsight, PageModelBadge } from "../../_lib/pages-panel/types";
import { usePagesPanelViewModel } from "../../_lib/pages-panel/use-pages-panel-view-model";
import { CitationSourcesPanel } from "./citation-sources-panel";
import { ModelLeaderboard } from "./model-leaderboard";
import { OpportunitiesPanel } from "./opportunities-panel";
import { PageDetailPanel } from "./page-detail-panel";

type PagesPanelProps = {
  apiBaseURL: string;
  routeSearch: string;
};

type PagesSortKey =
  | "page"
  | "visibility"
  | "citations"
  | "responses"
  | "models";

type PagesColumn = {
  id: string;
  label: string;
  className?: string;
  sortKey?: PagesSortKey;
};

const columns: PagesColumn[] = [
  { id: "page", label: "Page", sortKey: "page" },
  { id: "visibility", label: "Visibilité", sortKey: "visibility" },
  { id: "citations", label: "Citations", sortKey: "citations" },
  { id: "responses", label: "Réponses", sortKey: "responses" },
  { id: "models", label: "LLMs", sortKey: "models" },
];

function loadingRows() {
  return Array.from({ length: 6 }).map((_, index) => (
    <TableRow key={index}>
      <TableCell>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full max-w-[300px]" />
          <Skeleton className="h-3 w-2/3 max-w-[220px]" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-16 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-14" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-14" />
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </TableCell>
    </TableRow>
  ));
}

function sortPages(
  pages: PageInsight[],
  sortKey: PagesSortKey,
  sortDirection: "asc" | "desc",
) {
  return [...pages].sort((left, right) => {
    let comparison = 0;

    if (sortKey === "page") {
      comparison = `${left.hostname}${left.path}`.localeCompare(
        `${right.hostname}${right.path}`,
      );
    } else if (sortKey === "visibility") {
      comparison = left.citationShare - right.citationShare;
    } else if (sortKey === "citations") {
      comparison = left.citationCount - right.citationCount;
    } else if (sortKey === "responses") {
      comparison = left.promptCount - right.promptCount;
    } else {
      comparison = left.modelCount - right.modelCount;
    }

    return sortDirection === "asc" ? comparison : -comparison;
  });
}

function PageModelsPreview({ page }: { page: PageInsight }) {
  if (page.models.length === 0) {
    return <span className="text-sm text-muted-foreground">Aucun modèle</span>;
  }

  const visibleModels = page.models.slice(0, 3);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex -space-x-1">
        {visibleModels.map((model) => (
          <span
            key={model.id}
            title={model.label}
            className="grid h-8 w-8 place-items-center rounded-md border border-border/70 bg-background p-1 shadow-sm"
          >
            <img
              src={toSafeImageAssetPath(model.iconPath)}
              alt=""
              width={16}
              height={16}
              loading="lazy"
              decoding="async"
              className="h-4 w-4 object-contain"
            />
          </span>
        ))}
      </div>
      {page.models.length > visibleModels.length ? (
        <span className="text-xs font-medium text-muted-foreground">
          +{page.models.length - visibleModels.length}
        </span>
      ) : null}
    </div>
  );
}

type PagesModelsFilterProps = {
  allModelsSelected: boolean;
  loading: boolean;
  models: PageModelBadge[];
  selectedModelIds: string[];
  toggleModel: (modelId: string) => void;
};

function PagesModelsFilter({
  allModelsSelected,
  loading,
  models,
  selectedModelIds,
  toggleModel,
}: PagesModelsFilterProps) {
  const summaryLabel = allModelsSelected
    ? "Tous les LLMs"
    : `${selectedModelIds.length} LLM${
        selectedModelIds.length > 1 ? "s" : ""
      }`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 w-full justify-between rounded-full border-border/80 bg-background px-4 text-xs sm:h-8 sm:w-auto sm:min-w-[220px]"
        >
          <div className="flex min-w-0 items-center gap-2 overflow-hidden text-left">
            <span className="shrink-0 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Models
            </span>
            <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
            {loading ? (
              <Skeleton className="h-4 w-24 rounded-full" />
            ) : (
              <span className="truncate text-sm font-medium text-foreground">
                {summaryLabel}
              </span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[560px] max-w-[92vw] p-0">
        <FloatingPanelHeader
          title="Couverture IA"
          description="Filtre les pages citées selon les LLMs qui les reprennent."
        />
        <div className="grid grid-cols-1 gap-2 px-4 pb-4 pt-1 sm:grid-cols-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="relative flex items-start gap-2 rounded-2xl border border-border/70 p-3"
              >
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="mt-1 h-2.5 w-2.5 rounded-full" />
              </div>
            ))
          ) : (
            models.map((model) => {
              const checked = selectedModelIds.includes(model.id);
              const highlighted = !allModelsSelected && checked;

              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => toggleModel(model.id)}
                  className={cn(
                    "relative flex items-start gap-2 rounded-2xl border p-3 text-left transition-colors",
                    highlighted
                      ? "border-primary/30 bg-primary/10"
                      : "border-border/70 bg-background hover:bg-muted/30",
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border p-2",
                      highlighted
                        ? "border-primary/30 bg-primary/10"
                        : "border-border/50 bg-background",
                    )}
                  >
                    <img
                      src={toSafeImageAssetPath(model.iconPath)}
                      alt={model.label}
                      className="h-full w-full object-contain opacity-85"
                      decoding="async"
                    />
                  </div>
                  <div className="min-w-0">
                    <div
                      className={cn(
                        "truncate text-sm font-semibold leading-tight",
                        highlighted ? "text-primary" : "text-foreground",
                      )}
                    >
                      {model.label}
                    </div>
                    <div
                      className={cn(
                        "line-clamp-1 text-xs leading-snug",
                        highlighted
                          ? "text-primary/75"
                          : "text-muted-foreground",
                      )}
                    >
                      Pages citées par ce modèle
                    </div>
                  </div>
                  <div
                    className={cn(
                      "ml-auto mt-1 h-2.5 w-2.5 rounded-full",
                      highlighted ? "bg-primary" : "bg-muted-foreground/30",
                    )}
                  />
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
export function PagesPanel({ apiBaseURL, routeSearch }: PagesPanelProps) {
  const viewModel = usePagesPanelViewModel({ apiBaseURL, routeSearch });
  const [sortKey, setSortKey] = useState<PagesSortKey>("visibility");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const sortedPages = useMemo(
    () => sortPages(viewModel.filteredPages, sortKey, sortDirection),
    [sortDirection, sortKey, viewModel.filteredPages],
  );
  const selectedPage =
    sortedPages.find((page) => page.url === viewModel.selectedPageUrl) ??
    sortedPages[0] ??
    null;
  const hasActiveFilters = !viewModel.allModelsSelected;
  const emptyLabel =
    viewModel.error ||
    (viewModel.search.trim() || hasActiveFilters
      ? "Aucune page ne correspond à la recherche."
      : "Aucune page citée pour le moment.");

  function toggleSort(nextKey: PagesSortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "page" ? "asc" : "desc");
  }

  function renderSortIcon(columnKey: PagesSortKey) {
    if (sortKey !== columnKey) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <PageHeader
        title="Pages"
        baseline="Pilotez les URLs citées par les LLMs, les modèles qui les reprennent et les sites externes qui renforcent votre visibilité."
        actionsVariant="classic"
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-background">
        <div className="border-b md:px-4 md:py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={viewModel.search}
                onChange={(event) => viewModel.setSearch(event.target.value)}
                placeholder="Rechercher par URL, domaine ou modèle"
                disabled={viewModel.loading}
                className="pl-9"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
              <PagesModelsFilter
                allModelsSelected={viewModel.allModelsSelected}
                loading={viewModel.loading}
                models={viewModel.modelOptions}
                selectedModelIds={viewModel.selectedModelIds}
                toggleModel={viewModel.toggleModel}
              />
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(300px,42vh)_minmax(0,1fr)] gap-0 xl:grid-cols-[minmax(0,1fr)_420px] xl:grid-rows-1">
          <div className="min-h-0 overflow-auto border-b xl:border-b-0 xl:border-r">
            <Table className="min-w-[760px]">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  {columns.map((column) => {
                    const columnSortKey = column.sortKey;

                    return (
                      <TableHead
                        key={column.id}
                        className={cn(
                          "h-12 px-3 text-sm font-semibold text-muted-foreground",
                          column.className,
                        )}
                      >
                        {columnSortKey ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(columnSortKey)}
                            className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                          >
                            <span>{column.label}</span>
                            {renderSortIcon(columnSortKey)}
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
                {viewModel.loading ? (
                  loadingRows()
                ) : sortedPages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="py-6">
                      <EmptyStateCard label={emptyLabel} className="h-24" />
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedPages.map((page) => {
                    const isSelected = selectedPage?.url === page.url;

                    return (
                      <TableRow
                        key={page.url}
                        tabIndex={0}
                        aria-selected={isSelected}
                        data-state={isSelected ? "selected" : undefined}
                        onClick={() => viewModel.setSelectedPageUrl(page.url)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            viewModel.setSelectedPageUrl(page.url);
                          }
                        }}
                        className={cn(
                          "cursor-pointer border-l-2 border-l-transparent transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                          isSelected && "border-l-primary bg-muted/50",
                        )}
                      >
                        <TableCell className="max-w-[420px] whitespace-normal">
                          <div className="space-y-1">
                            <div className="line-clamp-1 text-sm font-medium text-foreground">
                              {page.hostname}
                            </div>
                            <div className="line-clamp-2 break-all text-xs text-muted-foreground">
                              {page.path}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="h-7 rounded-md px-2.5 font-mono text-xs font-bold"
                          >
                            {page.citationShare}%
                          </Badge>
                        </TableCell>

                        <TableCell className="font-medium">
                          {page.citationCount}
                        </TableCell>

                        <TableCell className="font-medium">
                          {page.promptCount}
                        </TableCell>

                        <TableCell>
                          <PageModelsPreview page={page} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <aside className="min-h-0 overflow-auto">
            <div className="space-y-4">
              <PageDetailPanel
                page={selectedPage}
                loading={viewModel.loading}
                errorLabel={viewModel.error}
              />
              <CitationSourcesPanel
                errorLabel={viewModel.error}
                sources={viewModel.citationSources}
                loading={viewModel.loading}
              />
              <ModelLeaderboard
                models={viewModel.modelLeaders}
                loading={viewModel.loading}
                errorLabel={viewModel.error}
              />
              <OpportunitiesPanel
                errorLabel={viewModel.error}
                opportunities={viewModel.opportunities}
                loading={viewModel.loading}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
