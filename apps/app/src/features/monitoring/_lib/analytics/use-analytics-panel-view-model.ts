import { useMemo } from "react";

import { useMonitoringData } from "@/hooks/use-monitoring-data";
import { useI18nScope, useScopedI18n } from "@/shared/hooks/use-i18n";

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
  getTrendDirection,
} from "./analytics-panel-helpers";
import {
  filterPromptsByScope,
  promptIsInPeriodWithDateRange,
} from "../shared/prompt-filters";
import { useMonitoringFilters } from "../shared/use-monitoring-filters";

export function useAnalyticsPanelViewModel(): AnalyticsPanelViewModel {
  const content = useI18nScope("monitoring-analytics-panel");
  const { t } = useScopedI18n("monitoring-analytics-panel");
  const filters = useMonitoringFilters();
  const { data: monitoringData, loading } = useMonitoringData();
  const { models, recent_prompts } = monitoringData;
  const trendVs7dSuffix = content.trendVs7dSuffix;
  const betterPositionLabel = content.betterPositionLabel;
  const visibilityScoreSub = content.visibilityScoreSub;
  const avgPositionSub = content.avgPositionSub;
  const insightCitationsLabel = content.insightCitationsLabel;
  const automaticInsightsCopy = useMemo(
    () => ({
      brandMentionTemplate: ({
        label,
        mentions,
        total,
      }: {
        label: string;
        mentions: number;
        total: number;
      }) => t("brandMentionTemplate", { label, mentions, total }),
      coMentionsModel: content.coMentionsAnalyticsTitle,
      coMentionsTemplate: ({
        competitor,
        mentions,
        total,
      }: {
        competitor: string;
        mentions: number;
        total: number;
      }) => t("coMentionsTemplate", { competitor, mentions, total }),
      competitionModel: content.competitionModel,
      competitionTemplate: ({ competitor }: { competitor: string }) =>
        t("competitionTemplate", { competitor }),
      topCitedTemplate: ({ url }: { url: string }) => t("topCitedTemplate", { url }),
      qualityModel: content.qualityModel,
      qualityTemplate: ({ score }: { score: number }) => t("qualityTemplate", { score }),
    }),
    [content.coMentionsAnalyticsTitle, content.competitionModel, content.qualityModel, t],
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
        copy: automaticInsightsCopy,
      }),
    [automaticInsightsCopy, filters.selectedCompetitors, insightCitationsLabel, models, promptsForKpiCards, topCitedPages],
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
  const emptyMentionRateSub = t("mentionRateSub", { count: 0, total: 0 });
  const emptyMentionTrend = t("mentionTrend", { delta: "0%", trendSuffix: trendVs7dSuffix });
  const emptyVisibilityScoreValue = "0 / 100";
  const emptyVisibilityTrend = t("visibilityTrend", {
    delta: "0",
    trendSuffix: trendVs7dSuffix,
  });
  const emptyAvgPositionValue = "0";
  const emptyAvgPositionTrend = t("avgPositionTrend", {
    delta: "0",
    betterPositionLabel,
  });

  return {
    loading,
    kpis: {
      mentionRateValue: hasFilteredMetricData
        ? `${filteredMetrics.mentionRate}%`
        : emptyMentionRateValue,
      mentionRateSub: hasFilteredMetricData
        ? t("mentionRateSub", {
            count: mentionCount,
            total: promptsForKpiCards.length,
          })
        : emptyMentionRateSub,
      mentionTrend: hasFilteredMetricData
        ? t("mentionTrend", {
            delta: `${mentionTrendDelta >= 0 ? "+" : ""}${mentionTrendDelta}%`,
            trendSuffix: trendVs7dSuffix,
          })
        : emptyMentionTrend,
      mentionTrendDir: hasFilteredMetricData
        ? getTrendDirection(mentionTrendDelta)
        : "stable",
      visibilityScoreValue: hasFilteredMetricData
        ? `${filteredMetrics.visibilityScore} / 100`
        : emptyVisibilityScoreValue,
      visibilitySub: visibilityScoreSub,
      visibilityTrend: hasFilteredMetricData
        ? t("visibilityTrend", {
            delta: `${visibilityTrendDelta >= 0 ? "+" : ""}${visibilityTrendDelta}`,
            trendSuffix: trendVs7dSuffix,
          })
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
        ? t("avgPositionTrend", {
            delta: `${avgPositionTrendDelta >= 0 ? "+" : ""}${avgPositionTrendDelta.toFixed(1)}`,
            betterPositionLabel,
          })
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
          ? content.coMentionsAnalyticsTitle
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
