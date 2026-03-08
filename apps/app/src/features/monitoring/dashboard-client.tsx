import { memo, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DashboardDataProvider } from "@/hooks/use-dashboard-data";
import { DashboardStoreProvider, useDashboardStore } from "@/lib/dashboard-store";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { shallow } from "zustand/shallow";
import { DashboardSectionTitle } from "./_components/dashboard-section-title";
import { FiltersPanel } from "./_components/filters-panel/filters-panel";
import { AnalyticsPanel } from "./_components/analytics-panel/analytics-panel";
import { ActivityPanel } from "./_components/activity-panel/activity-panel";

type DashboardClientProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function DashboardClient({ apiBaseURL, routeSearch }: DashboardClientProps) {
  return (
    <DashboardStoreProvider>
      <DashboardDataProvider apiBaseURL={apiBaseURL} routeSearch={routeSearch}>
        <DashboardLayout />
      </DashboardDataProvider>
    </DashboardStoreProvider>
  );
}

const DashboardLayout = memo(function DashboardLayout() {
  return (
    <div className="flex h-auto min-h-full flex-col gap-4 px-3 pb-6 pt-3 md:px-4 lg:m-4 lg:h-full lg:min-h-0 lg:gap-3 lg:px-0 lg:pb-0 lg:pt-0">
      <MobileFiltersBar />
      <div className="m-0 grid h-auto min-h-full grid-cols-12 gap-4 lg:h-full lg:min-h-0 lg:grid-rows-[minmax(0,3fr)_minmax(0,1fr)] xl:grid-rows-1">
        <div className="hidden h-auto overflow-visible rounded-md bg-background p-2 lg:col-span-4 lg:row-start-1 lg:block lg:h-full lg:overflow-hidden xl:col-span-3">
          <FiltersPanel />
        </div>

        <div className="order-1 col-span-12 h-auto overflow-visible lg:col-span-8 lg:row-start-1 lg:h-full lg:overflow-hidden xl:col-span-6">
          <AnalyticsPanel />
        </div>

        <div className="order-2 col-span-12 h-auto overflow-visible lg:col-span-12 lg:row-start-2 lg:h-full lg:overflow-hidden xl:col-span-3 xl:row-start-1 xl:h-full xl:overflow-hidden">
          <ActivityPanel />
        </div>
      </div>
    </div>
  );
});

const MobileFiltersBar = memo(function MobileFiltersBar() {
  const [open, setOpen] = useState(false);
  const content = useI18nScope("dashboard-filters-panel");
  const {
    period,
    dateRange,
    selectedModels,
    selectedPersonas,
    selectedCompetitors,
    showUniqueModelFilters,
  } = useDashboardStore(
    (state) => ({
      period: state.period,
      dateRange: state.dateRange,
      selectedModels: state.selectedModels,
      selectedPersonas: state.selectedPersonas,
      selectedCompetitors: state.selectedCompetitors,
      showUniqueModelFilters: state.showUniqueModelFilters,
    }),
    shallow,
  );

  const activeFilterCount = useMemo(() => {
    let count = selectedModels.length + selectedPersonas.length + selectedCompetitors.length;
    if (period !== "7d" || dateRange !== undefined) count += 1;
    if (showUniqueModelFilters) count += 1;
    return count;
  }, [
    period,
    dateRange,
    selectedModels.length,
    selectedPersonas.length,
    selectedCompetitors.length,
    showUniqueModelFilters,
  ]);

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="flex h-11 w-full items-center justify-between rounded-2xl border-border/60 bg-background px-4 text-sm font-medium"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              {content.filters}
            </span>
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
        </SheetTrigger>

        <SheetContent
          side="bottom"
          className="h-[85dvh] rounded-t-[28px] border-t border-border/60 p-0"
        >
          <SheetHeader className="border-b border-border/60 bg-background px-4 py-4">
            <SheetTitle>
              <DashboardSectionTitle>{content.filters}</DashboardSectionTitle>
            </SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden px-2 pb-4 pt-2">
            <FiltersPanel />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
});
