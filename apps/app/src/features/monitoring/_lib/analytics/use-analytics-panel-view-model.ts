import { useMemo } from "react";

import { useMonitoringData } from "@/hooks/use-monitoring-data";
import { useLocale, useI18nScope } from "@/shared/hooks/use-i18n";

import {
  buildTopCitedPagesFromPrompts,
  getPromptMetrics,
  getSentimentCounts,
} from "./analytics-utils";
import type {
  AnalyticsPanelViewModel,
} from "./types";
import {
  buildAutomaticInsights,
  buildSentimentData,
  buildVisibilityBarData,
  getSafeText,
  getTrendDirection,
} from "./analytics-panel-helpers";
import {
  filterPromptsByScope,
  promptIsInPeriodWithDateRange,
} from "../shared/prompt-filters";
import { useMonitoringFilters } from "../shared/use-monitoring-filters";

export function useAnalyticsPanelViewModel(): AnalyticsPanelViewModel {
  const content = useI18nScope("monitoring-analytics-panel");
  const { locale } = useLocale();
  const isFr = locale === "fr";
  const filters = useMonitoringFilters();
  const { data: monitoringData, loading } = useMonitoringData();
  const { models, recent_prompts } = monitoringData;

  const mentionRateSubSuffix = getSafeText(
    content.mentionRateSubSuffix,
    "reponses mentionnent votre marque",
    "responses mention your brand",
    isFr,
  );
  const trendVs7dSuffix = getSafeText(content.trendVs7dSuffix, "vs 7j", "vs 7d", isFr);
  const betterPositionLabel = getSafeText(
    content.betterPositionLabel,
    "meilleure position",
    "better position",
    isFr,
  );
  const visibilityScoreSub = getSafeText(
    content.visibilityScoreSub,
    "Score combine mention x position x sentiment",
    "Combined score: mention x position x sentiment",
    isFr,
  );
  const avgPositionSub = getSafeText(
    content.avgPositionSub,
    "Sur toutes les reponses ou vous etes cite",
    "Across all responses where your brand is cited",
    isFr,
  );
  const insightCitationsLabel = getSafeText(
    content.insightCitationsLabel,
    "Citations",
    "Citations",
    isFr,
  );

  const filteredPrompts = useMemo(
    () => filterPromptsByScope(recent_prompts, filters, { applyPeriod: false }),
    [recent_prompts, filters],
  );
  const promptsForKpiCards = useMemo(
    () =>
      filteredPrompts.filter((prompt) =>
        promptIsInPeriodWithDateRange(prompt, filters.period, filters.dateRange),
      ),
    [filteredPrompts, filters.dateRange, filters.period],
  );
  const promptsForVisibilityAnalyticsPeriod = useMemo(() => {
    const periodScopedPrompts = filteredPrompts.filter((prompt) =>
      promptIsInPeriodWithDateRange(prompt, filters.period, filters.dateRange),
    );

    if (filters.selectedCompetitors.length > 0) {
      return periodScopedPrompts.filter((prompt) => prompt.mention);
    }

    return periodScopedPrompts;
  }, [
    filteredPrompts,
    filters.dateRange,
    filters.period,
    filters.selectedCompetitors.length,
  ]);

  const baselineMetrics = useMemo(
    () => getPromptMetrics(recent_prompts),
    [recent_prompts],
  );
  const filteredMetrics = useMemo(
    () => getPromptMetrics(promptsForKpiCards),
    [promptsForKpiCards],
  );
  const hasFilteredMetricData = promptsForKpiCards.length > 0;
  const mentionCount = useMemo(
    () => promptsForKpiCards.filter((prompt) => prompt.mention).length,
    [promptsForKpiCards],
  );

  const sentimentCounts = useMemo(
    () => getSentimentCounts(promptsForKpiCards),
    [promptsForKpiCards],
  );
  const totalSentimentPrompts = promptsForKpiCards.length;
  const sentimentData = useMemo(
    () => buildSentimentData(totalSentimentPrompts, sentimentCounts),
    [sentimentCounts, totalSentimentPrompts],
  );

  const factualAccuracyCount = useMemo(
    () => promptsForKpiCards.filter((prompt) => prompt.citationFound).length,
    [promptsForKpiCards],
  );
  const factualAccuracy = useMemo(
    () =>
      totalSentimentPrompts > 0
        ? Math.round((factualAccuracyCount / totalSentimentPrompts) * 100)
        : 0,
    [factualAccuracyCount, totalSentimentPrompts],
  );

  const topCitedPages = useMemo(
    () => buildTopCitedPagesFromPrompts(promptsForKpiCards).slice(0, 3),
    [promptsForKpiCards],
  );
  const topCitedTotal = useMemo(
    () => topCitedPages.reduce((sum, page) => sum + page.value, 0),
    [topCitedPages],
  );

  const autoInsights = useMemo(
    () =>
      buildAutomaticInsights({
        prompts: promptsForKpiCards,
        models,
        selectedCompetitors: filters.selectedCompetitors,
        topCitedPages,
        insightCitationsLabel,
      }),
    [filters.selectedCompetitors, insightCitationsLabel, models, promptsForKpiCards, topCitedPages],
  );

  const visibilityBarData = useMemo(
    () => {
      if (promptsForVisibilityAnalyticsPeriod.length === 0) {
        return [];
      }

      return buildVisibilityBarData({
        models,
        selectedModels: filters.selectedModels,
        showUniqueModelFilters: filters.showUniqueModelFilters,
        prompts: promptsForVisibilityAnalyticsPeriod,
      });
    },
    [
      filters.selectedModels,
      filters.showUniqueModelFilters,
      models,
      promptsForVisibilityAnalyticsPeriod,
    ],
  );

  const mentionTrendDelta = filteredMetrics.mentionRate - baselineMetrics.mentionRate;
  const visibilityTrendDelta =
    filteredMetrics.visibilityScore - baselineMetrics.visibilityScore;
  const avgPositionTrendDelta =
    baselineMetrics.avgPosition - filteredMetrics.avgPosition;
  const emptyMentionRateValue = "0%";
  const emptyMentionRateSub = `0/0 ${mentionRateSubSuffix}`;
  const emptyMentionTrend = `0% ${trendVs7dSuffix}`;
  const emptyVisibilityScoreValue = "0 / 100";
  const emptyVisibilityTrend = `0 ${trendVs7dSuffix}`;
  const emptyAvgPositionValue = "0";
  const emptyAvgPositionTrend = `0 (${betterPositionLabel})`;

  return {
    loading,
    kpis: {
      mentionRateValue: hasFilteredMetricData
        ? `${filteredMetrics.mentionRate}%`
        : emptyMentionRateValue,
      mentionRateSub: hasFilteredMetricData
        ? `${mentionCount}/${promptsForKpiCards.length} ${mentionRateSubSuffix}`
        : emptyMentionRateSub,
      mentionTrend: hasFilteredMetricData
        ? `${mentionTrendDelta >= 0 ? "+" : ""}${mentionTrendDelta}% ${trendVs7dSuffix}`
        : emptyMentionTrend,
      mentionTrendDir: hasFilteredMetricData
        ? getTrendDirection(mentionTrendDelta)
        : "stable",
      visibilityScoreValue: hasFilteredMetricData
        ? `${filteredMetrics.visibilityScore} / 100`
        : emptyVisibilityScoreValue,
      visibilitySub: visibilityScoreSub,
      visibilityTrend: hasFilteredMetricData
        ? `${visibilityTrendDelta >= 0 ? "+" : ""}${visibilityTrendDelta} ${trendVs7dSuffix}`
        : emptyVisibilityTrend,
      visibilityTrendDir: hasFilteredMetricData
        ? getTrendDirection(visibilityTrendDelta)
        : "stable",
      avgPositionValue:
        hasFilteredMetricData && filteredMetrics.avgPosition > 0
          ? `${filteredMetrics.avgPosition}`
          : emptyAvgPositionValue,
      avgPositionSub,
      avgPositionTrend: hasFilteredMetricData
        ? `${avgPositionTrendDelta >= 0 ? "+" : ""}${avgPositionTrendDelta.toFixed(1)} (${betterPositionLabel})`
        : emptyAvgPositionTrend,
      avgPositionTrendDir: hasFilteredMetricData
        ? getTrendDirection(avgPositionTrendDelta)
        : "stable",
    },
    visibilityAnalytics: {
      effectiveVisibilityPeriod: filters.period,
      barData: visibilityBarData,
      hasCompetitorFilter: filters.selectedCompetitors.length > 0,
      title:
        filters.selectedCompetitors.length > 0
          ? "Co-mentions Analytics"
          : undefined,
    },
    sentiment: {
      sentimentData,
      factualAccuracy,
      factualAccuracyCount,
      totalCount: totalSentimentPrompts,
      hasData: totalSentimentPrompts > 0,
    },
    citedPages: {
      topCitedPages,
      topCitedTotal,
      longTailShare: Math.max(0, 100 - topCitedTotal),
    },
    autoInsights,
  };
}
