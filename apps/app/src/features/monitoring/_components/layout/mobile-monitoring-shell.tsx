"use client";

import { useMemo, useState } from "react";
import { BellRing, RotateCcw, Waves } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMonitoringData } from "@/hooks/use-monitoring-data";
import { cn } from "@/lib/utils";
import { useActivityPanelViewModel } from "../../_lib/activity/use-activity-panel-view-model";
import { useAnalyticsPanelViewModel } from "../../_lib/analytics/use-analytics-panel-view-model";
import { useFiltersPanelViewModel } from "../../_lib/filters/use-filters-panel-view-model";
import { useMonitoringFilters } from "../../_lib/shared/use-monitoring-filters";
import { getMonitoringPeriodLabel } from "../../_lib/shared/monitoring-periods";
import { ActivityAlerts } from "../activity/activity-alerts";
import { ActivityDetailSheets } from "../activity/activity-detail-sheets";
import { ActivityPromptsStream } from "../activity/activity-prompts-stream";
import { AutomaticInsights } from "../analytics/automatic-insights";
import { BrandVisibilityPanel } from "../analytics/brand-visibility-panel";
import { CitedPagesPanel } from "../analytics/cited-pages-panel";
import { MobileKpiCarousel } from "../analytics/mobile-kpi-carousel";
import { SentimentDistribution } from "../analytics/sentiment-distribution";
import { VisibilityAnalytics } from "../analytics/model-visibility-panel";
import { MonitoringSectionTitle } from "../shared/monitoring-section-title";
import { MobileMonitoringFiltersSheet } from "../filters/mobile-monitoring-filters-sheet";
import { MobileCustomRangePanel } from "./mobile-custom-range-panel";
import { MobileMonitoringPeriodCarousel } from "./mobile-monitoring-period-carousel";
import { MobileMonitoringTopNav } from "./mobile-monitoring-top-nav";

