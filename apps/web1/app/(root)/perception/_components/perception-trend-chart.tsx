"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { APP_CHART_UI_COLORS, PERCEPTION_TEXT, PERCEPTION_TREND_COLORS } from "@/lib/app-data";

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
        <CardTitle className="text-base">{PERCEPTION_TEXT.trend.title}</CardTitle>
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
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-2 py-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PERCEPTION_TREND_COLORS.positioning }} />
            {PERCEPTION_TEXT.trend.series.positioning}
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-2 py-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PERCEPTION_TREND_COLORS.factual }} />
            {PERCEPTION_TEXT.trend.series.factual}
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-2 py-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PERCEPTION_TREND_COLORS.sentiment }} />
            {PERCEPTION_TEXT.trend.series.sentiment}
          </div>
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
    <div className="min-w-[190px] rounded-md border border-border/60 bg-background/95 p-3 shadow-sm backdrop-blur-sm">
      <div className="mb-2 text-xs font-medium">{label}</div>
      <div className="space-y-2">
        {payload.map((item) => {
          const value = typeof item.value === "number" ? item.value : 0;
          const color = item.color ?? APP_CHART_UI_COLORS.primary ?? "hsl(var(--primary))";
          const barValue = Math.max(0, Math.min(100, value));
          return (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="truncate">{item.name}</span>
                </div>
                <span className="font-mono tabular-nums text-foreground">{value.toFixed(0)}/100</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
                <div className="h-full rounded-full" style={{ width: `${barValue}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
