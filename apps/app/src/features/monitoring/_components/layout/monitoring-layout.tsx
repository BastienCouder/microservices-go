"use client";

import { memo } from "react";

import { useIsMobile } from "@/shared/hooks/use-mobile";

import { ActivityPanel } from "../activity/activity-panel";
import { AnalyticsPanel } from "../analytics/analytics-panel";
import { FiltersPanel } from "../filters/filters-panel";
import { MobileFiltersBar } from "./mobile-filters-bar";
import { MobileMonitoringShell } from "./mobile-monitoring-shell";

export const MonitoringLayout = memo(function MonitoringLayout() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileMonitoringShell />;
  }

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
