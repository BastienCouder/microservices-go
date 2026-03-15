import { VISIBILITY_ANALYTICS_COLORS } from "@/lib/app-data";

import { chartConfig, getSentimentCounts } from "./analytics-utils";
import type { InsightItem, SentimentDatum, VisibilityBarDatum } from "./types";

export function getSafeText(
  value: unknown,
  fallbackFr: string,
  fallbackEn: string,
  isFr: boolean,
): string {
  return typeof value === "string" && value.length > 0
    ? value
    : isFr
      ? fallbackFr
      : fallbackEn;
}

export function getTrendDirection(delta: number): "up" | "down" | "stable" {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "stable";
}

export function buildVisibilityBarData(input: {
  models: Array<{
    id: string;
    displayName: string;
    groupName: string;
    providerModelId: string;
  }>;
  selectedModels: string[];
  showUniqueModelFilters: boolean;
  prompts: Array<{ modelId: string; mention: boolean }>;
}): VisibilityBarDatum[] {
  const palette = VISIBILITY_ANALYTICS_COLORS.series;
  const modelsToShow =
    input.selectedModels.length === 0
      ? input.models
      : input.models.filter((model) => input.selectedModels.includes(model.id));

  const rowsByModel = modelsToShow.map((model, index) => {
    const rows = input.prompts.filter((prompt) => prompt.modelId === model.id);
    const mentions = rows.filter((prompt) => prompt.mention).length;
    const displayLabel = model.displayName || model.providerModelId || model.id;
    const groupLabel = model.groupName || displayLabel;

    return {
      id: model.id,
      rawName: displayLabel,
      groupName: groupLabel,
      label: input.showUniqueModelFilters ? displayLabel : groupLabel,
      value: mentions,
      fill: palette[index % palette.length] as string,
    };
  });

  if (input.showUniqueModelFilters) {
    return rowsByModel.sort((left, right) => right.value - left.value);
  }

  const groupedRows = new Map<
    string,
    { id: string; label: string; value: number; fill: string }
  >();

  rowsByModel.forEach((row, index) => {
    const current = groupedRows.get(row.groupName);
    if (!current) {
      groupedRows.set(row.groupName, {
        id: row.groupName,
        label: row.groupName,
        value: row.value,
        fill: palette[index % palette.length] as string,
      });
      return;
    }

    current.value += row.value;
  });

  return Array.from(groupedRows.values()).sort((left, right) => right.value - left.value);
}

export function buildSentimentData(
  totalSentimentPrompts: number,
  sentimentCounts: ReturnType<typeof getSentimentCounts>,
): SentimentDatum[] {
  return [
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
  ];
}

export function buildAutomaticInsights(input: {
  prompts: Array<{
    mention: boolean;
    modelId: string;
    modelGroupName: string;
    competitorsMentioned: string[];
    score: number;
  }>;
  models: Array<{ id: string; groupName: string }>;
  selectedCompetitors: string[];
  topCitedPages: Array<{ url: string; value: number }>;
  insightCitationsLabel: string;
}): InsightItem[] {
  const insights: InsightItem[] = [];
  const rowsByModel = new Map<string, typeof input.prompts>();

  for (const row of input.prompts) {
    const key = row.modelId || "unknown";
    const current = rowsByModel.get(key) ?? [];
    current.push(row);
    rowsByModel.set(key, current);
  }

  const modelMentionRates = Array.from(rowsByModel.entries())
    .map(([key, rows]) => {
      const mentions = rows.filter((row) => row.mention).length;
      const rate = rows.length > 0 ? Math.round((mentions / rows.length) * 100) : 0;
      const modelMeta = input.models.find((model) => model.id === key);

      return {
        key,
        label: modelMeta?.groupName || rows[0]?.modelGroupName || key,
        mentions,
        total: rows.length,
        rate,
      };
    })
    .sort((left, right) => right.rate - left.rate || right.mentions - left.mentions);

  if (modelMentionRates.length > 0) {
    const best = modelMentionRates[0]!;
    insights.push({
      model: best.label,
      text: `${best.label} mentionne votre marque dans ${best.mentions}/${best.total} reponses sur le scope actuel.`,
      delta: `${best.rate}%`,
      level: best.rate >= 70 ? "high" : "medium",
    });
  }

  if (input.selectedCompetitors.length > 0) {
    const selectedCompetitor = input.selectedCompetitors[0]!;
    const normalizedCompetitor = selectedCompetitor.trim().toLowerCase();
    const coMentions = input.prompts.filter(
      (prompt) =>
        prompt.mention &&
        (prompt.competitorsMentioned || []).some(
          (name) => name.trim().toLowerCase() === normalizedCompetitor,
        ),
    ).length;
    const total = input.prompts.length || 1;

    insights.push({
      model: "Co-mentions",
      text: `${selectedCompetitor} est co-cite avec votre marque dans ${coMentions} reponses sur ${input.prompts.length} apres filtres.`,
      delta: `${Math.round((coMentions / total) * 100)}%`,
      level: coMentions > 0 ? "high" : "medium",
    });
  } else {
    const competitorCounts = new Map<string, number>();

    for (const prompt of input.prompts) {
      for (const competitor of prompt.competitorsMentioned || []) {
        const key = competitor.trim();
        if (!key) continue;
        competitorCounts.set(key, (competitorCounts.get(key) ?? 0) + 1);
      }
    }

    const topCompetitor = Array.from(competitorCounts.entries()).sort(
      (left, right) => right[1] - left[1],
    )[0];

    if (topCompetitor) {
      insights.push({
        model: "Concurrence",
        text: `${topCompetitor[0]} est le concurrent le plus cite dans le scope actuel.`,
        delta: `${topCompetitor[1]}`,
        level: "medium",
      });
    }
  }

  if (input.topCitedPages.length > 0) {
    const topPage = input.topCitedPages[0]!;
    insights.push({
      model: input.insightCitationsLabel,
      text: `${topPage.url} est la page la plus citee par les IA sur le scope actuel.`,
      delta: `${topPage.value}%`,
      level: topPage.value >= 40 ? "high" : "medium",
    });
  }

  if (insights.length < 3 && input.prompts.length > 0) {
    const avgScore = Math.round(
      input.prompts.reduce((sum, prompt) => sum + (prompt.score || 0), 0) /
        input.prompts.length,
    );

    insights.push({
      model: "Qualite",
      text: `Le score moyen de visibilite sur les reponses filtrees est de ${avgScore}/100.`,
      delta: `${avgScore}/100`,
      level: avgScore >= 70 ? "high" : "medium",
    });
  }

  return insights.slice(0, 3);
}
