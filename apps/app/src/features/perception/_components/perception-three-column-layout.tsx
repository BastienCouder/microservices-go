"use client";

import { useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PerceptionThreeColumnLayoutProps = {
  left: ReactNode;
  center: ReactNode;
  right?: ReactNode;
  tabletCenterLabel?: string;
  tabletRightLabel?: string;
};

export function PerceptionThreeColumnLayout({
  left,
  center,
  right,
  tabletCenterLabel = "Analyse",
  tabletRightLabel = "Réponses",
}: PerceptionThreeColumnLayoutProps) {
  const [tabletView, setTabletView] = useState<"center" | "right">("center");
  const leftClassName = right
    ? "col-span-12 rounded-xl bg-background p-2 md:col-span-4 lg:col-span-4 lg:row-span-2 lg:h-full lg:overflow-hidden xl:col-span-3 xl:col-start-1 xl:row-span-1"
    : "col-span-12 rounded-xl bg-background p-2 md:col-span-5 xl:col-span-4 xl:h-full xl:overflow-hidden";
  const centerClassName = right
    ? "col-span-12 border-b md:col-span-8 lg:hidden xl:col-span-6 xl:col-start-4 xl:block xl:h-full xl:overflow-hidden xl:border-b-0"
    : "col-span-12 md:col-span-7 xl:col-span-8 xl:h-full xl:overflow-hidden";

  return (
    <div className="flex h-auto min-h-full flex-col gap-4 px-3 pb-6 pt-3 md:px-4 lg:m-4 lg:h-full lg:min-h-0 lg:gap-3 lg:px-0 lg:pb-0 lg:pt-0 xl:overflow-hidden">
      <div className="m-0 grid h-auto min-h-full grid-cols-12 gap-4 lg:h-full lg:min-h-0 lg:grid-rows-[minmax(0,3fr)_minmax(0,1fr)] xl:grid-rows-1">
        <div className={leftClassName}>{left}</div>

        <div className={centerClassName}>
          <div className="h-auto xl:h-full xl:overflow-y-auto">{center}</div>
        </div>

        {right ? (
          <div className="col-span-12 h-auto lg:hidden xl:col-span-3 xl:col-start-10 xl:block xl:h-full xl:overflow-hidden">
            <div className="h-auto xl:h-full xl:overflow-y-auto">{right}</div>
          </div>
        ) : null}

        {right ? (
          <div className="col-span-12 hidden lg:col-span-8 lg:row-span-2 lg:flex lg:min-h-0 lg:flex-col xl:hidden">
            <Tabs
              value={tabletView}
              onValueChange={(value) => setTabletView(value as "center" | "right")}
              className="flex min-h-0 flex-1 flex-col gap-3"
            >
              <div className="w-full rounded-md bg-background p-2">
                <TabsList className="h-10 w-full">
                  <TabsTrigger value="center" className="px-3">
                    {tabletCenterLabel}
                  </TabsTrigger>
                  <TabsTrigger value="right" className="px-3">
                    {tabletRightLabel}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="center" className="min-h-0 overflow-hidden">
                {center}
              </TabsContent>

              <TabsContent value="right" className="min-h-0 overflow-hidden">
                {right}
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </div>
    </div>
  );
}
