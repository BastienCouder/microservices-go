"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { APP_CHART_UI_COLORS, PERCEPTION_TEXT, PERCEPTION_TREND_COLORS } from "@/lib/app-data";
import { DashboardSectionTitle } from "@/features/monitoring/components/dashboard-section-title";

type TrendPoint = {
  label: string;
  positioning: number;
  factual: number;
  sentiment: number;
};

export function PerceptionTrendChart({
  data,
  periodLabel,
}: {
  data: TrendPoint[];
  periodLabel: string;
}) {
  const chartConfig = {
    positioning: { label: PERCEPTION_TEXT.trend.series.positioning, color: PERCEPTION_TREND_COLORS.positioning },
    factual: { label: PERCEPTION_TEXT.trend.series.factual, color: PERCEPTION_TREND_COLORS.factual },
    sentiment: { label: PERCEPTION_TEXT.trend.series.sentiment, color: PERCEPTION_TREND_COLORS.sentiment },
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          <DashboardSectionTitle>{PERCEPTION_TEXT.trend.title}</DashboardSectionTitle>
        </CardTitle>
        <CardDescription>
          {PERCEPTION_TEXT.trend.descriptionPrefix} {periodLabel} {PERCEPTION_TEXT.trend.descriptionSuffix}
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="h-[230px] w-full">
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
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <TrendDefinitionCard
            color={PERCEPTION_TREND_COLORS.positioning}
            title={PERCEPTION_TEXT.trend.series.positioning}
            description={PERCEPTION_TEXT.trend.definitions.positioning}
          />
          <TrendDefinitionCard
            color={PERCEPTION_TREND_COLORS.factual}
            title={PERCEPTION_TEXT.trend.series.factual}
            description={PERCEPTION_TEXT.trend.definitions.factual}
          />
          <TrendDefinitionCard
            color={PERCEPTION_TREND_COLORS.sentiment}
            title={PERCEPTION_TEXT.trend.series.sentiment}
            description={PERCEPTION_TEXT.trend.definitions.sentiment}
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
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[340px] max-w-[370px] rounded-xl border border-border/60 bg-background/96 p-2.5 shadow-[0_14px_36px_-20px_rgba(15,23,42,0.35)] backdrop-blur-md">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Point de mesure
        </div>
        <div className="rounded-full border border-border/60 bg-muted/25 px-2 py-0.5 text-[11px] font-medium text-foreground">
          {label}
        </div>
      </div>
      <div className="space-y-2">
        {payload.map((item) => {
          const value = typeof item.value === "number" ? item.value : 0;
          const color = item.color ?? APP_CHART_UI_COLORS.primary ?? "hsl(var(--primary))";
          const barValue = Math.max(0, Math.min(100, value));
          const metric = getTrendTooltipMetric(item.name);
          return (
            <div key={item.name} className="rounded-lg border border-border/50 bg-muted/15 p-2">
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
                  {scoreToTrendLabel(value)}
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
    <div className="rounded-lg border border-border/60 bg-muted/15 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-foreground">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        {title}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function getTrendTooltipMetric(key?: string) {
  if (key === "positioning") {
    return {
      label: PERCEPTION_TEXT.trend.series.positioning,
      description: PERCEPTION_TEXT.trend.definitions.positioning,
    };
  }
  if (key === "factual") {
    return {
      label: PERCEPTION_TEXT.trend.series.factual,
      description: PERCEPTION_TEXT.trend.definitions.factual,
    };
  }
  return {
    label: PERCEPTION_TEXT.trend.series.sentiment,
    description: PERCEPTION_TEXT.trend.definitions.sentiment,
  };
}

function scoreToTrendLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Très bien";
  if (score >= 65) return "Bien";
  if (score >= 50) return "Fragile";
  return "Insuffisant";
}
