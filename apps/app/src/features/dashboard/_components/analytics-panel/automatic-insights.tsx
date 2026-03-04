"use client";

import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { FiltersEmptyStateCard } from "../filters-panel/filters-empty-state-card";

type InsightItem = { model: string; text: string; delta: string; level: "high" | "medium" };

type AutomaticInsightsProps = {
  autoInsights: InsightItem[];
};

export const AutomaticInsights = memo(function AutomaticInsights({ autoInsights }: AutomaticInsightsProps) {
  const content = useI18nScope("dashboard-analytics-panel");
  const hasData = autoInsights.length > 0;

  return (
    <Card className="col-span-1 gap-2 rounded-md">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold">{content.autoInsightsTitle}</CardTitle>
          <CardDescription className="text-xs">{content.autoInsightsDescription}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <FiltersEmptyStateCard label={content.noDataAvailable} className="h-[120px] text-sm" />
        ) : (
          <div className="flex flex-col">
          {autoInsights.map((insight, index) => (
            <div
              key={insight.text}
              className={cn("flex items-start justify-between gap-4 py-3", index !== autoInsights.length - 1 && "border-b border-border/50")}
            >
              <div className="min-w-0 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{insight.model}</p>
                <p className="text-xs leading-relaxed text-foreground/90">{insight.text}</p>
              </div>
              <div className="shrink-0">
                <Badge
                  variant="secondary"
                  className={cn(
                    "h-6 px-2 text-[10px] font-semibold",
                    insight.level === "high" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {insight.delta}
                </Badge>
              </div>
            </div>
          ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
