import { useEffect, useState } from "react";
import { ChevronDown, RefreshCw, SlidersHorizontal } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { PeriodFilterPicker } from "@/components/shared/period-filter-picker";
import { SearchFilterInput } from "@/components/shared/search-filter-input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { GA4IntegrationCard } from "./ga4-integration-card";
import { TrafficKpiRow } from "./kpi-row";
import { SourceBreakdown } from "./source-breakdown";
import { TopPagesTable } from "./top-pages-table";
import { TrafficEngineFilter } from "./traffic-engine-filter";
import { TrafficTrend } from "./traffic-trend";
import {
  useTrafficReportPanelViewModel,
} from "../../_lib/report/use-traffic-report-panel-view-model";
import type { TrafficPeriod } from "../../_lib/report/types";

type TrafficReportPanelProps = {
  apiBaseURL: string;
  routeSearch: string;
};

const PERIOD_LABELS: Record<TrafficPeriod, string> = {
  "7d": "7 jours",
  "30d": "30 jours",
  "90d": "90 jours",
};

const PERIOD_OPTIONS = Object.entries(PERIOD_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function TrafficReportPanel({ apiBaseURL, routeSearch }: TrafficReportPanelProps) {
  const vm = useTrafficReportPanelViewModel({ apiBaseURL, routeSearch });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const showReportShell = vm.loading || vm.isConnected || Boolean(vm.error);

  const filtersContent = (
    <>
      <form
        className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          vm.filters.submitSearch();
        }}
      >
        <SearchFilterInput
          value={vm.filters.search}
          onValueChange={vm.filters.setSearch}
          onSubmit={vm.filters.submitSearch}
          placeholder="Rechercher source ou page"
        />
        <Button
          type="submit"
          variant={vm.filters.searchPending ? "default" : "outline"}
          disabled={vm.loading || vm.refreshing}
          className="w-full sm:w-auto"
        >
          Rechercher
        </Button>
      </form>

      <div className="min-w-0">
        <TrafficEngineFilter
          value={vm.filters.engine}
          engines={vm.filters.availableEngines}
          onValueChange={vm.filters.setEngine}
        />
      </div>

      <div className="min-w-0">
        <PeriodFilterPicker
          value={vm.period}
          onValueChange={vm.setPeriod}
          options={PERIOD_OPTIONS}
          label="Période"
          title="Période"
        />
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={vm.refreshing}
        onClick={() => void vm.refresh()}
        className="w-full sm:w-auto xl:justify-self-end"
      >
        <RefreshCw data-icon="inline-start" />
        Actualiser
      </Button>
    </>
  );

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      <PageHeader
        title="Trafic"
        baseline="Visites provenant de moteurs IA lorsque Google Analytics 4 peut identifier la source."
        className="hidden md:block"
      />

      <div className="min-h-0 space-y-4 overflow-visible lg:overflow-y-auto">
        <GA4IntegrationCard
          connected={vm.isConnected}
          authMode={vm.authMode}
          hasOAuthToken={vm.hasOAuthToken}
          propertyId={vm.form.propertyId}
          serviceAccountJSON={vm.form.serviceAccountJSON}
          oauthProperties={vm.oauth.properties}
          selectedOAuthPropertyId={vm.oauth.selectedPropertyId}
          llmSetup={vm.llmSetup}
          oauthPropertiesLoading={vm.oauth.loadingProperties}
          saving={vm.saving}
          loading={vm.loading}
          onPropertyIdChange={vm.form.setPropertyId}
          onServiceAccountJSONChange={vm.form.setServiceAccountJSON}
          onSelectedOAuthPropertyIdChange={vm.oauth.setSelectedPropertyId}
          onStartOAuth={() => void vm.oauth.start()}
          onRefreshOAuthProperties={() => void vm.oauth.refreshProperties()}
          onSelectOAuthProperty={() => void vm.oauth.selectProperty()}
          onConnect={() => void vm.connect()}
          onDisconnect={() => void vm.disconnect()}
        />

        {showReportShell ? (
          <>
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="md:hidden">
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="flex h-11 w-full items-center justify-between rounded-2xl bg-card px-4"
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
                <section className="mt-3 flex flex-col gap-3 rounded-md bg-card p-3 text-card-foreground">
                  {filtersContent}
                </section>
              </CollapsibleContent>
            </Collapsible>

            <section className="hidden gap-3 rounded-md bg-card p-3 text-card-foreground md:grid md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_220px_170px_auto] xl:items-center">
              {filtersContent}
            </section>
          </>
        ) : null}

        {showReportShell ? (
          <>
            <TrafficKpiRow items={vm.kpis} loading={vm.loading} />

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
              <TrafficTrend points={vm.timeseries} loading={vm.loading} errorLabel={vm.error} />
              <SourceBreakdown
                errorLabel={vm.error}
                sources={vm.sources}
                pagination={vm.sourcePagination}
                loading={vm.loading}
              />
            </div>

            <TopPagesTable
              errorLabel={vm.error}
              pages={vm.topPages}
              pagination={vm.topPagesPagination}
              loading={vm.loading}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
