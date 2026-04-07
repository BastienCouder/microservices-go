import { translateI18nText } from "@/shared/hooks/use-i18n";

import type { MonitoringFiltersSnapshot } from "../shared/use-monitoring-filters";
import {
  filterPromptsByScope,
  getPromptPeriodRange,
  normalizeFilterValue,
} from "../shared/prompt-filters";
import type { MonitoringProject, MonitoringPrompt } from "./types";

type HeroInsightTone = "up" | "stable" | "down";

type HeroInsightBrandRow = {
  name: string;
  mentions: number;
  share: number;
  mentionRate: number;
  isProject: boolean;
};

export type FilterHeroInsight = {
  brandName: string;
  title: string;
  summary: string;
  microCopy: string;
  metricValue: string;
  metricLabel: string;
  momentumLabel: string;
  momentumTone: HeroInsightTone;
  trend: number[];
  periodLabel: string;
};

function getNarrativePeriodLabel(
  period: string,
  dateRange: MonitoringFiltersSnapshot["dateRange"],
  locale: string,
): string {
  if (period === "today") return translateI18nText("monitoring-filters-panel", "narrativePeriodToday", locale);
  if (period === "7d") return translateI18nText("monitoring-filters-panel", "narrativePeriod7d", locale);
  if (period === "14d") return translateI18nText("monitoring-filters-panel", "narrativePeriod14d", locale);
  if (period === "30d") return translateI18nText("monitoring-filters-panel", "narrativePeriod30d", locale);
  if (period === "90d") return translateI18nText("monitoring-filters-panel", "narrativePeriod90d", locale);
  if (period === "180d") return translateI18nText("monitoring-filters-panel", "narrativePeriod180d", locale);
  if (period === "365d") return translateI18nText("monitoring-filters-panel", "narrativePeriod365d", locale);
  if (period === "ytd") return translateI18nText("monitoring-filters-panel", "narrativePeriodYtd", locale);
  if (period === "custom" && dateRange?.from) {
    return translateI18nText("monitoring-filters-panel", "narrativePeriodCustom", locale);
  }

  return translateI18nText("monitoring-filters-panel", "narrativePeriodActive", locale);
}

function getLeaderNarrative(
  leader: HeroInsightBrandRow,
  periodLabel: string,
  shareGap: number,
  locale: string,
): string {
  const key =
    shareGap >= 18
      ? "leaderNarrativeDominates"
      : shareGap >= 8
        ? "leaderNarrativeLeads"
        : shareGap >= 3
          ? "leaderNarrativeTakesLead"
          : "leaderNarrativeSlightEdge";

  return translateI18nText("monitoring-filters-panel", key, locale, {
    leader: leader.name,
    periodLabel,
  });
}

function countBrandMentions(
  prompts: MonitoringPrompt[],
  brandName: string,
  isProject: boolean,
): number {
  if (isProject) {
    return prompts.filter((prompt) => prompt.mention).length;
  }

  const normalizedBrandName = normalizeFilterValue(brandName);
  return prompts.filter((prompt) =>
    (prompt.competitorsMentioned || []).some(
      (competitor) => normalizeFilterValue(competitor) === normalizedBrandName,
    ),
  ).length;
}

function buildTrendBuckets(
  prompts: MonitoringPrompt[],
  filters: MonitoringFiltersSnapshot,
  leader: HeroInsightBrandRow,
): number[] {
  const bucketCount = 6;
  const buckets = Array.from({ length: bucketCount }, () => 0);
  const matchingPrompts = prompts.filter((prompt) =>
    leader.isProject
      ? prompt.mention
      : (prompt.competitorsMentioned || []).some(
          (competitor) =>
            normalizeFilterValue(competitor) === normalizeFilterValue(leader.name),
        ),
  );

  if (matchingPrompts.length === 0) {
    return buckets;
  }

  const range = getPromptPeriodRange(filters.period, filters.dateRange);
  const datedPrompts = matchingPrompts
    .map((prompt) => ({
      date: prompt.createdAt ? new Date(prompt.createdAt) : null,
    }))
    .filter(
      (entry): entry is { date: Date } =>
        entry.date !== null && !Number.isNaN(entry.date.getTime()),
    );

  if (range && datedPrompts.length > 0) {
    const rangeStart = range.from.getTime();
    const rangeSpan = Math.max(1, range.to.getTime() - rangeStart);

    datedPrompts.forEach(({ date }) => {
      const ratio = (date.getTime() - rangeStart) / rangeSpan;
      const bucketIndex = Math.min(
        bucketCount - 1,
        Math.max(0, Math.floor(ratio * bucketCount)),
      );
      buckets[bucketIndex] += 1;
    });

    return buckets;
  }

  matchingPrompts.forEach((_, index) => {
    const bucketIndex = Math.min(
      bucketCount - 1,
      Math.floor((index / Math.max(1, matchingPrompts.length)) * bucketCount),
    );
    buckets[bucketIndex] += 1;
  });

  return buckets;
}

