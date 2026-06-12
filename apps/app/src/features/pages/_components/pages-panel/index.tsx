"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
} from "lucide-react";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { MultiSelectFilterPopover } from "@/components/shared/multi-select-filter-popover";
import { PageHeader } from "@/components/shared/page-header";
import { SearchFilterInput } from "@/components/shared/search-filter-input";
import { Badge } from "@/components/ui/badge";
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
import { useScopedI18n } from "@/shared/hooks/use-i18n";
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
  const { t } = useScopedI18n("pages");

  if (page.models.length === 0) {
    return <span className="text-sm text-muted-foreground">{t("noModel")}</span>;
  }

  const visibleModels = page.models.slice(0, 3);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex -space-x-1">
        {visibleModels.map((model) => {
          const safeIconPath = toSafeImageAssetPath(model.iconPath);

          return (
            <span
              key={model.id}
              title={model.label}
              className="grid h-8 w-8 place-items-center rounded-md border border-border/70 bg-background p-1 shadow-sm"
            >
              {safeIconPath ? (
                <img
                  src={safeIconPath}
                  alt=""
                  width={16}
                  height={16}
                  loading="lazy"
                  decoding="async"
                  className="h-4 w-4 object-contain"
                />
              ) : null}
            </span>
          );
        })}
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
  const { t } = useScopedI18n("pages");
  const summaryLabel = allModelsSelected
    ? t("allLlms")
    : t("llmCount", { count: selectedModelIds.length });
  const options = models.map((model) => ({
    id: model.id,
    label: model.label,
    description: t("modelCoverageDescription"),
    iconSrc: toSafeImageAssetPath(model.iconPath) || null,
    imageAlt: model.label,
  }));

  return (
    <MultiSelectFilterPopover
      align="end"
      label={t("modelsFilterLabel")}
      summaryLabel={summaryLabel}
      title={t("modelsCoverageTitle")}
      options={options}
      selectedIds={selectedModelIds}
      onToggle={toggleModel}
      className="rounded-full"
      loading={loading}
      showIconSlot
    />
  );
}
export function PagesPanel({ apiBaseURL, routeSearch }: PagesPanelProps) {
  const { t } = useScopedI18n("pages");
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
  const columns: PagesColumn[] = [
    { id: "page", label: t("pageColumn"), sortKey: "page" },
    { id: "visibility", label: t("visibilityColumn"), sortKey: "visibility" },
    { id: "citations", label: t("citationsColumn"), sortKey: "citations" },
    { id: "responses", label: t("responsesColumn"), sortKey: "responses" },
    { id: "models", label: t("llmsColumn"), sortKey: "models" },
  ];
  const hasActiveFilters = !viewModel.allModelsSelected;
  const emptyLabel =
    viewModel.error ||
    (viewModel.search.trim() || hasActiveFilters
      ? t("noMatchingPage")
      : t("noCitedPageYet"));

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
        title={t("pageTitle")}
        baseline={t("pageBaseline")}
        actionsVariant="classic"
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-background">
        <div className="border-b md:px-4 md:py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SearchFilterInput
              value={viewModel.search}
              onValueChange={viewModel.setSearch}
              placeholder={t("searchPlaceholder")}
              disabled={viewModel.loading}
              className="flex-1"
            />

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
