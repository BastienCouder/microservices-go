import { useMemo, useState } from "react";

import { useMonitoringData } from "../shared/use-monitoring-data";

import { filterPromptsByScope } from "../shared/prompt-filters";
import { useMonitoringFilters } from "../shared/use-monitoring-filters";

export type BrandVisibilityMetricMode = "sov" | "mention_rate";

export type BrandVisibilityRow = {
  name: string;
  mentions: number;
  color: string;
  initials: string;
  isCompetitor: boolean;
  percentage: number;
  mentionRate: number;
  sovPercentage: number;
  barLabel: string;
};

export type BrandVisibilityViewModel = {
  metricMode: BrandVisibilityMetricMode;
  setMetricMode: (mode: BrandVisibilityMetricMode) => void;
  periodLabel: string;
  totalScopedPrompts: number;
  rows: BrandVisibilityRow[];
  hasRows: boolean;
};

const BRAND_VISIBILITY_COLORS = {
  primaryBrand: "hsl(var(--chart-brand-primary))",
  competitors: [
    "hsl(var(--chart-series-2))",
    "hsl(var(--chart-series-3))",
    "hsl(var(--chart-series-4))",
    "hsl(var(--chart-series-5))",
    "hsl(var(--chart-series-6))",
    "hsl(var(--chart-series-7))",
  ] as const,
} as const;

function toInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "--";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();

  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

export function useBrandVisibilityViewModel(): BrandVisibilityViewModel {
  const { data: monitoringData } = useMonitoringData();
  const filters = useMonitoringFilters();
  const [metricMode, setMetricMode] = useState<BrandVisibilityMetricMode>("sov");
  const { project, recent_prompts } = monitoringData;

  const filteredPrompts = useMemo(
    () =>
      filterPromptsByScope(recent_prompts, filters, {
        selectedCompetitors: [],
      }),
    [filters, recent_prompts],
  );

  const competitorSelection = useMemo(
    () =>
      filters.selectedCompetitors.length > 0
        ? project.competitors.filter((competitor) =>
            filters.selectedCompetitors.includes(competitor.name),
          )
        : project.competitors,
    [filters.selectedCompetitors, project.competitors],
  );

  const rows = useMemo(() => {
    const projectBrandName = project.name.trim();
    const brands = [
      ...(projectBrandName !== ""
        ? [
            {
              name: projectBrandName,
              mentions: filteredPrompts.filter((prompt) => prompt.mention).length,
              color: BRAND_VISIBILITY_COLORS.primaryBrand,
              initials: toInitials(projectBrandName),
              isCompetitor: false,
            },
          ]
        : []),
      ...competitorSelection
        .filter((competitor) => competitor.name.trim() !== "")
        .map((competitor, index) => ({
          name: competitor.name,
          mentions: filteredPrompts.filter((prompt) =>
            (prompt.competitorsMentioned || []).some(
              (name) => normalizeName(name) === normalizeName(competitor.name),
            ),
          ).length,
          color:
            BRAND_VISIBILITY_COLORS.competitors[
              index % BRAND_VISIBILITY_COLORS.competitors.length
            ] as string,
          initials: competitor.initials || toInitials(competitor.name),
          isCompetitor: true,
        })),
    ];

    const totalMentions = brands.reduce((sum, brand) => sum + brand.mentions, 0);
    const totalScopedPrompts = Math.max(filteredPrompts.length, 1);
    const hasFilteredData = totalMentions > 0;

    return brands
      .map((brand) => {
        const mentionRate = Number(
          ((brand.mentions / totalScopedPrompts) * 100).toFixed(1),
        );
        const sovPercentage = hasFilteredData
          ? Number(((brand.mentions / totalMentions) * 100).toFixed(1))
          : 0;

        return {
          ...brand,
          percentage: metricMode === "mention_rate" ? mentionRate : sovPercentage,
          mentionRate,
          sovPercentage,
          barLabel: brand.initials || toInitials(brand.name),
        };
      })
      .sort((left, right) => right.percentage - left.percentage);
  }, [competitorSelection, filteredPrompts, metricMode, project.name]);

  return {
    metricMode,
    setMetricMode,
    periodLabel: filters.period === "today" ? "24h" : filters.period,
    totalScopedPrompts: filteredPrompts.length,
    rows,
    hasRows: filteredPrompts.length > 0 && rows.length > 0,
  };
}
