"use client";

import { memo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { FiltersPanel } from "./_components/filters";
import { AnalyticsPanel } from "./_components/analytics";
import { ActivityPanel } from "./_components/activity";

export const MonitoringLayout = memo(function MonitoringLayout() {
  const [tabletView, setTabletView] = useState<"overview" | "activity">("overview");

  return (
    <div className="flex h-auto min-h-full flex-col gap-4 px-3 pb-6 pt-3 md:px-4 lg:m-4 lg:h-full lg:min-h-0 lg:gap-3 lg:px-0 lg:pb-0 lg:pt-0">
      <div className="grid h-auto min-h-full grid-cols-12 gap-4 lg:h-full lg:min-h-0 lg:grid-rows-[minmax(0,3fr)_minmax(0,1fr)] xl:grid-rows-1">
        <div className="order-1 col-span-12 h-auto overflow-visible rounded-md bg-background p-2 lg:col-span-4 lg:row-span-2 lg:h-full lg:overflow-hidden xl:order-1 xl:col-span-3 xl:col-start-1 xl:row-span-1">
          <FiltersPanel />
        </div>

        <div className="order-2 col-span-12 h-auto overflow-visible lg:hidden xl:order-2 xl:col-span-6 xl:col-start-4 xl:row-start-1 xl:block xl:h-full xl:overflow-hidden">
          <AnalyticsPanel />
        </div>

        <div className="order-3 col-span-12 h-auto overflow-visible lg:hidden xl:order-3 xl:col-span-3 xl:col-start-10 xl:row-start-1 xl:block xl:h-full xl:overflow-hidden">
          <ActivityPanel />
        </div>

        <div className="order-2 col-span-12 hidden lg:col-span-8 lg:row-span-2 lg:flex lg:min-h-0 lg:flex-col xl:hidden">
          <Tabs
            value={tabletView}
            onValueChange={(value) => setTabletView(value as "overview" | "activity")}
            className="flex min-h-0 flex-1 flex-col gap-3"
          >
            <div className="w-full rounded-md bg-background p-2">
              <TabsList className="h-10 w-full">
                <TabsTrigger value="overview" className="px-3">
                  Analyse
                </TabsTrigger>
                <TabsTrigger value="activity" className="px-3">
                  Alertes et prompts
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="min-h-0 overflow-hidden">
              <AnalyticsPanel />
            </TabsContent>

            <TabsContent value="activity" className="min-h-0 overflow-hidden">
              <ActivityPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
});
