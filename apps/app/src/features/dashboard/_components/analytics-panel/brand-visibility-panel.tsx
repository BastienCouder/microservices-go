"use client";

import { memo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ChartContainer,
    ChartTooltip,
    ChartConfig
} from "@/components/ui/chart";
import { CartesianGrid, XAxis, YAxis, BarChart, Bar, Cell } from "recharts";
import { useDashboardStore } from "@/lib/dashboard-store";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { useShallow } from "zustand/react/shallow";
import { matchesPromptAudienceFilters, promptIsInPeriodWithDateRange } from "./analytics-utils";
import { FiltersEmptyStateCard } from "../filters-panel/filters-empty-state-card";

const BRAND_VISIBILITY_COLORS = {
    primaryBrand: "hsl(186 49% 62%)",
    competitors: [
        "hsl(204 40% 47%)",
        "hsl(221 39% 34%)",
        "hsl(200 63% 68%)",
        "hsl(230 53% 58%)",
        "hsl(213 29% 45%)",
        "hsl(193 34% 56%)",
    ] as const,
    axis: "hsl(var(--muted-foreground))",
    tooltipCursor: "hsl(var(--muted) / 0.2)",
    legendFallback: "hsl(var(--muted))",
} as const;

const chartConfig = {
    brand: { label: "Brand", color: BRAND_VISIBILITY_COLORS.primaryBrand },
    competitor1: { label: "Competitor 1", color: BRAND_VISIBILITY_COLORS.competitors[0] },
    competitor2: { label: "Competitor 2", color: BRAND_VISIBILITY_COLORS.competitors[1] },
    competitor3: { label: "Competitor 3", color: BRAND_VISIBILITY_COLORS.competitors[2] },
} satisfies ChartConfig;