export function MobileMonitoringShell() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { data: monitoringData, loading } = useMonitoringData();
  const filters = useMonitoringFilters();
  const filtersViewModel = useFiltersPanelViewModel();
  const analyticsViewModel = useAnalyticsPanelViewModel();
  const activityViewModel = useActivityPanelViewModel();
  const activeFilterCount = useMemo(() => (
    filters.selectedCompetitors.length +
    filtersViewModel.selectedModels.length +
    Number(filters.period !== "7d" || filters.dateRange !== undefined) +
    Number(filters.showUniqueModelFilters)
  ), [
    filters.dateRange,
    filters.period,
    filters.selectedCompetitors.length,
    filters.showUniqueModelFilters,
    filtersViewModel.selectedModels.length,
  ]);

  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];

    if (filtersViewModel.selectedModels.length > 0) {
      labels.push(`${filtersViewModel.selectedModels.length} modèle${filtersViewModel.selectedModels.length > 1 ? "s" : ""}`);
    }
    if (filters.selectedCompetitors.length > 0) {
      labels.push(`${filters.selectedCompetitors.length} concurrent${filters.selectedCompetitors.length > 1 ? "s" : ""}`);
    }
    if (filters.showUniqueModelFilters) {
      labels.push("vue par IA");
    }

    return labels;
  }, [filters.selectedCompetitors.length, filters.showUniqueModelFilters, filtersViewModel.selectedModels.length]);

  const handlePeriodChange = (nextPeriod: string) => {
    filtersViewModel.setPeriod(nextPeriod);
    if (nextPeriod !== "custom") filtersViewModel.setDateRange(undefined);
  };

  if (loading) {
    return <MobileMonitoringShellSkeleton />;
  }

  return (
    <>
      <MobileMonitoringTopNav
        projectName={monitoringData.project.name}
        periodLabel={getMonitoringPeriodLabel(filters.period)}
        activeFilterCount={activeFilterCount}
        onOpenFilters={() => setFiltersOpen(true)}
      />

      <div className="min-h-full bg-[linear-gradient(180deg,#f5f2ea_0%,#f8fafc_42%,#f8fafc_100%)] px-3 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(5.75rem+env(safe-area-inset-top))] md:hidden">
        <div className="mx-auto max-w-md space-y-4">
          <section className="overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(241,245,249,0.94))] p-5 shadow-[0_28px_60px_-42px_rgba(15,23,42,0.45)]">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                <Waves className="h-3.5 w-3.5 text-primary" />
                Monitoring mobile
              </div>
              <h1 className="mt-4 text-[2rem] font-semibold tracking-tight text-slate-950">
                {monitoringData.project.name || "Votre monitoring"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {monitoringData.project.tagline || "Gardez une lecture claire de votre visibilité IA, même en déplacement."}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <SummaryCard label="Réponses" value={activityViewModel.filteredPrompts.length} />
              <SummaryCard label="Alertes" value={activityViewModel.filteredAlerts.length} tone="warm" />
              <SummaryCard label="Filtres" value={activeFilterCount} tone="dark" />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full bg-white/80 px-3 py-1 text-xs text-slate-700">
                  Période {getMonitoringPeriodLabel(filters.period)}
                </Badge>
                {activeFilterLabels.length === 0 ? (
                  <Badge variant="secondary" className="rounded-full bg-slate-950 px-3 py-1 text-xs text-white">
                    Aucun filtre avancé
                  </Badge>
                ) : (
                  activeFilterLabels.slice(0, 2).map((label) => (
                    <Badge
                      key={label}
                      variant="secondary"
                      className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"
                    >
                      {label}
                    </Badge>
                  ))
                )}
              </div>

              {filtersViewModel.showResetFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 rounded-full px-3 text-xs text-slate-600"
                  onClick={filtersViewModel.onResetFilters}
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Reset
                </Button>
              ) : null}
            </div>
          </section>

          <section className="space-y-3 rounded-[30px] border border-white/70 bg-white/92 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Période d’analyse</p>
                <p className="text-xs text-slate-500">Glissez horizontalement pour changer de fenêtre.</p>
              </div>
              <div className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {getMonitoringPeriodLabel(filters.period)}
              </div>
            </div>

            <MobileMonitoringPeriodCarousel value={filters.period} onValueChange={handlePeriodChange} />
          </section>

          {filters.period === "custom" ? (
            <MobileCustomRangePanel value={filtersViewModel.dateRange} onChange={filtersViewModel.setDateRange} />
          ) : null}

          <section className="space-y-3">
            <MobileKpiCarousel {...analyticsViewModel.kpis} />
          </section>

          <section className="space-y-4">
            <VisibilityAnalytics {...analyticsViewModel.visibilityAnalytics} />
            <BrandVisibilityPanel />
            <SentimentDistribution {...analyticsViewModel.sentiment} />
            <CitedPagesPanel {...analyticsViewModel.citedPages} />
            <AutomaticInsights autoInsights={analyticsViewModel.autoInsights} />
          </section>

          <section className="space-y-4">
            <SectionTitle
              eyebrow="Activité"
              title="Signaux récents"
              description="Alertes critiques et derniers prompts restent accessibles sans quitter le monitoring."
              trailing={activityViewModel.filteredAlerts.length + activityViewModel.filteredPrompts.length}
            />
            <ActivityAlerts filteredAlerts={activityViewModel.filteredAlerts} previewCount={2} onSelectAlert={activityViewModel.selectAlert} />
            <ActivityPromptsStream filteredPrompts={activityViewModel.filteredPrompts} previewCount={4} onSelectPrompt={activityViewModel.selectPrompt} />
          </section>
        </div>
      </div>

      <MobileMonitoringFiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        showResetFilters={filtersViewModel.showResetFilters}
        onResetFilters={filtersViewModel.onResetFilters}
        personaOptions={filtersViewModel.personaOptions}
        selectedPersonas={filtersViewModel.selectedPersonas}
        togglePersona={filtersViewModel.togglePersona}
        models={filtersViewModel.models}
        selectedModels={filtersViewModel.selectedModels}
        toggleModel={filtersViewModel.toggleModel}
        selectedCompetitors={filtersViewModel.selectedCompetitors}
        toggleCompetitor={filtersViewModel.toggleCompetitor}
        project={filtersViewModel.project}
        showUniqueModelFilters={filtersViewModel.showUniqueModelFilters}
        onModelFilterModeChange={filtersViewModel.onModelFilterModeChange}
      />

      <ActivityDetailSheets
        selectedAlert={activityViewModel.selectedAlert}
        closeAlert={activityViewModel.closeAlert}
        selectedPrompt={activityViewModel.selectedPrompt}
        closePrompt={activityViewModel.closePrompt}
      />
    </>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "warm" | "dark";
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border px-3 py-3",
        tone === "warm" && "border-amber-200/70 bg-amber-50",
        tone === "dark" && "border-slate-900 bg-slate-950 text-white",
        tone === "default" && "border-slate-200/80 bg-white/80",
      )}
    >
      <div className={cn("text-[11px] uppercase tracking-[0.12em]", tone === "dark" ? "text-white/65" : "text-slate-500")}>
        {label}
      </div>
      <div className={cn("mt-1 text-2xl font-semibold tracking-tight", tone === "dark" ? "text-white" : "text-slate-950")}>
        {value}
      </div>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
  trailing,
}: {
  eyebrow: string;
  title: string;
  description: string;
  trailing?: number;
}) {
  return (
    <div className="px-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            <MonitoringSectionTitle>{title}</MonitoringSectionTitle>
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        {typeof trailing === "number" ? (
          <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {trailing}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MobileMonitoringShellSkeleton() {
  return (
    <div className="min-h-full bg-[linear-gradient(180deg,#f5f2ea_0%,#f8fafc_42%,#f8fafc_100%)] px-3 pb-24 pt-3 md:hidden">
      <div className="mx-auto max-w-md space-y-4">
        <div className="rounded-[32px] border border-white/70 bg-white/95 p-5 shadow-sm">
          <Skeleton className="h-7 w-32 rounded-full" />
          <Skeleton className="mt-4 h-10 w-44 rounded-xl" />
          <Skeleton className="mt-3 h-4 w-full rounded-xl" />
          <Skeleton className="mt-2 h-4 w-3/4 rounded-xl" />
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Skeleton className="h-20 rounded-[24px]" />
            <Skeleton className="h-20 rounded-[24px]" />
            <Skeleton className="h-20 rounded-[24px]" />
          </div>
        </div>

        <div className="rounded-[30px] border border-white/70 bg-white/92 p-4 shadow-sm">
          <Skeleton className="h-5 w-36 rounded-xl" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-14 w-24 rounded-[20px]" />
            <Skeleton className="h-14 w-24 rounded-[20px]" />
            <Skeleton className="h-14 w-24 rounded-[20px]" />
          </div>
        </div>

        <div className="flex gap-3 overflow-hidden">
          <Skeleton className="h-40 w-[280px] rounded-[24px]" />
          <Skeleton className="h-40 w-[280px] rounded-[24px]" />
        </div>

        <div className="rounded-[30px] border border-white/70 bg-white/92 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Skeleton className="h-4 w-20 rounded-xl" />
              <Skeleton className="mt-2 h-6 w-40 rounded-xl" />
              <Skeleton className="mt-2 h-4 w-full rounded-xl" />
            </div>
            <BellRing className="mt-1 h-4 w-4 text-slate-300" />
          </div>
          <Skeleton className="mt-4 h-52 rounded-[24px]" />
          <Skeleton className="mt-4 h-52 rounded-[24px]" />
        </div>
      </div>
    </div>
  );
}
