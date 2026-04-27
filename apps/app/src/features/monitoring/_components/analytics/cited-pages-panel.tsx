"use client";

import { memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyStateCard } from "../../../../components/shared/empty-state-card";

type TopPageItem = { url: string; value: number };

type CitedPagesPanelProps = {
  topCitedPages: TopPageItem[];
  topCitedTotal: number;
  longTailShare: number;
};

export const CitedPagesPanel = memo(function CitedPagesPanel({ topCitedPages, topCitedTotal, longTailShare }: CitedPagesPanelProps) {
  const content = useI18nScope("monitoring-analytics-panel");
  const barVariants = [
    "from-primary to-primary/90",
    "from-primary/90 to-primary/75",
    "from-primary/80 to-primary/65",
  ] as const;
  const hasData = topCitedPages.length > 0;

  return (
    <Card className="w-full rounded-md">
      <CardHeader className="pb-2">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold">
            <SectionTitle>{content.topCitedPagesTitle}</SectionTitle>
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed md:text-sm">{content.topCitedPagesDescription}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyStateCard label={content.noDataAvailable} className="h-[180px] text-sm" />
        ) : (
          <div className="space-y-3">
          {topCitedPages.map((page, index) => (
            <div key={page.url} className="space-y-1.5">
              <span className="block truncate text-xs font-medium md:text-sm">{page.url}</span>
              <div className="flex items-center gap-3 p-2 rounded-full bg-muted">
                <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-muted ">
                  <div
                    className={cn(
                      "relative h-full rounded-full bg-primary",
                      barVariants[index % barVariants.length],
                    )}
                    style={{ width: `${page.value}%` }}
                  >
                    <div className="absolute inset-0 rounded-full opacity-80" />
                    <div className="absolute inset-x-0 top-0 h-[55%] rounded-full" />
                  </div>
                </div>
                <span className="min-w-10 mr-2 text-right text-xs font-semibold text-muted-foreground">
                  {page.value}%
                </span>
              </div>
            </div>
          ))}
{/* 
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/50 pt-4">
            <div className="rounded-md border p-2">
              <div className="text-xs text-muted-foreground">{content.top3Coverage}</div>
              <div className="text-sm font-semibold md:text-base">{topCitedTotal}%</div>
            </div>
          </div> */}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
