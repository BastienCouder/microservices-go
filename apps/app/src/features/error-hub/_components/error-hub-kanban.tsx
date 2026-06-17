"use client";

import { useMemo, useState } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OptimizationError } from "@/features/perception/_lib/shared/optimization-errors-data";
import {
  buildProjectModelLookup,
} from "@/lib/project-models";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { useLocale, useScopedI18n } from "@/shared/hooks/use-i18n";

import { buildPerceptionModelLookup } from "../../perception/_components/top-errors-panel";
import { ErrorHubColumn } from "./error-hub-column";
import { ErrorHubDetailsPanel } from "./error-hub-details-panel";
import { ErrorHubFiltersToolbar } from "./error-hub-filters-toolbar";
import {
  type ActionStatusFilter,
  type ErrorHubBoardView,
  type PeriodFilter,
  type SourceFilter,
} from "../_lib/error-hub-types";
import {
  getErrorContextMeta,
  getFilteredErrors,
  groupErrorsByActionStatus,
  getMonitoringOriginBadge,
  groupErrorsBySeverity,
  listAvailableModels,
} from "../_lib/error-hub-utils";

type ErrorHubKanbanProps = {
  actionStatusesByErrorId: ReadonlyMap<string, string>;
  canGenerateAiBrief: boolean;
  competitors: string[];
  errors: OptimizationError[];
  generatedContentByErrorId: ReadonlyMap<string, string>;
  generatedIds: ReadonlySet<string>;
  initialSourceFilter?: SourceFilter;
  loading: boolean;
  markingDoneErrorIds: ReadonlySet<string>;
  modelCatalog: Parameters<typeof buildPerceptionModelLookup>[0];
  onCreateAction?: (error: OptimizationError) => void | Promise<void>;
  onMarkDone?: (error: OptimizationError) => void | Promise<void>;
  persistError: string | null;
  savingErrorIds: ReadonlySet<string>;
};

