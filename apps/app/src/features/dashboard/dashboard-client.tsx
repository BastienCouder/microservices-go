import { memo } from "react";

import { DashboardDataProvider, useDashboardData } from "@/hooks/use-dashboard-data";
import { DashboardStoreProvider } from "@/lib/dashboard-store";
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
  const { error } = useDashboardData();

  return (
    <div className="flex h-auto min-h-0 flex-col gap-3 md:m-4">
      {error ? (
        <section className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          Dashboard error: {error}
        </section>
      ) : null}
      <div className="m-0 grid h-auto min-h-0 grid-cols-12 gap-0 xl:h-full">
        <div className="col-span-12 h-auto overflow-visible rounded-md bg-background p-2 md:col-span-3 xl:col-span-3 xl:h-full xl:overflow-hidden">
          <FiltersPanel />
        </div>

        <div className="col-span-12 h-auto overflow-visible border-b md:col-span-6 md:px-4 xl:col-span-6 xl:h-full xl:overflow-hidden xl:border-b-0">
          <AnalyticsPanel />
        </div>

        <div className="col-span-12 h-auto overflow-visible xl:col-span-3 xl:h-full xl:overflow-hidden">
          <ActivityPanel />
        </div>
      </div>
    </div>
  );
});
