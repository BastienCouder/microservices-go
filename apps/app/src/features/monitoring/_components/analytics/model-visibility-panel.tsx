"use client";

import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { VISIBILITY_ANALYTICS_COLORS } from "@/lib/app-data";
import { MonitoringSectionTitle } from "../shared/monitoring-section-title";
import { FiltersEmptyStateCard } from "../shared/filters-empty-state-card";
import { chartConfig } from "../../_lib/analytics/analytics-utils";

type VisibilityBarDatum = { id: string; label: string; value: number; fill: string };

type VisibilityAnalyticsProps = {
  effectiveVisibilityPeriod: string;
  barData: VisibilityBarDatum[];
  hasCompetitorFilter?: boolean;
  title?: string;
};

const VISIBILITY_TICK_FONT_SIZE = 11;
const VISIBILITY_TICK_LINE_HEIGHT = 14;
const VISIBILITY_TICK_MAX_CHARS = 14;
const VISIBILITY_AXIS_MIN_WIDTH = 96;
const VISIBILITY_AXIS_MAX_WIDTH = 156;

export const VisibilityAnalytics = memo(function VisibilityAnalytics({
  effectiveVisibilityPeriod,
  barData,
  hasCompetitorFilter = false,
  title,
}: VisibilityAnalyticsProps) {
  const content = useI18nScope("monitoring-analytics-panel");
  const hasData = barData.length > 0;
  const maxValue = Math.max(10, ...barData.map((item) => item.value));
  const { chartAreaHeight, yAxisWidth } = getVisibilityChartLayout(barData);
  const totalMentions = Math.max(1, barData.reduce((sum, item) => sum + item.value, 0));

  return (
    <Card className="w-full min-w-0 rounded-md">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base font-semibold sm:text-lg">
              <MonitoringSectionTitle>{title || content.visibilityAnalyticsTitle}</MonitoringSectionTitle>
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
            className="!aspect-auto min-h-0 w-full overflow-x-hidden capitalize"
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
                width={yAxisWidth}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                tick={<VisibilityYAxisTick />}
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
                {barData.map((entry, index) => (
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

function getVisibilityChartLayout(barData: VisibilityBarDatum[]) {
  const wrappedLabels = barData.map((item) => splitVisibilityLabel(item.label));
  const longestLineLength = wrappedLabels.reduce((maxLength, lines) => {
    return Math.max(
      maxLength,
      ...lines.map((line) => line.length),
    );
  }, 0);
  const yAxisWidth = Math.min(
    VISIBILITY_AXIS_MAX_WIDTH,
    Math.max(VISIBILITY_AXIS_MIN_WIDTH, Math.ceil(longestLineLength * 7.2) + 18),
  );
  const contentHeight = wrappedLabels.reduce((sum, lines) => {
    return sum + Math.max(44, lines.length * VISIBILITY_TICK_LINE_HEIGHT + 20);
  }, 0);

  return {
    chartAreaHeight: Math.max(220, contentHeight + 16),
    yAxisWidth,
  };
}

function splitVisibilityLabel(label: string) {
  const normalizedLabel = label.trim().replace(/\s+/g, " ");
  if (!normalizedLabel) return [""];

  const segments = normalizedLabel.split(" ").flatMap((segment) => {
    if (segment.length <= VISIBILITY_TICK_MAX_CHARS || !segment.includes("-")) {
      return [segment];
    }

    return segment.split(/(?<=-)/).filter(Boolean);
  });

  const lines: string[] = [];
  let currentLine = "";

  for (const segment of segments) {
    if (segment.length > VISIBILITY_TICK_MAX_CHARS) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }

      const chunks = segment.match(new RegExp(`.{1,${VISIBILITY_TICK_MAX_CHARS}}`, "g")) ?? [segment];
      lines.push(...chunks);
      continue;
    }

    const nextLine = currentLine ? `${currentLine} ${segment}` : segment;
    if (nextLine.length <= VISIBILITY_TICK_MAX_CHARS) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }
    currentLine = segment;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function VisibilityYAxisTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const lines = splitVisibilityLabel(payload?.value ?? "");
  const firstLineY = y - ((lines.length - 1) * VISIBILITY_TICK_LINE_HEIGHT) / 2;

  return (
    <text
      x={x}
      y={firstLineY}
      fill={VISIBILITY_ANALYTICS_COLORS.axisTick}
      fontSize={VISIBILITY_TICK_FONT_SIZE}
      textAnchor="end"
    >
      {lines.map((line, index) => (
        <tspan key={`${line}-${index}`} x={x} dy={index === 0 ? 0 : VISIBILITY_TICK_LINE_HEIGHT}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

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
