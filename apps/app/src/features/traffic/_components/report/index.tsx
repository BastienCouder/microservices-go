import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { PeriodFilterPicker } from "@/components/shared/period-filter-picker";
import { SearchFilterInput } from "@/components/shared/search-filter-input";
import { Button } from "@/components/ui/button";
import { pushErrorToast } from "@/components/ui/toast-actions";
import { GA4IntegrationCard } from "./ga4-integration-card";
import { TrafficKpiRow } from "./kpi-row";
import { SourceBreakdown } from "./source-breakdown";
import { TopPagesTable } from "./top-pages-table";
import { TrafficEngineFilter } from "./traffic-engine-filter";
import { TrafficTrend } from "./traffic-trend";
import {
  shouldToastTrafficReportError,
  useTrafficReportPanelViewModel,
} from "../../_lib/report/use-traffic-report-panel-view-model";
import type { GeoPeriod } from "../../_lib/report/types";

type TrafficReportPanelProps = {
  apiBaseURL: string;
  routeSearch: string;
};

const PERIOD_LABELS: Record<GeoPeriod, string> = {
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
  const showReportShell = vm.loading || vm.isConnected;

  useEffect(() => {
    if (
      vm.error &&
      shouldToastTrafficReportError({ error: vm.error, isConnected: vm.isConnected })
    ) {
      pushErrorToast(new Error(vm.error), vm.error);
    }
  }, [vm.error, vm.isConnected]);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      <PageHeader
        title="Traffic"
        baseline="Visites provenant de moteurs IA lorsque Google Analytics 4 peut identifier la source."
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

        {!vm.error && showReportShell ? (
          <section className="flex items-center gap-3 rounded-md bg-card p-3 text-card-foreground lg:grid lg:grid-cols-[minmax(280px,1fr)_180px_150px_auto]">
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
              >
                Rechercher
              </Button>
            </form>

            <TrafficEngineFilter
              value={vm.filters.engine}
              engines={vm.filters.availableEngines}
              onValueChange={vm.filters.setEngine}
            />

            <PeriodFilterPicker
              value={vm.period}
              onValueChange={vm.setPeriod}
              options={PERIOD_OPTIONS}
              label="Période"
              title="Période"
              description="Choisis la fenêtre GA4 à analyser."
            />

            <Button
              type="button"
              variant="outline"
              disabled={vm.refreshing}
              onClick={() => void vm.refresh()}
            >
              <RefreshCw data-icon="inline-start" />
              Actualiser
            </Button>
          </section>
        ) : null}

        {!vm.error && showReportShell ? (
          <>
            <TrafficKpiRow items={vm.kpis} loading={vm.loading} />

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
              <TrafficTrend points={vm.timeseries} loading={vm.loading} />
              <SourceBreakdown
                sources={vm.sources}
                pagination={vm.sourcePagination}
                loading={vm.loading}
              />
            </div>

            <TopPagesTable
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