export function ErrorHubKanban({
  actionStatusesByErrorId,
  canGenerateAiBrief,
  competitors,
  errors,
  generatedContentByErrorId,
  generatedIds,
  initialSourceFilter,
  loading,
  markingDoneErrorIds,
  modelCatalog,
  onCreateAction,
  onMarkDone,
  persistError,
  savingErrorIds,
}: ErrorHubKanbanProps) {
  const { locale } = useLocale();
  const { t } = useScopedI18n("perception");
  const { t: tErrorHub } = useScopedI18n("error-hub");
  const isMobile = useIsMobile();

  const [competitorsPopoverOpen, setCompetitorsPopoverOpen] = useState(false);
  const [modelsPopoverOpen, setModelsPopoverOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [actionStatusFilter, setActionStatusFilter] =
    useState<ActionStatusFilter>("all");
  const [boardView, setBoardView] = useState<ErrorHubBoardView>("severity");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(
    initialSourceFilter ?? "all",
  );
  const [search, setSearch] = useState("");
  const [selectedError, setSelectedError] = useState<OptimizationError | null>(
    null,
  );
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  const availableModels = useMemo(() => listAvailableModels(errors), [errors]);

  const modelLookup = useMemo(
    () => buildPerceptionModelLookup(modelCatalog),
    [modelCatalog],
  );

  const projectModelLookup = useMemo(
    () => buildProjectModelLookup(modelCatalog),
    [modelCatalog],
  );

  const filteredErrors = useMemo(
    () =>
      getFilteredErrors({
        actionStatusFilter,
        actionStatusesByErrorId,
        errors,
        period,
        search,
        selectedCompetitors,
        selectedModels,
        sourceFilter,
      }),
    [
      actionStatusFilter,
      actionStatusesByErrorId,
      errors,
      period,
      search,
      selectedCompetitors,
      selectedModels,
      sourceFilter,
    ],
  );

  const columns = useMemo(
    () => {
      const grouped =
        canGenerateAiBrief && boardView === "status"
          ? groupErrorsByActionStatus(filteredErrors, actionStatusesByErrorId)
          : groupErrorsBySeverity(filteredErrors, actionStatusesByErrorId);

      return grouped.map((column) => ({
        ...column,
        title:
          canGenerateAiBrief && boardView === "status"
            ? column.id === "todo"
              ? tErrorHub("statusColumnTodo")
              : column.id === "processing"
                ? tErrorHub("statusColumnProcessing")
                : tErrorHub("statusColumnDone")
            : column.id === "high"
              ? tErrorHub("severityColumnHigh")
              : column.id === "medium"
                ? tErrorHub("severityColumnMedium")
                : tErrorHub("severityColumnLow"),
      }));
    },
    [actionStatusesByErrorId, boardView, canGenerateAiBrief, filteredErrors, tErrorHub],
  );

  const allCompetitorsSelected = selectedCompetitors.length === 0;
  const allModelsSelected = selectedModels.length === 0;

  const hasActiveFilters =
    search.trim() !== "" ||
    period !== "all" ||
    actionStatusFilter !== "all" ||
    sourceFilter !== "all" ||
    selectedCompetitors.length > 0 ||
    selectedModels.length > 0;

  const clearFilters = () => {
    setPeriod("all");
    setActionStatusFilter("all");
    setSourceFilter("all");
    setSearch("");
    setSelectedCompetitors([]);
    setSelectedModels([]);
  };

  const toggleCompetitor = (competitor: string) => {
    setSelectedCompetitors((current) => {
      if (current.length === 0) return [competitor];

      if (current.includes(competitor)) {
        return current.filter((item) => item !== competitor);
      }

      return [...current, competitor];
    });
  };

  const toggleModel = (model: string) => {
    setSelectedModels((current) => {
      if (current.length === 0) return [model];

      if (current.includes(model)) {
        return current.filter((item) => item !== model);
      }

      return [...current, model];
    });
  };

  const handleDetailsOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedError(null);
    }
  };

  const getContextBadge = (error: OptimizationError) =>
    getMonitoringOriginBadge(error, locale);

  const getContextMeta = (error: OptimizationError) =>
    getErrorContextMeta(error, locale);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-2 md:p-4">
      <PageHeader
        title={tErrorHub("pageTitle")}
        baseline={tErrorHub("pageBaseline")}
        actionsVariant="classic"
      />

      <div className="rounded-xl bg-background px-3 pb-3 md:px-4 md:pb-4">
        <div className="flex flex-col gap-3 md:gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-4">
            <div className="min-w-0 flex-1 space-y-4">
              <ErrorHubFiltersToolbar
                actionStatusFilter={actionStatusFilter}
                allCompetitorsSelected={allCompetitorsSelected}
                allModelsSelected={allModelsSelected}
                availableCompetitors={competitors}
                availableModels={availableModels}
                clearFilters={clearFilters}
                competitorsPopoverOpen={competitorsPopoverOpen}
                hasActiveFilters={hasActiveFilters}
                modelsPopoverOpen={modelsPopoverOpen}
                period={period}
                projectModelLookup={projectModelLookup}
                search={search}
                selectedCompetitors={selectedCompetitors}
                selectedModels={selectedModels}
                setCompetitorsPopoverOpen={setCompetitorsPopoverOpen}
                setActionStatusFilter={setActionStatusFilter}
                setModelsPopoverOpen={setModelsPopoverOpen}
                setPeriod={setPeriod}
                setSearch={setSearch}
                setSourceFilter={setSourceFilter}
                sourceFilter={sourceFilter}
                toggleCompetitor={toggleCompetitor}
                toggleModel={toggleModel}
              />
              {canGenerateAiBrief ? (
                <Tabs
                  value={boardView}
                  onValueChange={(value) =>
                    setBoardView(value as ErrorHubBoardView)
                  }
                  className="w-full md:w-auto"
                >
                  <TabsList className="h-10 w-full md:w-auto">
                    <TabsTrigger value="severity" className="px-3 text-xs md:text-sm">
                      {tErrorHub("boardBySeverity")}
                    </TabsTrigger>
                    <TabsTrigger value="status" className="px-3 text-xs md:text-sm">
                      {tErrorHub("boardByStatus")}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <main className="min-h-0 flex-1 overflow-visible lg:overflow-hidden">
        <div className="grid min-h-0 gap-8 pt-4 lg:h-full lg:grid-cols-3">
          {columns.map((column, columnIndex) => (
            <ErrorHubColumn
              key={column.id}
              {...column}
              actionStatusesByErrorId={actionStatusesByErrorId}
              columnId={column.id}
              columnIndex={columnIndex}
              emptyLabel={persistError}
              generatedIds={generatedIds}
              loading={loading}
              locale={locale}
              markingDoneErrorIds={markingDoneErrorIds}
              modelLookup={modelLookup}
              onCreateAction={canGenerateAiBrief ? onCreateAction : undefined}
              onMarkDone={canGenerateAiBrief ? onMarkDone : undefined}
              onOpenDetails={setSelectedError}
              savingErrorIds={savingErrorIds}
              totalColumns={columns.length}
            />
          ))}
        </div>
      </main>

      <ErrorHubDetailsPanel
        actionStatusesByErrorId={actionStatusesByErrorId}
        generatedIds={generatedIds}
        getContextBadge={getContextBadge}
        getContextMeta={getContextMeta}
        isMobile={isMobile}
        locale={locale}
        markingDoneErrorIds={markingDoneErrorIds}
        modelLookup={modelLookup}
        onCreateAction={canGenerateAiBrief ? onCreateAction : undefined}
        onMarkDone={canGenerateAiBrief ? onMarkDone : undefined}
        onOpenChange={handleDetailsOpenChange}
        savingErrorIds={savingErrorIds}
        selectedError={selectedError}
        sheetDescription={t("topErrorsSheetDescription")}
      />
    </div>
  );
}