function toInitials(value: string): string {
    const parts = value
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return "--";
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function normalizeWebsite(value: string): string {
    const trimmed = value.trim();
    if (trimmed === "") return "";
    return trimmed.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

export const BrandVisibilityChart = memo(function BrandVisibilityChart({
    useScopedFilters = true,
    periodOverride,
}: {
    useScopedFilters?: boolean;
    periodOverride?: string;
}) {
    const content = useI18nScope("dashboard-analytics-panel");
    const { data: dashboardData } = useDashboardData();
    const { project, recent_prompts } = dashboardData;
    const {
        period,
        selectedModels,
        selectedPersonas,
        selectedCompetitors,
        applyFiltersToGraphs,
        dateRange,
    } = useDashboardStore(
      useShallow((state) => ({
        period: state.period,
        selectedModels: state.selectedModels,
        selectedPersonas: state.selectedPersonas,
        selectedCompetitors: state.selectedCompetitors,
        applyFiltersToGraphs: state.applyFiltersToGraphs,
        dateRange: state.dateRange,
      })),
    );
    const effectivePeriod = periodOverride ?? period;
    const [metricMode, setMetricMode] = useState<"sov" | "mention_rate">("sov");
    const shouldApplyScope = applyFiltersToGraphs && useScopedFilters;
    const toTwoLetters = (value: string) => value.trim().slice(0, 2);
      const truncateWebsite = (value: string, max = 20) =>
        value.length > max ? `${value.slice(0, Math.max(0, max - 1))}…` : value;

    const filteredPrompts = recent_prompts.filter((prompt) => {
        const isInPeriod = promptIsInPeriodWithDateRange(prompt, effectivePeriod, dateRange);
        if (!isInPeriod) return false;
        if (!shouldApplyScope) return true;
        return matchesPromptAudienceFilters(prompt, selectedModels, selectedPersonas, []);
    });

    const competitorSelection = shouldApplyScope && selectedCompetitors.length > 0
        ? project.competitors.filter((competitor) => selectedCompetitors.includes(competitor.name))
        : project.competitors;

    const projectBrandName = project.name.trim();
    const brands = [
        ...(projectBrandName !== ""
          ? [{
              name: projectBrandName,
              mentions: filteredPrompts.filter((prompt) => prompt.mention).length,
              website: normalizeWebsite(project.tagline || ""),
              color: chartConfig.brand.color,
              initials: toInitials(projectBrandName),
              trend: "stable",
              isCompetitor: false,
            }]
          : []),
        ...competitorSelection
        .filter((competitor) => competitor.name.trim() !== "")
        .map((c, i) => ({
            name: c.name,
            mentions: filteredPrompts.filter((prompt) =>
              (prompt.competitorsMentioned || []).some((name) => name.trim().toLowerCase() === c.name.trim().toLowerCase())
            ).length,
            website: c.website,
            color: [
                ...BRAND_VISIBILITY_COLORS.competitors,
            ][i % 6],
            initials: c.initials,
            trend: c.trend,
            isCompetitor: true,
        }))
    ];

    const totalMentions = brands.reduce((acc, brand) => acc + brand.mentions, 0);
    const totalScopedPrompts = Math.max(filteredPrompts.length, 1);
    const hasFilteredData = totalMentions > 0;
    const fallbackSovByBrand = new Map<string, number>([
        ...(projectBrandName !== ""
          ? [[projectBrandName, 100 - project.competitors.reduce((acc, c) => acc + c.sov, 0)] as [string, number]]
          : []),
        ...project.competitors
          .filter((competitor) => competitor.name.trim() !== "")
          .map((competitor): [string, number] => [competitor.name, competitor.sov]),
    ]);
    const fallbackVisibleTotal = brands.reduce(
        (acc, brand) => acc + (fallbackSovByBrand.get(brand.name) ?? 0),
        0
    );

    const brandsWithPercentages = brands.map((brand) => {
        const fallbackSov = fallbackSovByBrand.get(brand.name) ?? 0;
        const mentionRate = Number(((brand.mentions / totalScopedPrompts) * 100).toFixed(1));
        const sovPercentage = hasFilteredData
          ? Number(((brand.mentions / totalMentions) * 100).toFixed(1))
          : Number(((fallbackSov / Math.max(fallbackVisibleTotal, 1)) * 100).toFixed(1));

        return {
            ...brand,
            percentage: metricMode === "mention_rate" ? mentionRate : sovPercentage,
            mentionRate,
            sovPercentage,
        };
    });

    const sortedBrands = brandsWithPercentages.map((brand) => ({
        ...brand,
        barLabel: brand.isCompetitor ? toTwoLetters(brand.name) : brand.name,
    })).sort((a, b) => b.percentage - a.percentage);

    if (sortedBrands.length === 0) {
      return (
        <Card className="col-span-1 rounded-md min-w-0 overflow-hidden xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">{content.brandVisibilityTitle}</CardTitle>
            <CardDescription className="text-xs leading-relaxed">{content.brandVisibilityDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <FiltersEmptyStateCard label={content.noDataAvailable} className="h-[220px] text-sm" />
          </CardContent>
        </Card>
      );
    }

    return (
          <Card className="col-span-1 xl:col-span-2 rounded-md min-w-0 overflow-hidden">
            <CardHeader className="pb-2">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                            {content.brandVisibilityTitle}
                        </CardTitle>
                        <CardDescription className="pr-1 text-xs leading-relaxed">
                            {content.brandVisibilityDescription}
                        </CardDescription>
                    </div>
                    <div className="flex w-full min-w-0 flex-wrap items-center gap-2 md:w-auto md:justify-end">
                        <Tabs
                          value={metricMode}
                          onValueChange={(v) => setMetricMode(v as "sov" | "mention_rate")}
                        >
                          <TabsList className="h-8 w-full max-w-full md:h-7 md:w-auto">
                            <TabsTrigger value="sov" className="px-2 text-[10px] md:text-[10px]">SOV %</TabsTrigger>
                            <TabsTrigger value="mention_rate" className="px-2 text-[10px] md:text-[10px]">
                              Mention rate %
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                        <Badge
                          variant="secondary"
                          className="h-8 shrink-0 font-normal text-xs uppercase bg-muted/50 text-muted-foreground md:h-7"
                        >
                            {effectivePeriod === 'today' ? '24h' : effectivePeriod}
                        </Badge>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                <div className="grid min-w-0 grid-cols-1 xl:grid-cols-14">
                    {/* Chart Section - Takes full width on mobile, flexible on desktop */}
                    <div className="min-w-0 border-b border-border/50 p-3 xl:col-span-7 xl:border-b-0 xl:border-r">
                        <ChartContainer config={chartConfig} className="h-[170px] w-full xl:h-[240px]">
                            <BarChart data={sortedBrands} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
                                <XAxis
                                    dataKey="barLabel"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={10}
                                    fontSize={12}
                                    stroke={BRAND_VISIBILITY_COLORS.axis}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value}%`}
                                    fontSize={12}
                                    stroke={BRAND_VISIBILITY_COLORS.axis}
                                />
                                <ChartTooltip
                                  cursor={{ fill: BRAND_VISIBILITY_COLORS.tooltipCursor }}
                                  content={<BrandVisibilityTooltip metricMode={metricMode} totalScopedPrompts={totalScopedPrompts} />}
                                />
                                <Bar dataKey="percentage" radius={[4, 4, 0, 0]} maxBarSize={60}>
                                    {sortedBrands.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ChartContainer>
                    </div>

                    {/* List Section - Stacks below on mobile, side on desktop */}
                    <div className="min-w-0 border-t bg-muted/5 px-4 xl:col-span-7 xl:flex xl:flex-col xl:border-t-0">
                        <div className="flex items-center justify-between border-b border-border/50 p-4">
                            <div>
                                <h4 className="text-sm font-semibold">{content.topBrands}</h4>
                                <p className="text-xs text-muted-foreground">{content.byVisibility}</p>
                            </div>
                        </div>

                        <ScrollArea className="h-[170px] pr-4 xl:h-[190px] [&_[data-slot=scroll-area-scrollbar]]:w-2.5 [&_[data-slot=scroll-area-scrollbar]]:bg-muted/35 [&_[data-slot=scroll-area-thumb]]:rounded-full [&_[data-slot=scroll-area-thumb]]:border [&_[data-slot=scroll-area-thumb]]:border-background/60 [&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/55">
                            <div className="flex flex-col">
                                {sortedBrands.map((brand, i) => (
                                    <div key={i} className="flex items-center gap-2 border-b border-border/40 p-2.5 transition-colors hover:bg-muted/10 last:border-0">
                                        <div className="flex-shrink-0">
                                            <div
                                                className="w-2.5 h-2.5 rounded-full"
                                                style={{ backgroundColor: brand.color || BRAND_VISIBILITY_COLORS.legendFallback }}
                                            />
                                        </div>

                                        <div className="flex-shrink-0">
                                            <div className="w-8 h-8 rounded-md bg-background border border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                                {brand.initials}
                                            </div>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline mb-0.5">
                                                <span className="font-semibold text-sm truncate block">{brand.name}</span>
                                                <span className="font-bold text-xs tabular-nums">{brand.percentage}%</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                             <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
                                                    {truncateWebsite(brand.website || "", 22)}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground tabular-nums">
                                                  {brand.mentions} {content.mentions}
                                                  {metricMode === "mention_rate" ? ` • ${brand.sovPercentage}% SOV` : ""}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
});

function BrandVisibilityTooltip({
  active,
  payload,
  metricMode,
  totalScopedPrompts,
}: {
  active?: boolean;
  payload?: Array<{
    value?: number;
    payload?: {
      name?: string;
      mentions?: number;
      mentionRate?: number;
      sovPercentage?: number;
      color?: string;
    };
    color?: string;
  }>;
  metricMode: "sov" | "mention_rate";
  totalScopedPrompts: number;
}) {
  const item = payload?.[0];
  const row = item?.payload;
  if (!active || !item || !row) return null;

  const displayValue = typeof item.value === "number" ? item.value : 0;
  const mentions = row.mentions ?? 0;
  const mentionRate = row.mentionRate ?? 0;
  const sov = row.sovPercentage ?? 0;
  const color = item.color ?? row.color ?? BRAND_VISIBILITY_COLORS.legendFallback;

  return (
    <div className="min-w-[210px] rounded-md border border-border/60 bg-background/95 p-3 shadow-sm backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-medium">{row.name}</span>
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Mentions</span>
          <span className="font-mono tabular-nums">{mentions} / {Math.max(totalScopedPrompts, 0)}</span>
        </div>
        <TooltipMetricBar label="Mention rate" value={mentionRate} color={color} />
        <TooltipMetricBar label="SOV" value={sov} color={color} />
      </div>
    </div>
  );
}

function TooltipMetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{safe.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
        <div className="h-full rounded-full" style={{ width: `${safe}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
