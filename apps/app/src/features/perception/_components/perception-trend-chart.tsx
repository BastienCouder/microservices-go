"use client";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Info } from "lucide-react";
import { APP_CHART_UI_COLORS, PERCEPTION_TREND_COLORS } from "@/lib/app-data";
import { SectionTitle } from "@/components/shared/section-title";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { getPerceptionGradeLabel } from "../_lib";

type TrendPoint = {
  label: string;
  positioning: number;
  factual: number;
  sentiment: number;
};

export function PerceptionTrendChart({
  data,
  periodLabel,
  badgeLabel,
  emptyLabel,
}: {
  data: TrendPoint[];
  periodLabel: string;
  badgeLabel: string;
  emptyLabel?: string | null;
}) {
  const { t } = useScopedI18n("perception");
  const chartConfig = {
    positioning: { label: t("trendSeriesPositioning"), color: PERCEPTION_TREND_COLORS.positioning },
    factual: { label: t("trendSeriesFactual"), color: PERCEPTION_TREND_COLORS.factual },
    sentiment: { label: t("trendSeriesSentiment"), color: PERCEPTION_TREND_COLORS.sentiment },
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base">
              <SectionTitle>{t("trendTitle")}</SectionTitle>
            </CardTitle>
            <CardDescription className="hidden md:block">
              {t("trendDescription", { periodLabel })}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="w-fit shrink-0 bg-muted/50 text-xs font-normal uppercase text-muted-foreground md:text-sm">
            {badgeLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="h-[230px] w-full">
          {data.length === 0 ? (
            <EmptyStateCard label={emptyLabel || t("trendEmpty")} className="h-full min-h-0 w-full text-sm" />
          ) : (
            <ChartContainer config={chartConfig} className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    fontSize={11}
                    tick={{ fill: APP_CHART_UI_COLORS.axisTick }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={28}
                    fontSize={11}
                    tick={{ fill: APP_CHART_UI_COLORS.axisTick }}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<PerceptionTrendTooltip />}
                  />
                  <Line
                    type="monotone"
                    dataKey="positioning"
                    stroke={PERCEPTION_TREND_COLORS.positioning}
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="factual"
                    stroke={PERCEPTION_TREND_COLORS.factual}
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sentiment"
                    stroke={PERCEPTION_TREND_COLORS.sentiment}
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <TrendDefinitionCard
            color={PERCEPTION_TREND_COLORS.positioning}
            title={t("trendSeriesPositioning")}
            description={t("trendDefinitionPositioning")}
          />
          <TrendDefinitionCard
            color={PERCEPTION_TREND_COLORS.factual}
            title={t("trendSeriesFactual")}
            description={t("trendDefinitionFactual")}
          />
          <TrendDefinitionCard
            color={PERCEPTION_TREND_COLORS.sentiment}
            title={t("trendSeriesSentiment")}
            description={t("trendDefinitionSentiment")}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function PerceptionTrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ value?: number; name?: string; color?: string }>;
}) {
  const { locale, t } = useScopedI18n("perception");
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[340px] max-w-[370px] rounded-xl border border-border/60 bg-background/96 p-2.5 shadow-[0_14px_36px_-20px_rgba(15,23,42,0.35)] backdrop-blur-md">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {t("trendTooltipMeasurement")}
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/25 px-2 py-0.5 text-[11px] font-medium text-foreground">
          {label}
        </div>
      </div>
      <div className="space-y-2">
        {payload.map((item) => {
          const value = typeof item.value === "number" ? item.value : 0;
          const color = item.color ?? APP_CHART_UI_COLORS.primary ?? "hsl(var(--primary))";
          const barValue = Math.max(0, Math.min(100, value));
          const metric = getTrendTooltipMetric(item.name, t);
          return (
            <div key={item.name} className="rounded-xl border border-border/50 bg-muted/15 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="truncate text-[13px] font-semibold text-foreground">{metric.label}</span>
                  </div>
                </div>
                <div className="flex gap-1 items-center shrink-0 text-right">
                  <div className="text-base font-semibold tabular-nums text-foreground">{value.toFixed(0)}</div>
                  <div className="text-[10px] text-muted-foreground">/100</div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="font-medium" style={{ color }}>
                  {getPerceptionGradeLabel(value, locale)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/50">
                <div className="h-full rounded-full" style={{ width: `${barValue}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendDefinitionCard({
  color,
  title,
  description,
}: {
  color: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-foreground">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={description}
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-72 leading-relaxed">
              {description}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

function getTrendTooltipMetric(key: string | undefined, t: (key: string) => string) {
  if (key === "positioning") {
    return {
      label: t("trendSeriesPositioning"),
      description: t("trendDefinitionPositioning"),
    };
  }
  if (key === "factual") {
    return {
      label: t("trendSeriesFactual"),
      description: t("trendDefinitionFactual"),
    };
  }
  return {
    label: t("trendSeriesSentiment"),
    description: t("trendDefinitionSentiment"),
  };
}
