"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { PageHeader } from "@/components/shared/page-header";
import { PeriodFilterPicker, type PeriodFilterOption } from "@/components/shared/period-filter-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FloatingPanelHeader } from "@/components/ui/floating-panel-header";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { getModelGroupForName, getModelIconForName } from "@/lib/app-data";
import type { PerceptionSeverity } from "@/lib/perception-data";
import type { OptimizationError } from "@/lib/optimization-errors-data";
import { cn } from "@/lib/utils";
import { useLocale } from "@/shared/hooks/use-i18n";
import { buildPerceptionModelLookup, PerceptionTopErrorCard } from "../perception/_components";
import { useOptimizationErrors } from "../perception/core/use-optimization-errors";

type PerceptionOptimizeActionsPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

const SEVERITY_COLUMNS: Array<{
  severity: PerceptionSeverity;
  title: string;
  tone: string;
}> = [
  {
    severity: "high",
    title: "Critique",
    tone: "bg-destructive/10 text-destructive",
  },
  {
    severity: "medium",
    title: "Moyenne",
    tone: "bg-amber-500/10 text-amber-700",
  },
  {
    severity: "low",
    title: "Faible",
    tone: "bg-green-500/10 text-green-700",
  },
];

const PERIOD_OPTIONS = [
  { value: "all", label: "Toutes les erreurs" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
] as const satisfies readonly PeriodFilterOption[];

type PeriodFilter = (typeof PERIOD_OPTIONS)[number]["value"];

function groupPerceptionErrors(errors: OptimizationError[]) {
  return SEVERITY_COLUMNS.map((column) => ({
    ...column,
    errors: errors.filter((error) => error.severity === column.severity),
  }));
}

function listAvailableModels(errors: OptimizationError[]) {
  return Array.from(
    new Set(errors.flatMap((error) => error.detectedInModels).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));
}

function getErrorSearchText(error: OptimizationError) {
  return [
    error.title,
    error.issue,
    error.impact,
    error.generatedContent,
    error.type,
    error.source,
    ...error.detectedInModels,
  ].join(" ").toLowerCase();
}

function parseErrorDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function filterErrorsByPeriod(errors: OptimizationError[], period: PeriodFilter) {
  if (period === "all") return errors;

  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const minTime = Date.now() - days * 24 * 60 * 60 * 1000;
  return errors.filter((error) => {
    const createdAt = parseErrorDate(error.createdAt);
    return !createdAt || createdAt.getTime() >= minTime;
  });
}

function filterErrorsByModels(errors: OptimizationError[], selectedModels: string[]) {
  if (selectedModels.length === 0) return errors;
  return errors.filter((error) =>
    error.detectedInModels.some((model) => selectedModels.includes(model)),
  );
}

function filterErrorsByCompetitors(errors: OptimizationError[], selectedCompetitors: string[]) {
  if (selectedCompetitors.length === 0) return errors;
  const normalizedCompetitors = selectedCompetitors.map((competitor) =>
    competitor.trim().toLowerCase(),
  );

  return errors.filter((error) => {
    const haystack = getErrorSearchText(error);
    return normalizedCompetitors.some((competitor) => haystack.includes(competitor));
  });
}

function filterErrorsBySearch(errors: OptimizationError[], search: string) {
  const needle = search.trim().toLowerCase();
  if (!needle) return errors;

  return errors.filter((error) => {
    return getErrorSearchText(error).includes(needle);
  });
}

function getModelVisual(model: string) {
  return {
    icon: getModelIconForName(model),
    description: "Modele IA",
    label: model,
    provider: getModelGroupForName(model),
    name: model,
  };
}

function ErrorHubSearchFilter({
  onSearchChange,
  search,
}: {
  onSearchChange: (value: string) => void;
  search: string;
}) {
  return (
    <div className="relative w-full sm:w-[280px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Rechercher"
        className="h-10 rounded-full border-border/80 bg-background pl-9 text-sm sm:h-8"
      />
    </div>
  );
}

function ModelsFilterPopover({
  allModelsSelected,
  availableModels,
  onOpenChange,
  open,
  selectedModels,
  toggleModel,
}: {
  allModelsSelected: boolean;
  availableModels: string[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  selectedModels: string[];
  toggleModel: (model: string) => void;
}) {
  const summaryLabel = allModelsSelected
    ? "Tous les modèles"
    : `${selectedModels.length} sélectionné${selectedModels.length > 1 ? "s" : ""}`;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 w-full justify-between rounded-full border-border/80 bg-background px-4 text-xs sm:h-8 sm:w-auto sm:min-w-[220px]">
          <div className="flex min-w-0 items-center gap-2 overflow-hidden text-left">
            <span className="shrink-0 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Modèles
            </span>
            <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
            <span className="truncate text-sm font-medium text-foreground">{summaryLabel}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[560px] max-w-[92vw] p-0">
        <FloatingPanelHeader
          title="Modèles"
          description="Filtrer les erreurs par modèle IA détecté."
        />
        <div className="grid grid-cols-1 gap-2 px-4 pb-4 pt-1 sm:grid-cols-2">
          {availableModels.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 p-3 text-sm text-muted-foreground">
              Aucun modèle détecté
            </div>
          ) : (
            availableModels.map((model) => {
              const checked = selectedModels.includes(model);
              const highlighted = !allModelsSelected && checked;
              const meta = getModelVisual(model);

              return (
                <button
                  key={model}
                  type="button"
                  onClick={() => toggleModel(model)}
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
                      highlighted ? "border-primary/30 bg-primary/10" : "border-border/50 bg-background",
                    )}
                  >
                    <img src={meta.icon} alt={model} className="h-full w-full object-contain opacity-85" decoding="async" />
                  </div>
                  <div className="min-w-0">
                    <div className={cn("truncate text-sm font-semibold leading-tight", highlighted ? "text-primary" : "text-foreground")}>
                      {meta.label}
                    </div>
                    <div className={cn("line-clamp-1 text-xs leading-snug", highlighted ? "text-primary/75" : "text-muted-foreground")}>
                      {meta.provider} {meta.name !== meta.label ? `- ${meta.name}` : ""}
                    </div>
                  </div>
                  <div className={cn("ml-auto mt-1 h-2.5 w-2.5 rounded-full", highlighted ? "bg-primary" : "bg-muted-foreground/30")} />
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CompetitorsFilterPopover({
  allCompetitorsSelected,
  availableCompetitors,
  onOpenChange,
  open,
  selectedCompetitors,
  toggleCompetitor,
}: {
  allCompetitorsSelected: boolean;
  availableCompetitors: string[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  selectedCompetitors: string[];
  toggleCompetitor: (competitor: string) => void;
}) {
  const summaryLabel = allCompetitorsSelected
    ? "Tous les concurrents"
    : `${selectedCompetitors.length} sélectionné${selectedCompetitors.length > 1 ? "s" : ""}`;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 w-full justify-between rounded-full border-border/80 bg-background px-4 text-xs sm:h-8 sm:w-auto sm:min-w-[220px]">
          <div className="flex min-w-0 items-center gap-2 overflow-hidden text-left">
            <span className="shrink-0 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Concurrents
            </span>
            <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
            <span className="truncate text-sm font-medium text-foreground">{summaryLabel}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] max-w-[92vw] p-0">
        <FloatingPanelHeader
          title="Concurrents"
          description="Filtrer les erreurs qui mentionnent un concurrent."
        />
        <div className="grid grid-cols-1 gap-2 px-4 pb-4 pt-1">
          {availableCompetitors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 p-3 text-sm text-muted-foreground">
              Aucun concurrent disponible
            </div>
          ) : (
            availableCompetitors.map((competitor) => {
              const checked = selectedCompetitors.includes(competitor);
              const highlighted = !allCompetitorsSelected && checked;

              return (
                <button
                  key={competitor}
                  type="button"
                  onClick={() => toggleCompetitor(competitor)}
                  className={cn(
                    "relative flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                    highlighted
                      ? "border-primary/30 bg-primary/10"
                      : "border-border/70 bg-background hover:bg-muted/30",
                  )}
                >
                  <span className={cn("h-2.5 w-2.5 rounded-full", highlighted ? "bg-primary" : "bg-muted-foreground/30")} />
                  <span className={cn("min-w-0 truncate text-sm font-semibold", highlighted ? "text-primary" : "text-foreground")}>
                    {competitor}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OptimizationFiltersToolbar({
  allCompetitorsSelected,
  allModelsSelected,
  availableCompetitors,
  availableModels,
  clearFilters,
  hasActiveFilters,
  competitorsPopoverOpen,
  modelsPopoverOpen,
  period,
  search,
  selectedCompetitors,
  selectedModels,
  setCompetitorsPopoverOpen,
  setModelsPopoverOpen,
  setPeriod,
  setSearch,
  toggleCompetitor,
  toggleModel,
}: {
  allCompetitorsSelected: boolean;
  allModelsSelected: boolean;
  availableCompetitors: string[];
  availableModels: string[];
  clearFilters: () => void;
  hasActiveFilters: boolean;
  competitorsPopoverOpen: boolean;
  modelsPopoverOpen: boolean;
  period: PeriodFilter;
  search: string;
  selectedCompetitors: string[];
  selectedModels: string[];
  setCompetitorsPopoverOpen: (open: boolean) => void;
  setModelsPopoverOpen: (open: boolean) => void;
  setPeriod: (period: PeriodFilter) => void;
  setSearch: (value: string) => void;
  toggleCompetitor: (competitor: string) => void;
  toggleModel: (model: string) => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersContent = (
    <>
      <ErrorHubSearchFilter search={search} onSearchChange={setSearch} />
      <PeriodFilterPicker
        className="w-full sm:w-[220px]"
        value={period}
        onValueChange={(value) => setPeriod(value as PeriodFilter)}
        options={PERIOD_OPTIONS}
        label="Période"
        title="Période"
        description="Filtrer les erreurs par période."
      />
      <ModelsFilterPopover
        open={modelsPopoverOpen}
        onOpenChange={setModelsPopoverOpen}
        allModelsSelected={allModelsSelected}
        selectedModels={selectedModels}
        availableModels={availableModels}
        toggleModel={toggleModel}
      />
      <CompetitorsFilterPopover
        open={competitorsPopoverOpen}
        onOpenChange={setCompetitorsPopoverOpen}
        allCompetitorsSelected={allCompetitorsSelected}
        selectedCompetitors={selectedCompetitors}
        availableCompetitors={availableCompetitors}
        toggleCompetitor={toggleCompetitor}
      />
      {hasActiveFilters ? (
        <Button
          size="xs"
          variant="ghost"
          className="h-10 justify-center rounded-full px-4 text-xs"
          onClick={clearFilters}
        >
          Réinitialiser
        </Button>
      ) : null}
    </>
  );

  return (
    <>
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="mt-5 md:hidden">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="flex h-11 w-full items-center justify-between rounded-2xl px-4"
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <SlidersHorizontal className="h-4 w-4" />
              Filtres
            </span>
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", filtersOpen && "rotate-180")}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="mt-3 flex flex-col gap-2">{filtersContent}</div>
        </CollapsibleContent>
      </Collapsible>

      <div className="mt-5 hidden flex-col gap-2 md:flex md:flex-row md:flex-wrap md:items-center">
        {filtersContent}
      </div>
    </>
  );
}

function OptimizationErrorsKanban({
  competitors,
  errors,
  generatedIds,
  loading,
  modelCatalog,
  onCreateAction,
  persistError,
  savingErrorIds,
}: {
  competitors: string[];
  errors: OptimizationError[];
  generatedIds: ReadonlySet<string>;
  loading: boolean;
  modelCatalog: Parameters<typeof buildPerceptionModelLookup>[0];
  onCreateAction: (error: OptimizationError) => void | Promise<void>;
  persistError: string | null;
  savingErrorIds: ReadonlySet<string>;
}) {
  const { locale } = useLocale();
  const [competitorsPopoverOpen, setCompetitorsPopoverOpen] = useState(false);
  const [modelsPopoverOpen, setModelsPopoverOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const availableModels = useMemo(() => listAvailableModels(errors), [errors]);
  const modelLookup = useMemo(
    () => buildPerceptionModelLookup(modelCatalog),
    [modelCatalog],
  );
  const filteredErrors = useMemo(
    () =>
      filterErrorsBySearch(
        filterErrorsByCompetitors(
          filterErrorsByModels(filterErrorsByPeriod(errors, period), selectedModels),
          selectedCompetitors,
        ),
        search,
      ),
    [errors, period, search, selectedCompetitors, selectedModels],
  );
  const columns = useMemo(() => groupPerceptionErrors(filteredErrors), [filteredErrors]);
  const allCompetitorsSelected = selectedCompetitors.length === 0;
  const allModelsSelected = selectedModels.length === 0;
  const hasActiveFilters =
    search.trim() !== "" ||
    period !== "all" ||
    selectedCompetitors.length > 0 ||
    selectedModels.length > 0;
  const clearFilters = () => {
    setPeriod("all");
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

  return (
    <div className="flex h-auto min-h-full flex-col px-3 pb-6 pt-3 md:px-4 lg:m-4 lg:h-full lg:min-h-0 lg:overflow-hidden lg:px-0 lg:pb-0 lg:pt-0">
      <PageHeader
        title="Error hub"
        baseline="Centre de triage des erreurs de perception, monitoring et optimisation."
        actionsVariant="classic"
      />

      <div className="rounded-md bg-background px-3 pb-3 md:px-4 md:pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-4">
          <div className="min-w-0 flex-1">
            {persistError ? (
              <p className="mt-2 text-xs text-destructive">{persistError}</p>
            ) : null}
            <OptimizationFiltersToolbar
              allCompetitorsSelected={allCompetitorsSelected}
              allModelsSelected={allModelsSelected}
              availableCompetitors={competitors}
              availableModels={availableModels}
              clearFilters={clearFilters}
              competitorsPopoverOpen={competitorsPopoverOpen}
              hasActiveFilters={hasActiveFilters}
              modelsPopoverOpen={modelsPopoverOpen}
              period={period}
              search={search}
              selectedCompetitors={selectedCompetitors}
              selectedModels={selectedModels}
              setCompetitorsPopoverOpen={setCompetitorsPopoverOpen}
              setModelsPopoverOpen={setModelsPopoverOpen}
              setPeriod={setPeriod}
              setSearch={setSearch}
              toggleCompetitor={toggleCompetitor}
              toggleModel={toggleModel}
            />
          </div>
        </div>
      </div>

      <main className="min-h-0 flex-1 overflow-visible lg:overflow-hidden">
        <div className="grid min-h-0 gap-8 pt-4 lg:h-full lg:grid-cols-3">
          {columns.map((column, columnIndex) => (
            <section
              key={column.severity}
              className="relative flex min-h-[420px] flex-col rounded-md bg-muted/20 p-2 lg:min-h-0"
            >
              {columnIndex !== columns.length - 1 && (
                <div className="absolute right-[-16px] top-4 hidden h-[calc(100%-32px)] w-1 bg-border lg:block" />
              )}

              <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge className={cn("rounded-sm border px-2 py-0.5", column.tone)}>
                      {loading ? (
                        <Skeleton className="h-3 w-4 rounded-sm bg-current/20" />
                      ) : (
                        column.errors.length
                      )}
                      <div className="ml-1">{column.title}</div>
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="min-h-0 space-y-3 lg:-mx-1 lg:flex-1 lg:overflow-y-auto lg:px-1 lg:pb-1 lg:pt-1">
                {loading ? (
                  <OptimizationColumnLoading />
                ) : column.errors.length > 0 ? (
                  column.errors.map((error, index) => (
                    <PerceptionTopErrorCard
                      key={error.id}
                      error={error}
                      index={index}
                      locale={locale}
                      modelLookup={modelLookup}
                      onOpenDetails={() => undefined}
                      showIndex={false}
                      actionGenerated={generatedIds.has(error.id)}
                      actionSaving={savingErrorIds.has(error.id)}
                      onCreateAction={() => void onCreateAction(error)}
                    />
                  ))
                ) : (
                  <EmptyStateCard label="Aucune erreur à afficher dans cette colonne pour les filtres sélectionnés." className="h-24 bg-background/60" />
                )}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

function OptimizationColumnLoading() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <OptimizationErrorCardSkeleton key={index} />
      ))}
    </>
  );
}

function OptimizationErrorCardSkeleton() {
  return (
    <div className="w-full rounded-md bg-background p-4">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="h-6 w-6 shrink-0 rounded-md" />
          <div className="min-w-0 space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </div>

      <div className="mb-3 space-y-2">
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="mb-3 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Skeleton className="h-6 w-20 rounded-sm" />
          <Skeleton className="h-6 w-24 rounded-sm" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-sm" />
          <Skeleton className="h-7 w-20 rounded-sm" />
        </div>
      </div>
    </div>
  );
}

export function ErrorHubPage({
  apiBaseURL,
  routeSearch,
}: PerceptionOptimizeActionsPageProps) {
  const {
    competitors,
    data,
    error,
    generatedIds,
    handleFix,
    loading,
    modelCatalog,
    persistError,
    savingErrorIds,
  } = useOptimizationErrors(apiBaseURL, routeSearch);

  return (
    <OptimizationErrorsKanban
      competitors={competitors}
      errors={data?.errors ?? []}
      generatedIds={generatedIds}
      loading={loading && !data && !error}
      modelCatalog={modelCatalog}
      onCreateAction={handleFix}
      persistError={persistError || error}
      savingErrorIds={savingErrorIds}
    />
  );
}
