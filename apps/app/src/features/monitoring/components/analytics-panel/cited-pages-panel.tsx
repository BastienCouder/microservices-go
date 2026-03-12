"use client";

import { memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { DashboardSectionTitle } from "../dashboard-section-title";
import { FiltersEmptyStateCard } from "../filters-empty-state-card";

type TopPageItem = { url: string; value: number };

type CitedPagesPanelProps = {
  topCitedPages: TopPageItem[];
  topCitedTotal: number;
  longTailShare: number;
};

export const CitedPagesPanel = memo(function CitedPagesPanel({ topCitedPages, topCitedTotal, longTailShare }: CitedPagesPanelProps) {
  const content = useI18nScope("dashboard-analytics-panel");
  const barVariants = [
    "bg-primary",
    "bg-primary/85",
    "bg-primary/70",
  ] as const;
  const hasData = topCitedPages.length > 0;

  return (
    <Card className="w-full rounded-md">
      <CardHeader className="pb-2">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold">
            <DashboardSectionTitle>{content.topCitedPagesTitle}</DashboardSectionTitle>
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed md:text-sm">{content.topCitedPagesDescription}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <FiltersEmptyStateCard label={content.noDataAvailable} className="h-[180px] text-sm" />
        ) : (
          <div className="space-y-3">
          {topCitedPages.map((page, index) => (
            <div key={page.url} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-xs font-medium md:text-sm">{page.url}</span>
                <span className="text-xs font-semibold text-muted-foreground">{page.value}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    barVariants[index % barVariants.length],
                  )}
                  style={{ width: `${page.value}%` }}
                />
              </div>
            </div>
          ))}

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/50 pt-4">
            <div className="rounded-md border p-2">
              <div className="text-xs text-muted-foreground">{content.top3Coverage}</div>
              <div className="text-sm font-semibold md:text-base">{topCitedTotal}%</div>
            </div>
            <div className="rounded-md border p-2">
              <div className="text-xs text-muted-foreground">{content.longTailPages}</div>
              <div className="text-sm font-semibold md:text-base">{longTailShare}%</div>
            </div>
          </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
