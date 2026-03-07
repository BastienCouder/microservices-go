"use client";

import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { VISIBILITY_ANALYTICS_COLORS } from "@/lib/app-data";
import { DashboardSectionTitle } from "../dashboard-section-title";
import { chartConfig } from "./analytics-utils";
import { FiltersEmptyStateCard } from "../filters-empty-state-card";

type VisibilityAnalyticsProps = {
  effectiveVisibilityPeriod: string;
  barData: Array<{ id: string; label: string; value: number; fill: string }>;
  hasCompetitorFilter?: boolean;
  title?: string;
};

export const VisibilityAnalytics = memo(function VisibilityAnalytics({
  effectiveVisibilityPeriod,
  barData,
  hasCompetitorFilter = false,
  title,
}: VisibilityAnalyticsProps) {
  const content = useI18nScope("dashboard-analytics-panel");
  const hasData = barData.length > 0;
  const maxValue = Math.max(10, ...barData.map((item) => item.value));
  const extraRows = Math.max(0, barData.length - 5);
  const chartAreaHeight = 220 + extraRows * 74;
  const totalMentions = Math.max(1, barData.reduce((sum, item) => sum + item.value, 0));

  return (
    <Card className="w-full min-w-0 rounded-md">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base font-semibold sm:text-lg">
              <DashboardSectionTitle>{title || content.visibilityAnalyticsTitle}</DashboardSectionTitle>
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed md:text-sm">
              Nombre de reponses IA ou votre marque est mentionnee.
              {hasCompetitorFilter
                ? " Avec un filtre concurrent, on compte seulement les co-mentions (votre marque + concurrent selectionne)."
                : ""}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="w-fit shrink-0 bg-muted/50 text-xs font-normal uppercase text-muted-foreground md:text-sm">
            {effectiveVisibilityPeriod === "today" ? "24h" : effectiveVisibilityPeriod}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="min-w-0">
        {!hasData ? (
          <FiltersEmptyStateCard label={content.noDataAvailable} className="h-[220px] text-sm" />
        ) : (
          <div className="flex min-w-0 flex-col">
          <ChartContainer
            config={chartConfig}
            className="!aspect-auto min-h-0 w-full overflow-x-hidden"
            style={{ height: `${chartAreaHeight}px`, minHeight: `${chartAreaHeight}px` }}
          >
            <BarChart
              data={barData}
              layout="vertical"
              height={chartAreaHeight}
              margin={{ top: 8, right: 26, bottom: 0, left: 4 }}
              barCategoryGap={10}
            >
              <XAxis
                type="number"
                domain={[0, Math.ceil(maxValue * 1.15)]}
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                fontSize={11}
                tick={{ fill: VISIBILITY_ANALYTICS_COLORS.axisTick }}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={70}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
                tick={{ fill: VISIBILITY_ANALYTICS_COLORS.axisTick }}
              />
              <ChartTooltip
                cursor={{ fill: VISIBILITY_ANALYTICS_COLORS.tooltipCursor }}
                content={
                  <VisibilityAnalyticsTooltip
                    totalMentions={totalMentions}
                  />
                }
              />
              <Bar
                dataKey="value"
                radius={[0, 5, 5, 0]}
                isAnimationActive
                fill={VISIBILITY_ANALYTICS_COLORS.fallbackBar}
              >
                {barData.map((entry) => (
                  <Cell key={entry.id} fill={entry.fill} />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(value) => `${value ?? 0}`}
                  className="fill-foreground text-xs font-medium"
                />
              </Bar>
            </BarChart>
          </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

function VisibilityAnalyticsTooltip({
  active,
  payload,
  totalMentions,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: { label?: string; fill?: string } }>;
  totalMentions: number;
}) {
  const item = payload?.[0];
  const value = typeof item?.value === "number" ? item.value : 0;
  const label = item?.payload?.label ?? "Modele";
  const color = item?.payload?.fill ?? VISIBILITY_ANALYTICS_COLORS.fallbackBar;
  if (!active || !item) return null;

  const share = Math.round((value / Math.max(totalMentions, 1)) * 100);

  return (
    <div className="min-w-[180px] rounded-md border border-border/60 bg-background/95 p-3 shadow-sm backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-medium md:text-sm">{label}</span>
      </div>
      <div className="mb-1 flex items-center justify-between gap-4 text-xs">
        <span className="text-muted-foreground">% dans les resultats affiches</span>
        <span className="font-mono text-sm font-semibold tabular-nums md:text-base">{share}%</span>
      </div>
      <div className="space-y-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
          <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}