function getMomentum(trend: number[], locale: string): {
  label: string;
  tone: HeroInsightTone;
  microCopy: string;
} {
  const midpoint = Math.ceil(trend.length / 2);
  const early = trend.slice(0, midpoint).reduce((sum, value) => sum + value, 0);
  const late = trend.slice(midpoint).reduce((sum, value) => sum + value, 0);
  const delta = late - early;

  if (delta >= 2 || (early > 0 && late >= early * 1.35)) {
    return {
      label: translateI18nText("monitoring-filters-panel", "momentumStrongLabel", locale),
      tone: "up",
      microCopy: translateI18nText("monitoring-filters-panel", "momentumStrongMicroCopy", locale),
    };
  }

  if (delta <= -2 || (late > 0 && early >= late * 1.35)) {
    return {
      label: translateI18nText("monitoring-filters-panel", "momentumDownLabel", locale),
      tone: "down",
      microCopy: translateI18nText("monitoring-filters-panel", "momentumDownMicroCopy", locale),
    };
  }

  return {
    label: translateI18nText("monitoring-filters-panel", "momentumStableLabel", locale),
    tone: "stable",
    microCopy: translateI18nText("monitoring-filters-panel", "momentumStableMicroCopy", locale),
  };
}

export function buildFilterHeroInsight(args: {
  project: MonitoringProject;
  prompts: MonitoringPrompt[];
  filters: MonitoringFiltersSnapshot;
  locale: string;
}): FilterHeroInsight {
  const { project, prompts, filters, locale } = args;
  const periodLabel = getNarrativePeriodLabel(filters.period, filters.dateRange, locale);
  const scopedPrompts = filterPromptsByScope(prompts, filters, {
    selectedCompetitors: [],
  });
  const citationScopedPrompts = filterPromptsByScope(prompts, filters);
  const citationCount = citationScopedPrompts.filter((prompt) => prompt.citationFound).length;
  const citationRate =
    citationScopedPrompts.length > 0
      ? Math.round((citationCount / citationScopedPrompts.length) * 100)
      : 0;
  const selectedCompetitors =
    filters.selectedCompetitors.length > 0
      ? project.competitors.filter((competitor) =>
          filters.selectedCompetitors.includes(competitor.name),
        )
      : project.competitors;

  const brands: HeroInsightBrandRow[] = [
    ...(project.name.trim() !== ""
      ? [
          {
            name: project.name,
            mentions: countBrandMentions(scopedPrompts, project.name, true),
            share: 0,
            mentionRate: 0,
            isProject: true,
          },
        ]
      : []),
    ...selectedCompetitors
      .filter((competitor) => competitor.name.trim() !== "")
      .map((competitor) => ({
        name: competitor.name,
        mentions: countBrandMentions(scopedPrompts, competitor.name, false),
        share: 0,
        mentionRate: 0,
        isProject: false,
      })),
  ];

  if (scopedPrompts.length === 0 || brands.length === 0) {
    return {
      brandName: "",
      title: translateI18nText("monitoring-filters-panel", "heroEmptyTitle", locale),
      summary: translateI18nText("monitoring-filters-panel", "heroEmptySummary", locale),
      microCopy: translateI18nText("monitoring-filters-panel", "heroEmptyMicroCopy", locale),
      metricValue: "0%",
      metricLabel: translateI18nText("monitoring-filters-panel", "heroMetricLabel", locale),
      momentumLabel: translateI18nText("monitoring-filters-panel", "heroWaitingLabel", locale),
      momentumTone: "stable",
      trend: [0, 0, 0, 0, 0, 0],
      periodLabel,
    };
  }

  const totalMentions = brands.reduce((sum, brand) => sum + brand.mentions, 0);
  if (totalMentions === 0) {
    return {
      brandName: "",
      title: translateI18nText("monitoring-filters-panel", "heroDiffuseTitle", locale),
      summary: translateI18nText("monitoring-filters-panel", "heroDiffuseSummary", locale),
      microCopy: translateI18nText("monitoring-filters-panel", "heroDiffuseMicroCopy", locale),
      metricValue: "0%",
      metricLabel: translateI18nText("monitoring-filters-panel", "heroMetricLabel", locale),
      momentumLabel: translateI18nText("monitoring-filters-panel", "heroWeakSignalLabel", locale),
      momentumTone: "stable",
      trend: [0, 0, 0, 0, 0, 0],
      periodLabel,
    };
  }

  const rankedBrands = brands
    .map((brand) => ({
      ...brand,
      share:
        totalMentions > 0
          ? Number(((brand.mentions / totalMentions) * 100).toFixed(1))
          : 0,
      mentionRate:
        scopedPrompts.length > 0
          ? Number(((brand.mentions / scopedPrompts.length) * 100).toFixed(1))
          : 0,
    }))
    .sort((left, right) => right.share - left.share);

  const leader = rankedBrands[0]!;
  const runnerUp = rankedBrands[1];
  const shareGap = runnerUp
    ? Math.max(0, Math.round(leader.share - runnerUp.share))
    : Math.round(leader.share);
  const trend = buildTrendBuckets(scopedPrompts, filters, leader);
  const momentum = getMomentum(trend, locale);
  const summary = runnerUp
    ? translateI18nText("monitoring-filters-panel", "heroSummaryLeaderVsRunnerUp", locale, {
        share: leader.share.toFixed(1),
        gap: shareGap,
        runnerUp: runnerUp.name,
      })
    : translateI18nText("monitoring-filters-panel", "heroSummaryLeaderSolo", locale, {
        mentions: leader.mentions,
        mentionRate: leader.mentionRate.toFixed(1),
      });

  return {
    brandName: leader.name,
    title: getLeaderNarrative(leader, periodLabel, shareGap, locale),
    summary,
    microCopy: momentum.microCopy,
    metricValue: `${citationRate}%`,
    metricLabel: translateI18nText("monitoring-filters-panel", "heroMetricLabel", locale),
    momentumLabel: momentum.label,
    momentumTone: momentum.tone,
    trend,
    periodLabel,
  };
}
