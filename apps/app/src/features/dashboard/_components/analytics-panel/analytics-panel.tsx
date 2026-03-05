"use client";

import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardStore } from "@/lib/dashboard-store";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { useLocale } from "@/shared/hooks/use-i18n";
import { useShallow } from "zustand/react/shallow";
import { KpiOverviewGrid } from "./kpi-overview-grid";
import { BrandVisibilityChart } from "./brand-visibility-panel";
import {
  chartConfig,
  getPromptMetrics,
  matchesPromptAudienceFilters,
  promptIsInPeriodWithDateRange,
} from "./analytics-utils";
import { VisibilityAnalytics } from "./model-visibility-panel";
import { SentimentDistribution } from "./sentiment-distribution";
import { CitedPagesPanel } from "./cited-pages-panel";
import { AutomaticInsights } from "./automatic-insights";

export function AnalyticsPanel() {
  const content = useI18nScope("dashboard-analytics-panel");
  const { locale } = useLocale();
  const isFr = locale === "fr";
  const safeText = (value: unknown, fallbackFr: string, fallbackEn: string) =>
    typeof value === "string" && value.length > 0 ? value : isFr ? fallbackFr : fallbackEn;
  const mentionRateSubSuffix = safeText(content.mentionRateSubSuffix, "prompts incluent votre marque", "prompts include your brand");
  const trendVs7dSuffix = safeText(content.trendVs7dSuffix, "vs 7j", "vs 7d");
  const betterPositionLabel = safeText(content.betterPositionLabel, "meilleure position", "better position");
  const visibilityScoreSub = safeText(content.visibilityScoreSub, "Score combiné mention × position × sentiment", "Combined score: mention × position × sentiment");
  const avgPositionSub = safeText(content.avgPositionSub, "Sur toutes les réponses où vous êtes cité", "Across all responses where your brand is cited");
  const insightCitationsLabel = safeText(content.insightCitationsLabel, "Citations", "Citations");
  const { data: dashboardData, loading } = useDashboardData();
  const { kpis, models, recent_prompts, pagesStats } = dashboardData;
  const {
    selectedModels,
    showUniqueModelFilters,
    selectedPersonas,
    selectedCompetitors,
    period,
    dateRange,
  } = useDashboardStore(
    useShallow((state) => ({
      selectedModels: state.selectedModels,
      showUniqueModelFilters: state.showUniqueModelFilters,
      selectedPersonas: state.selectedPersonas,
      selectedCompetitors: state.selectedCompetitors,
      period: state.period,
      dateRange: state.dateRange,
    })),
  );

  const filteredPrompts = useMemo(() => {
    return recent_prompts.filter((prompt) =>
      matchesPromptAudienceFilters(
        prompt,
        selectedModels,
        selectedPersonas,
        selectedCompetitors,
      ),
    );
  }, [
    recent_prompts,
    selectedModels,
    selectedPersonas,
    selectedCompetitors,
  ]);

  const promptsForKpiCards = useMemo(() => {
    return filteredPrompts.filter((prompt) =>
      promptIsInPeriodWithDateRange(prompt, period, dateRange),
    );
  }, [
    filteredPrompts,
    period,
    dateRange,
  ]);

  const promptsForVisibilityAnalytics = filteredPrompts;
  const promptsForAiSentiment = filteredPrompts;
  const promptsForAutoInsights = filteredPrompts;
  const modelsToShow = useMemo(() => {
    if (selectedModels.length === 0) return models;
    return models.filter((m) => selectedModels.includes(m.id));
  }, [
    selectedModels,
    models,
  ]);


  const baselineMetrics = useMemo(() => getPromptMetrics(recent_prompts), [recent_prompts]);
  const filteredMetrics = useMemo(
    () => getPromptMetrics(promptsForKpiCards),
    [promptsForKpiCards],
  );
  const hasFilteredMetricData = promptsForKpiCards.length > 0;
  const mentionCount = useMemo(
    () => promptsForKpiCards.filter((prompt) => prompt.mention).length,
    [promptsForKpiCards],
  );

  const mentionRateValue = hasFilteredMetricData ? `${filteredMetrics.mentionRate}%` : kpis.mention_rate.value;
  const mentionRateSub = hasFilteredMetricData
    ? `${mentionCount}/${promptsForKpiCards.length} ${mentionRateSubSuffix}`
    : `${mentionCount}/${recent_prompts.length} ${mentionRateSubSuffix}`;
  const mentionTrendDelta = filteredMetrics.mentionRate - baselineMetrics.mentionRate;
  const mentionTrend = hasFilteredMetricData
    ? `${mentionTrendDelta >= 0 ? "+" : ""}${mentionTrendDelta}% ${trendVs7dSuffix}`
    : kpis.mention_rate.trend.replace("vs 7j", trendVs7dSuffix);
  const mentionTrendDir: "up" | "down" | "stable" = mentionTrendDelta > 0 ? "up" : mentionTrendDelta < 0 ? "down" : "stable";

  const visibilityScoreValue = hasFilteredMetricData ? `${filteredMetrics.visibilityScore} / 100` : kpis.visibility_score.value;
  const visibilityTrendDelta = filteredMetrics.visibilityScore - baselineMetrics.visibilityScore;
  const visibilityTrend = hasFilteredMetricData
    ? `${visibilityTrendDelta >= 0 ? "+" : ""}${visibilityTrendDelta} ${trendVs7dSuffix}`
    : kpis.visibility_score.trend.replace("vs 7j", trendVs7dSuffix);
  const visibilityTrendDir: "up" | "down" | "stable" = visibilityTrendDelta > 0 ? "up" : visibilityTrendDelta < 0 ? "down" : "stable";

  const avgPositionValue = hasFilteredMetricData && filteredMetrics.avgPosition > 0 ? `${filteredMetrics.avgPosition}` : kpis.avg_position.value;
  const avgPositionTrendDelta = baselineMetrics.avgPosition - filteredMetrics.avgPosition;
  const avgPositionTrend = hasFilteredMetricData
    ? `${avgPositionTrendDelta >= 0 ? "+" : ""}${avgPositionTrendDelta.toFixed(1)} (${betterPositionLabel})`
    : kpis.avg_position.trend.replace("meilleure position", betterPositionLabel);
  const avgPositionTrendDir: "up" | "down" | "stable" = avgPositionTrendDelta > 0 ? "up" : avgPositionTrendDelta < 0 ? "down" : "stable";

  const promptsForVisibilityAnalyticsPeriod = useMemo(
    () => {
      const base = promptsForVisibilityAnalytics.filter((prompt) =>
        promptIsInPeriodWithDateRange(prompt, period, dateRange),
      );

      // For this chart, competitor filtering is interpreted as "brand + competitor co-mentioned".
      if (selectedCompetitors.length > 0) {
        return base.filter((prompt) => prompt.mention);
      }

      return base;
    },
    [promptsForVisibilityAnalytics, period, dateRange, selectedCompetitors.length],
  );

  const visibilityAnalyticsBarData = useMemo(() => {
    const palette = [
      "hsl(186 49% 62%)",
      "hsl(204 40% 47%)",
      "hsl(221 39% 34%)",
      "hsl(200 63% 68%)",
      "hsl(230 53% 58%)",
      "hsl(213 29% 45%)",
      "hsl(193 34% 56%)",
    ];

    const rowsByModel = modelsToShow.map((model, index) => {
      const rows = promptsForVisibilityAnalyticsPeriod.filter((prompt) => {
        const key = prompt.modelFilterKey || "";
        return key === model.id;
      });
      const mentions = rows.filter((prompt) => prompt.mention).length;
      return {
        id: model.id,
        rawName: model.name,
        label: (chartConfig[model.id as keyof typeof chartConfig]?.label as string) ?? model.name,
        value: mentions,
        fill: palette[index % palette.length] as string,
      };
    });

    if (showUniqueModelFilters) {
      return rowsByModel.sort((a, b) => b.value - a.value);
    }

    const familyKey = (name: string) => {
      const lower = (name || "").toLowerCase();
      if (lower.startsWith("chatgpt")) return { key: "chatgpt", label: "ChatGPT" };
      if (lower.startsWith("gemini")) return { key: "gemini", label: "Gemini" };
      if (lower.startsWith("claude")) return { key: "claude", label: "Claude" };
      if (lower.startsWith("perplexity")) return { key: "perplexity", label: "Perplexity" };
      if (lower.startsWith("mistral")) return { key: "mistral", label: "Mistral" };
      if (lower.startsWith("copilot")) return { key: "copilot", label: "Copilot" };
      const first = (name || "modele").split(/[\s-]/)[0] || "modele";
      return { key: first.toLowerCase(), label: first };
    };

    const grouped = new Map<string, { id: string; label: string; value: number; fill: string }>();
    rowsByModel.forEach((row, index) => {
      const family = familyKey(row.rawName || row.label);
      const current = grouped.get(family.key);
      if (!current) {
        grouped.set(family.key, {
          id: family.key,
          label: family.label,
          value: row.value,
          fill: palette[index % palette.length] as string,
        });
        return;
      }
      current.value += row.value;
    });

    return Array.from(grouped.values()).sort((a, b) => b.value - a.value);
  }, [modelsToShow, promptsForVisibilityAnalyticsPeriod, showUniqueModelFilters]);

  const sentimentCounts = useMemo(
    () =>
      promptsForAiSentiment.reduce(
        (acc, prompt) => {
          if (prompt.score > 80) acc.positive += 1;
          else if (prompt.score > 50) acc.neutral += 1;
          else acc.negative += 1;
          return acc;
        },
        { positive: 0, neutral: 0, negative: 0 },
      ),
    [promptsForAiSentiment],
  );
  const totalSentimentPrompts = promptsForAiSentiment.length;

  const sentimentData = useMemo(
    () => [
      {
        name: "positive",
        value:
          totalSentimentPrompts > 0
            ? Math.round((sentimentCounts.positive / totalSentimentPrompts) * 100)
            : 0,
        fill: chartConfig.positive.color,
      },
      {
        name: "neutral",
        value:
          totalSentimentPrompts > 0
            ? Math.round((sentimentCounts.neutral / totalSentimentPrompts) * 100)
            : 0,
        fill: chartConfig.neutral.color,
      },
      {
        name: "negative",
        value:
          totalSentimentPrompts > 0
            ? Math.round((sentimentCounts.negative / totalSentimentPrompts) * 100)
            : 0,
        fill: chartConfig.negative.color,
      },
    ],
    [totalSentimentPrompts, sentimentCounts],
  );

  const factualAccuracy = useMemo(
    () =>
      totalSentimentPrompts > 0
        ? Math.round(
          promptsForAiSentiment.reduce((acc, prompt) => acc + prompt.score, 0) /
          totalSentimentPrompts,
        )
        : 0,
    [promptsForAiSentiment, totalSentimentPrompts],
  );

  const topCitedPages = useMemo(() => {
    const backendPages = (pagesStats?.pages ?? [])
      .slice(0, 3)
      .map((page) => ({
        url: page.pageUrl || "",
        value: Math.max(0, Math.round(page.citationShare ?? 0)),
      }))
      .filter((page) => page.value > 0 && page.url !== "");

    if (backendPages.length > 0) return backendPages;

    return [];
  }, [
    pagesStats?.pages,
  ]);

  const topCitedTotal = useMemo(
    () => topCitedPages.reduce((acc, page) => acc + page.value, 0),
    [topCitedPages],
  );
  const longTailShare = Math.max(0, 100 - topCitedTotal);

  const autoInsights = useMemo(() => {
    const source = promptsForAutoInsights;
    const insights: Array<{ model: string; text: string; delta: string; level: "high" | "medium" }> = [];

    const rowsByModel = new Map<string, typeof source>();
    for (const row of source) {
      const key = row.modelFilterKey || row.model || "unknown";
      const current = rowsByModel.get(key) ?? [];
      current.push(row);
      rowsByModel.set(key, current);
    }

    const modelMentionRates = Array.from(rowsByModel.entries())
      .map(([key, rows]) => {
        const mentions = rows.filter((r) => r.mention).length;
        const rate = rows.length > 0 ? Math.round((mentions / rows.length) * 100) : 0;
        const modelMeta = models.find((m) => m.id === key);
        return {
          key,
          label: modelMeta?.name || rows[0]?.model || key,
          mentions,
          total: rows.length,
          rate,
        };
      })
      .sort((a, b) => b.rate - a.rate || b.mentions - a.mentions);

    if (modelMentionRates.length > 0) {
      const best = modelMentionRates[0]!;
      insights.push({
        model: best.label,
        text: `${best.label} mentionne votre marque dans ${best.mentions}/${best.total} reponses sur le scope actuel.`,
        delta: `${best.rate}%`,
        level: best.rate >= 70 ? "high" : "medium",
      });
    }

    const competitorNames = selectedCompetitors;
    if (competitorNames.length > 0) {
      const selected = competitorNames[0]!;
      const coMentions = source.filter(
        (p) =>
          p.mention &&
          (p.competitorsMentioned || []).some((name) => name.trim().toLowerCase() === selected.trim().toLowerCase()),
      ).length;
      const total = source.length || 1;
      insights.push({
        model: "Co-mentions",
        text: `${selected} est co-cite avec votre marque dans ${coMentions} reponses sur ${source.length} apres filtres.`,
        delta: `${Math.round((coMentions / total) * 100)}%`,
        level: coMentions > 0 ? "high" : "medium",
      });
    } else {
      const competitorCounts = new Map<string, number>();
      for (const prompt of source) {
        for (const competitor of prompt.competitorsMentioned || []) {
          const key = competitor.trim();
          if (!key) continue;
          competitorCounts.set(key, (competitorCounts.get(key) ?? 0) + 1);
        }
      }
      const topCompetitor = Array.from(competitorCounts.entries()).sort((a, b) => b[1] - a[1])[0];
      if (topCompetitor) {
        insights.push({
          model: "Concurrence",
          text: `${topCompetitor[0]} est le concurrent le plus cite dans le scope actuel.`,
          delta: `${topCompetitor[1]}`,
          level: "medium",
        });
      }
    }

    if (topCitedPages.length > 0) {
      const topPage = topCitedPages[0]!;
      insights.push({
        model: insightCitationsLabel,
        text: `${topPage.url} est la page la plus citee par les IA sur le scope actuel.`,
        delta: `${topPage.value}%`,
        level: topPage.value >= 40 ? "high" : "medium",
      });
    }

    if (insights.length < 3 && source.length > 0) {
      const avgScore = Math.round(source.reduce((acc, p) => acc + (p.score || 0), 0) / source.length);
      insights.push({
        model: "Qualite",
        text: `Le score moyen de visibilite sur les reponses filtrees est de ${avgScore}/100.`,
        delta: `${avgScore}/100`,
        level: avgScore >= 70 ? "high" : "medium",
      });
    }

    return insights.slice(0, 3);
  }, [
    promptsForAutoInsights,
    models,
    selectedCompetitors,
    topCitedPages,
    insightCitationsLabel,
  ]);

  if (loading) {
    return (
      <ScrollArea className="h-auto px-1 xl:h-full">
        <div className="flex flex-col gap-4 pb-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card className="rounded-md">
              <CardHeader><CardTitle><Skeleton className="h-4 w-24" /></CardTitle></CardHeader>
              <CardContent className="space-y-2"><Skeleton className="h-8 w-28" /><Skeleton className="h-3 w-36" /></CardContent>
            </Card>
            <Card className="rounded-md">
              <CardHeader><CardTitle><Skeleton className="h-4 w-28" /></CardTitle></CardHeader>
              <CardContent className="space-y-2"><Skeleton className="h-8 w-28" /><Skeleton className="h-3 w-36" /></CardContent>
            </Card>
            <Card className="rounded-md">
              <CardHeader><CardTitle><Skeleton className="h-4 w-24" /></CardTitle></CardHeader>
              <CardContent className="space-y-2"><Skeleton className="h-8 w-20" /><Skeleton className="h-3 w-32" /></CardContent>
            </Card>
          </div>
          <Card className="rounded-md">
            <CardHeader><CardTitle><Skeleton className="h-4 w-40" /></CardTitle></CardHeader>
            <CardContent><Skeleton className="h-[220px] w-full rounded-md" /></CardContent>
          </Card>
          <Card className="rounded-md">
            <CardHeader><CardTitle><Skeleton className="h-4 w-44" /></CardTitle></CardHeader>
            <CardContent><Skeleton className="h-[260px] w-full rounded-md" /></CardContent>
          </Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="rounded-md">
              <CardHeader><CardTitle><Skeleton className="h-4 w-32" /></CardTitle></CardHeader>
              <CardContent><Skeleton className="h-[220px] w-full rounded-md" /></CardContent>
            </Card>
            <Card className="rounded-md">
              <CardHeader><CardTitle><Skeleton className="h-4 w-36" /></CardTitle></CardHeader>
              <CardContent><Skeleton className="h-[220px] w-full rounded-md" /></CardContent>
            </Card>
          </div>
          <Card className="rounded-md">
            <CardHeader><CardTitle><Skeleton className="h-4 w-36" /></CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-auto px-1 xl:h-full">
      <div className="flex flex-col gap-4 pb-4">
        <KpiOverviewGrid
          mentionRateValue={mentionRateValue}
          mentionRateSub={mentionRateSub}
          mentionTrend={mentionTrend}
          mentionTrendDir={mentionTrendDir}
          visibilityScoreValue={visibilityScoreValue}
          visibilityTrend={visibilityTrend}
          visibilityTrendDir={visibilityTrendDir}
          visibilitySub={visibilityScoreSub}
          avgPositionValue={avgPositionValue}
          avgPositionSub={avgPositionSub}
          avgPositionTrend={avgPositionTrend}
          avgPositionTrendDir={avgPositionTrendDir}
        />

        <VisibilityAnalytics
          effectiveVisibilityPeriod={period}
          barData={visibilityAnalyticsBarData}
          hasCompetitorFilter={selectedCompetitors.length > 0}
          title={selectedCompetitors.length > 0 ? "Co-mentions Analytics" : undefined}
        />

        <BrandVisibilityChart />

        <div className="grid w-full min-w-0 grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:!grid-cols-2">
          <SentimentDistribution
            sentimentData={sentimentData}
            factualAccuracy={factualAccuracy}
            hasData={totalSentimentPrompts > 0}
          />
          <CitedPagesPanel topCitedPages={topCitedPages} topCitedTotal={topCitedTotal} longTailShare={longTailShare} />
        </div>

        <AutomaticInsights autoInsights={autoInsights} />
      </div>
    </ScrollArea>
  );
}
