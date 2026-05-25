"use client";

import { memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { Cell, Pie, PieChart } from "recharts";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { AI_SENTIMENT_COLORS } from "@/lib/app-data";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyStateCard } from "../../../../components/shared/empty-state-card";
import { chartConfig } from "../../_lib/analytics/analytics-utils";

type SentimentItem = { name: string; value: number; fill: string };

type SentimentDistributionProps = {
  sentimentData: SentimentItem[];
  hasData: boolean;
};

export const SentimentDistribution = memo(function SentimentDistribution({
  sentimentData,
  hasData,
}: SentimentDistributionProps) {
  const content = useI18nScope("monitoring-analytics-panel");
  const coloredSentimentData = sentimentData.map((item) => ({
    ...item,
    fill: AI_SENTIMENT_COLORS[item.name as keyof typeof AI_SENTIMENT_COLORS] ?? item.fill,
  }));
  const localizedChartConfig = {
    ...chartConfig,
    positive: { ...chartConfig.positive, label: content.sentimentPositive, color: AI_SENTIMENT_COLORS.positive },
    neutral: { ...chartConfig.neutral, label: content.sentimentNeutral, color: AI_SENTIMENT_COLORS.neutral },
    negative: { ...chartConfig.negative, label: content.sentimentNegative, color: AI_SENTIMENT_COLORS.negative },
  };
  const sentimentLabels = {
    positive: content.sentimentPositive,
    neutral: content.sentimentNeutral,
    negative: content.sentimentNegative,
  } as const;

  return (
    <Card className="w-full rounded-md">
      <CardHeader className="pb-2">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold">
            <SectionTitle>{content.aiSentimentTitle}</SectionTitle>
          </CardTitle>
          <CardDescription className="hidden md:block text-xs leading-relaxed md:text-sm">{content.aiSentimentDescription}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {hasData ? (
            <div className="h-[280px]">
            <ChartContainer config={localizedChartConfig} className="h-full w-full">
              <PieChart>
                <Pie data={coloredSentimentData} dataKey="value" nameKey="name" innerRadius={96} outerRadius={110} strokeWidth={2}>
                  {coloredSentimentData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>

                <Pie
                  data={coloredSentimentData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={0}
                  outerRadius={70}
                  strokeWidth={0}
                  legendType="none"
                  labelLine={false}
                  label={({ cx, cy, midAngle, percent, value }) => {
                    if (
                      typeof cx !== "number" ||
                      typeof cy !== "number" ||
                      typeof midAngle !== "number" ||
                      typeof percent !== "number"
                    ) {
                      return null;
                    }

                    const percentage = Math.round(percent * 100);
                    if (percentage <= 0) return null;

                    const isSmallSlice = percentage < 10;
                    const r = isSmallSlice ? 46 : 34;
                    const rad = (-midAngle * Math.PI) / 180;
                    const x = cx + Math.cos(rad) * r;
                    const y = cy + Math.sin(rad) * r;
                    return (
                      <text
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize={isSmallSlice ? 10 : 12}
                        fontWeight={700}
                      >
                        {typeof value === "number" && isSmallSlice ? `${value}%` : `${percentage}%`}
                      </text>
                    );
                  }}
                >
                  {coloredSentimentData.map((entry) => (
                    <Cell key={`inner-${entry.name}`} fill={entry.fill} opacity={0.88} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            </div>
          ) : (
            <EmptyStateCard label={content.noDataAvailable} className="h-[220px] text-sm" />
          )}

          <div className="grid grid-cols-3 gap-2">
            {coloredSentimentData.map((item) => (
              <div key={item.name} className="rounded-md border p-2">
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="flex-shrink-0">
                      <div
                        className="h-2.5 w-5 rounded-full"
                        style={{ backgroundColor: item.fill || AI_SENTIMENT_COLORS.legendFallback }}
                      />
                    </div>
                    <span>{sentimentLabels[item.name as keyof typeof sentimentLabels]}</span>
                  </div>
                  <div className="text-xs font-semibold">{item.value}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
