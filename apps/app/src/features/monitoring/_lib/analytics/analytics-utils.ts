import { translateI18nText } from "@/shared/hooks/use-i18n";
import i18n from "@/shared/i18n";
import type { MonitoringPrompt } from "../shared/monitoring-data";
import { type ChartConfig } from "@/components/ui/chart";

const locale = i18n.resolvedLanguage || i18n.language || "fr";

export const chartConfig = {
  chatgpt: { label: "ChatGPT", color: "hsl(var(--chart-brand-primary))" },
  perplexity: { label: "Perplexity", color: "hsl(var(--chart-series-2))" },
  claude: { label: "Claude", color: "hsl(var(--chart-series-3))" },
  gemini: { label: "Gemini", color: "hsl(var(--chart-series-4))" },
  mistral: { label: "Mistral", color: "hsl(var(--chart-series-5))" },
  copilot: { label: "Copilot", color: "hsl(var(--chart-series-6))" },
  brand: { label: translateI18nText("monitoring-analytics-panel", "chartBrandLabel", locale), color: "hsl(var(--chart-brand-primary))" },
  comp1: { label: translateI18nText("monitoring-analytics-panel", "chartCompetitor1Label", locale), color: "hsl(var(--chart-series-2))" },
  comp2: { label: translateI18nText("monitoring-analytics-panel", "chartCompetitor2Label", locale), color: "hsl(var(--chart-series-3))" },
  other: { label: translateI18nText("monitoring-analytics-panel", "chartOtherLabel", locale), color: "hsl(var(--muted))" },
  sentiment: { label: translateI18nText("monitoring-analytics-panel", "chartSentimentLabel", locale), color: "hsl(var(--chart-brand-primary))" },
  positive: { label: translateI18nText("monitoring-analytics-panel", "sentimentPositive", locale), color: "hsl(var(--chart-sentiment-positive))" },
  neutral: { label: translateI18nText("monitoring-analytics-panel", "sentimentNeutral", locale), color: "hsl(var(--chart-sentiment-neutral))" },
  negative: { label: translateI18nText("monitoring-analytics-panel", "sentimentNegative", locale), color: "hsl(var(--chart-sentiment-negative))" },
} satisfies ChartConfig;

export type RecentPrompt = MonitoringPrompt;

function toDisplayPagePath(rawUrl: string): string {
  const value = rawUrl.trim();
  if (!value) return "/";

  try {
    const parsed = value.startsWith("http://") || value.startsWith("https://")
      ? new URL(value)
      : new URL(`https://${value}`);
    return parsed.pathname || "/";
  } catch {
    const normalized = value.replace(/^https?:\/\//, "").replace(/^[^/]+/, "");
    return normalized || "/";
  }
}

export function getPromptMetrics(prompts: RecentPrompt[]) {
  if (prompts.length === 0) {
    return { mentionRate: 0, visibilityScore: 0, avgPosition: 0 };
  }

  const mentionRate = Math.round((prompts.filter((prompt) => prompt.mention).length / prompts.length) * 100);
  const visibilityScore = Math.round(prompts.reduce((acc, prompt) => acc + prompt.score, 0) / prompts.length);
  const rankedPrompts = prompts.filter((prompt) => typeof prompt.rank === "number");
  const avgPosition = rankedPrompts.length > 0
    ? Number((rankedPrompts.reduce((acc, prompt) => acc + (prompt.rank ?? 0), 0) / rankedPrompts.length).toFixed(1))
    : 0;

  return { mentionRate, visibilityScore, avgPosition };
}

export function getSentimentCounts(prompts: Array<{ sentiment?: string }>) {
  return prompts.reduce(
    (acc, prompt) => {
      const sentiment = prompt.sentiment?.trim().toLowerCase();
      if (sentiment === "positive") acc.positive += 1;
      else if (sentiment === "negative") acc.negative += 1;
      else acc.neutral += 1;
      return acc;
    },
    { positive: 0, neutral: 0, negative: 0 },
  );
}

export function buildTopCitedPagesFromPrompts(prompts: Array<Pick<RecentPrompt, "citedUrls">>) {
  const citedPagesCount = new Map<string, number>();

  for (const prompt of prompts) {
    for (const rawUrl of prompt.citedUrls || []) {
      const pagePath = toDisplayPagePath(rawUrl);
      if (!pagePath) continue;
      citedPagesCount.set(pagePath, (citedPagesCount.get(pagePath) ?? 0) + 1);
    }
  }

  const totalCitations = Array.from(citedPagesCount.values()).reduce((acc, value) => acc + value, 0);
  if (totalCitations === 0) return [];

  return Array.from(citedPagesCount.entries())
    .map(([url, count]) => ({
      url,
      value: Math.max(0, Math.round((count / totalCitations) * 100)),
    }))
    .sort((a, b) => b.value - a.value || a.url.localeCompare(b.url));
}
