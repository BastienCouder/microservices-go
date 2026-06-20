"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table2, Workflow } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell } from "@/components/ui/table";
import {
  AiResponsesTable,
  AiResponsesTableLoadingRows,
  type AiResponsesTableColumn,
} from "@/components/shared/ai-responses-table";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { ModelCard } from "@/components/shared/model-card";
import { MultiSelectFilterPopover } from "@/components/shared/multi-select-filter-popover";
import { PeriodFilterPicker } from "@/components/shared/period-filter-picker";
import { ResponsiveFiltersToolbar } from "@/components/shared/responsive-filters-toolbar";
import { SearchFilterInput } from "@/components/shared/search-filter-input";
import { cn } from "@/lib/utils";
import {
  buildPerceptionPeriodOptions,
} from "../_lib";
import { formatPerceptionResponseTime } from "../_lib/perception-response-format";
import {
  loadPerceptionData,
  type PerceptionResponseRecord,
  type PerceptionTrendPeriodKey,
} from "../_lib/shared/perception-data";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { PageHeader } from "@/components/shared/page-header";

type PerceptionResponsesPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

type ResponseView = "timeline" | "table";

const RESPONSE_BATCH_SIZE = 32;

function scoreTone(value: number) {
  if (value >= 75) return "bg-emerald-50 text-emerald-700";
  if (value >= 45) return "bg-amber-50 text-amber-700";
  return "bg-rose-50 text-rose-700";
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function isInPeriod(
  response: PerceptionResponseRecord,
  period: PerceptionTrendPeriodKey,
  latestRunId: string,
) {
  if (period === "all") return true;
  if (period === "last-run") return latestRunId ? response.runId === latestRunId : true;
  if (!response.createdAt) return false;

  const createdAt = new Date(response.createdAt).getTime();
  if (!Number.isFinite(createdAt)) return false;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return Date.now() - createdAt <= days * 24 * 60 * 60 * 1000;
}

function responseContainsCompetitor(response: PerceptionResponseRecord, competitor: string) {
  const needle = normalizeSearch(competitor);
  if (!needle) return false;
  return [
    response.promptText,
    response.rawResponse,
  ].some((value) => normalizeSearch(value ?? "").includes(needle));
}

function MetricCell({ value }: { value: number }) {
  return (
    <Badge variant="secondary" className={cn("border-transparent text-sm", scoreTone(value))}>
      {value}
    </Badge>
  );
}

function ResponseTableLoadingRows() {
  return <AiResponsesTableLoadingRows columns={9} rows={8} />;
}

function ResponseTimelineLoadingRows() {
  return (
    <div className="space-y-3 py-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-md border bg-background p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function renderTableRow(response: PerceptionResponseRecord, locale: string) {
  return (
    <>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm">
          {formatPerceptionResponseTime(response.createdAt, locale)}
        </span>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm">
          {response.modelName || response.modelId || "-"}
        </span>
      </TableCell>
      <TableCell className="min-w-[280px] max-w-[420px]">
        <div className="line-clamp-2 text-sm font-medium leading-6">
          {response.promptText || response.rawResponse || "-"}
        </div>
      </TableCell>
      <TableCell><MetricCell value={response.metrics.positioning} /></TableCell>
      <TableCell><MetricCell value={response.metrics.factual} /></TableCell>
      <TableCell><MetricCell value={response.metrics.use_cases} /></TableCell>
      <TableCell><MetricCell value={response.metrics.features} /></TableCell>
      <TableCell><MetricCell value={response.metrics.sentiment} /></TableCell>
      <TableCell><MetricCell value={response.metrics.competitors} /></TableCell>
    </>
  );
}

function renderTimelineItem(response: PerceptionResponseRecord, locale: string) {
  return (
    <div className="py-3">
      <div className="rounded-md border p-3 transition-colors hover:bg-muted/50">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex min-w-0 flex-wrap items-center gap-2 font-medium">
            <span>{formatPerceptionResponseTime(response.createdAt, locale)} ·</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm">
              {response.modelName || response.modelId || "-"}
            </span>
          </div>
        </div>
        <p className="mt-2 line-clamp-2 text-sm font-medium">
          {response.promptText || response.rawResponse || "-"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <MetricCell value={response.metrics.positioning} />
          <MetricCell value={response.metrics.factual} />
          <MetricCell value={response.metrics.use_cases} />
          <MetricCell value={response.metrics.features} />
          <MetricCell value={response.metrics.sentiment} />
          <MetricCell value={response.metrics.competitors} />
        </div>
      </div>
    </div>
  );
}

export function PerceptionResponsesPage({
  apiBaseURL,
  routeSearch,
}: PerceptionResponsesPageProps) {
  const { locale, t } = useScopedI18n("perception");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<PerceptionTrendPeriodKey>("all");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [competitorsOpen, setCompetitorsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ResponseView>("table");
  const [visibleCount, setVisibleCount] = useState(RESPONSE_BATCH_SIZE);

  const resultsQuery = useQuery({
    queryKey: ["perception-responses", apiBaseURL, routeSearch],
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) => loadPerceptionData(apiBaseURL, routeSearch, { signal }),
  });

  const data = resultsQuery.data?.data;
  const columns = useMemo<AiResponsesTableColumn[]>(
    () => [
      { id: "time", label: t("responsesColumnTime") },
      { id: "ai", label: t("responsesColumnAi") },
      { id: "prompt", label: t("responsesColumnPrompt"), className: "min-w-[280px]" },
      { id: "positioning", label: t("responsesColumnPositioning") },
      { id: "factual", label: t("responsesColumnFactual") },
      { id: "use_cases", label: t("responsesColumnUseCases") },
      { id: "features", label: t("responsesColumnFeatures") },
      { id: "sentiment", label: t("responsesColumnSentiment") },
      { id: "competitors", label: t("responsesColumnCompetitors") },
    ],
    [t],
  );
  const allResponses = useMemo(
    () =>
      (data?.responses ?? [])
        .filter(
          (response) => response.runType === "perception" || response.promptKind === "perception",
        )
        .sort((left, right) => {
          const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
          const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
          return rightTime - leftTime;
        }),
    [data?.responses],
  );
  const availableModels = useMemo(
    () =>
      Array.from(
        new Set(
          allResponses
            .map((response) => response.modelName || response.modelId)
            .filter(Boolean),
        ),
      ),
    [allResponses],
  );
  const modelMetaByLabel = useMemo(() => {
    const entries = new Map<string, NonNullable<typeof data>["metadata"]["modelCatalog"][number]>();
    for (const model of data?.metadata.modelCatalog ?? []) {
      for (const key of [model.id, model.displayName, model.groupName, model.providerModelId]) {
        if (key.trim()) entries.set(key.trim(), model);
      }
    }
    return entries;
  }, [data?.metadata.modelCatalog]);
  const availableCompetitors = useMemo(
    () => (data?.competitors ?? []).map((competitor) => competitor.name).filter(Boolean),
    [data?.competitors],
  );
  const periodOptions = useMemo(() => buildPerceptionPeriodOptions(locale), [locale]);
  const latestRunId = data?.metadata.latestRunId ?? "";

  const filteredResponses = useMemo(() => {
    const query = normalizeSearch(search);
    const modelSet = new Set(selectedModels);
    return allResponses.filter((response) => {
      if (query) {
        const haystack = [
          response.promptText,
          response.rawResponse,
          response.modelName,
          response.modelId,
        ].map((value) => normalizeSearch(value ?? "")).join(" ");
        if (!haystack.includes(query)) return false;
      }
      if (modelSet.size > 0 && !modelSet.has(response.modelName || response.modelId)) {
        return false;
      }
      if (selectedCompetitors.length > 0) {
        if (!selectedCompetitors.some((competitor) => responseContainsCompetitor(response, competitor))) {
          return false;
        }
      }
      return isInPeriod(response, period, latestRunId);
    });
  }, [allResponses, latestRunId, period, search, selectedCompetitors, selectedModels]);

  useEffect(() => {
    setVisibleCount(RESPONSE_BATCH_SIZE);
  }, [period, search, selectedCompetitors, selectedModels, viewMode]);

  const visibleResponses = filteredResponses.slice(0, visibleCount);
  const hasMoreResponses = visibleResponses.length < filteredResponses.length;
  const loadMoreResponses = () => {
    if (!hasMoreResponses) return;
    setVisibleCount((current) => current + RESPONSE_BATCH_SIZE);
  };
  const hasActiveFilters =
    search.trim() !== "" ||
    period !== "all" ||
    selectedModels.length > 0 ||
    selectedCompetitors.length > 0;

  const toggleModel = (model: string) => {
    setSelectedModels((current) =>
      current.includes(model)
        ? current.filter((item) => item !== model)
        : [...current, model],
    );
  };
  const toggleCompetitor = (competitor: string) => {
    setSelectedCompetitors((current) =>
      current.includes(competitor)
        ? current.filter((item) => item !== competitor)
        : [...current, competitor],
    );
  };
  const clearFilters = () => {
    setSearch("");
    setPeriod("all");
    setSelectedModels([]);
    setSelectedCompetitors([]);
  };

  const renderFilters = () => (
    <>
      <SearchFilterInput
        value={search}
        onValueChange={setSearch}
        placeholder={t("responsesSearchPlaceholder")}
        className="w-full min-w-0 sm:min-w-[260px] sm:flex-1 lg:max-w-[480px]"
      />
      <PeriodFilterPicker
        className="w-full sm:w-[220px]"
        value={period}
        onValueChange={(value) => setPeriod(value as PerceptionTrendPeriodKey)}
        options={periodOptions}
        label={t("filtersPeriod")}
        title={t("filtersPeriod")}
      />
      <MultiSelectFilterPopover
        open={modelsOpen}
        onOpenChange={setModelsOpen}
        label={t("responsesModelsFilterLabel")}
        summaryLabel={
          selectedModels.length === 0
            ? t("responsesDefaultModels")
            : t("responsesSelectedModels", { count: selectedModels.length })
        }
        title={t("responsesModelsFilterTitle")}
        options={availableModels.map((model) => ({ id: model, label: model }))}
        selectedIds={selectedModels}
        onToggle={toggleModel}
        className="sm:min-w-[240px] sm:max-w-[360px]"
        contentClassName="w-[640px]"
        gridClassName="sm:grid-cols-2"
        loading={resultsQuery.isLoading}
        renderOption={(option, selected, onToggleOption) => {
          const meta = modelMetaByLabel.get(option.id);
          return (
            <ModelCard
              name={meta?.displayName || option.label}
              description={meta?.description || meta?.providerModelId || option.label}
              icon={meta?.iconPath || meta?.providerModelId || option.label}
              selected={selected}
              onClick={onToggleOption}
              modelGroup={meta?.groupName || meta?.provider || option.label}
              size="small"
              variant="monitoring"
            />
          );
        }}
      />
      <MultiSelectFilterPopover
        open={competitorsOpen}
        onOpenChange={setCompetitorsOpen}
        label={t("responsesCompetitorsFilterLabel")}
        summaryLabel={
          selectedCompetitors.length === 0
            ? t("responsesAllCompetitors")
            : selectedCompetitors.length === 1
              ? selectedCompetitors[0]!
              : t("responsesSelectedCompetitors", { count: selectedCompetitors.length })
        }
        title={t("responsesCompetitorsFilterTitle")}
        options={availableCompetitors.map((competitor) => ({ id: competitor, label: competitor }))}
        selectedIds={selectedCompetitors}
        onToggle={toggleCompetitor}
        allOption={{
          label: t("responsesAllCompetitors"),
          selected: selectedCompetitors.length === 0,
          onSelect: () => setSelectedCompetitors([]),
        }}
        className="sm:min-w-[240px] sm:max-w-[360px]"
        loading={resultsQuery.isLoading}
      />
      {hasActiveFilters ? (
        <Button type="button" size="sm" variant="ghost" className="h-8 px-4 text-xs" onClick={clearFilters}>
          {t("filtersClear")}
        </Button>
      ) : null}
    </>
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden md:p-4">
      <PageHeader
        title={t("responsesPageTitle")}
        baseline={t("responsesPageBaseline")}
        actionsVariant="classic"
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-xl rounded-tr-none bg-background">
        <div className="border-b px-3 pb-3 md:px-4 md:pb-4">
          <ResponsiveFiltersToolbar
            label={t("leftPanelTabFilters")}
            className="px-0"
            desktopClassName="mt-3 px-0"
            mobileClassName="mx-0"
          >
            {renderFilters}
          </ResponsiveFiltersToolbar>
        </div>

        <div className="border-b py-2 md:px-4 md:py-3">
          <div className="flex min-h-10 justify-between gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex shrink-0 items-center">
              {resultsQuery.isLoading ? (
                <Skeleton className="h-9 w-36 rounded-full" />
              ) : (
                <Badge variant="outline" className="h-9 justify-center px-3 text-sm">
                  {t("responsesCount", {
                    visible: visibleResponses.length,
                    total: filteredResponses.length,
                    count: filteredResponses.length,
                  })}
                </Badge>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
              <div className="flex h-10 w-full gap-1 rounded-xl border p-1 sm:w-auto">
                <Button
                  size="sm"
                  variant={viewMode === "timeline" ? "default" : "ghost"}
                  className="h-8 flex-1 rounded-lg px-3 text-sm sm:flex-none"
                  onClick={() => setViewMode("timeline")}
                >
                  <Workflow className="mr-1.5 h-4 w-4" />
                  {t("responsesTimeline")}
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "table" ? "default" : "ghost"}
                  className="h-8 flex-1 rounded-lg px-3 text-sm sm:flex-none"
                  onClick={() => setViewMode("table")}
                >
                  <Table2 className="mr-1.5 h-4 w-4" />
                  {t("responsesTable")}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-4">
          <div className="min-h-0 flex-1">
            {resultsQuery.error ? (
              <EmptyStateCard
                label={
                  resultsQuery.error instanceof Error
                    ? resultsQuery.error.message
                    : t("responsesUnknownError")
                }
                className="my-4"
              />
            ) : viewMode === "table" ? (
              <AiResponsesTable
                columns={columns}
                rows={visibleResponses}
                getRowId={(response) => response.id || `${response.promptRunId}-${response.modelId}`}
                loading={resultsQuery.isLoading}
                loadingState={<ResponseTableLoadingRows />}
                emptyState={<EmptyStateCard label={t("responsesEmpty")} className="my-4" />}
                minWidthClassName="min-w-[1120px]"
                onEndReached={loadMoreResponses}
                renderRow={(response) => renderTableRow(response, locale)}
              />
            ) : resultsQuery.isLoading ? (
              <ResponseTimelineLoadingRows />
            ) : visibleResponses.length === 0 ? (
              <EmptyStateCard label={t("responsesEmpty")} className="my-4" />
            ) : (
              <Virtuoso
                style={{ height: "100%" }}
                data={visibleResponses}
                computeItemKey={(_, response) => response.id || `${response.promptRunId}-${response.modelId}`}
                defaultItemHeight={112}
                endReached={loadMoreResponses}
                increaseViewportBy={{ top: 96, bottom: 160 }}
                itemContent={(_, response) => renderTimelineItem(response, locale)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
