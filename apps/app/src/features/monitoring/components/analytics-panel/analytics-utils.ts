import { DASHBOARD_TEXT } from "@/lib/app-data";
import { type DashboardPrompt } from "@/hooks/use-dashboard-data";
import { type ChartConfig } from "@/components/ui/chart";
import type { DateRange } from "react-day-picker";

export const chartConfig = {
  chatgpt: { label: DASHBOARD_TEXT.chartConfig.models.chatgpt, color: "hsl(var(--chart-brand-primary))" },
  perplexity: { label: DASHBOARD_TEXT.chartConfig.models.perplexity, color: "hsl(var(--chart-series-2))" },
  claude: { label: DASHBOARD_TEXT.chartConfig.models.claude, color: "hsl(var(--chart-series-3))" },
  gemini: { label: DASHBOARD_TEXT.chartConfig.models.gemini, color: "hsl(var(--chart-series-4))" },
  mistral: { label: DASHBOARD_TEXT.chartConfig.models.mistral, color: "hsl(var(--chart-series-5))" },
  copilot: { label: DASHBOARD_TEXT.chartConfig.models.copilot, color: "hsl(var(--chart-series-6))" },
  brand: { label: DASHBOARD_TEXT.chartConfig.brands.brand, color: "hsl(var(--chart-brand-primary))" },
  comp1: { label: DASHBOARD_TEXT.chartConfig.brands.comp1, color: "hsl(var(--chart-series-2))" },
  comp2: { label: DASHBOARD_TEXT.chartConfig.brands.comp2, color: "hsl(var(--chart-series-3))" },
  other: { label: DASHBOARD_TEXT.chartConfig.brands.other, color: "hsl(var(--muted))" },
  sentiment: { label: DASHBOARD_TEXT.chartConfig.sentiment.sentiment, color: "hsl(var(--chart-brand-primary))" },
  positive: { label: DASHBOARD_TEXT.chartConfig.sentiment.positive, color: "hsl(var(--chart-sentiment-positive))" },
  neutral: { label: DASHBOARD_TEXT.chartConfig.sentiment.neutral, color: "hsl(var(--chart-sentiment-neutral))" },
  negative: { label: DASHBOARD_TEXT.chartConfig.sentiment.negative, color: "hsl(var(--chart-sentiment-negative))" },
} satisfies ChartConfig;

export type RecentPrompt = DashboardPrompt;

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

export function matchesPromptAudienceFilters(
  prompt: Pick<RecentPrompt, "modelId" | "persona" | "competitorsMentioned" | "mention">,
  selectedModels: string[],
  selectedPersonas: string[],
  selectedCompetitors: string[],
) {
  const matchesModel = selectedModels.length === 0 || selectedModels.includes(prompt.modelId);
  const matchesPersona = selectedPersonas.length === 0 || selectedPersonas.includes(prompt.persona);
  const promptCompetitors = (prompt.competitorsMentioned || []).map((name) => name.trim().toLowerCase());
  const matchesCompetitor =
    selectedCompetitors.length === 0 ||
    (prompt.mention &&
      selectedCompetitors.some((competitor) => promptCompetitors.includes(competitor.trim().toLowerCase())));

  return matchesModel && matchesPersona && matchesCompetitor;
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

export function promptIsInPeriod(promptTime: string, period: string) {
  if (!promptTime) return true;
  const normalized = promptTime.trim().toLowerCase();
  const match = normalized.match(/^(\d+)\s*(m|h|d)$/);
  if (!match) return true;

  const amount = Number(match[1]);
  const unit = match[2];
  let hours = amount;
  if (unit === "m") hours = amount / 60;
  if (unit === "d") hours = amount * 24;

  if (period === "today" || period === "24h") return hours <= 24;
  if (period === "7d") return hours <= 24 * 7;
  if (period === "14d") return hours <= 24 * 14;
  if (period === "30d") return hours <= 24 * 30;
  if (period === "90d") return hours <= 24 * 90;
  return true;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function getPromptPeriodRange(period: string, dateRange?: DateRange): { from: Date; to: Date } | null {
  const now = new Date();

  if (period === "custom") {
    if (!dateRange?.from) return null;
    return {
      from: startOfDay(dateRange.from),
      to: endOfDay(dateRange.to ?? dateRange.from),
    };
  }

  const from = new Date(now);
  if (period === "today" || period === "24h") from.setHours(from.getHours() - 24);
  else if (period === "14d") from.setDate(from.getDate() - 14);
  else if (period === "30d") from.setDate(from.getDate() - 30);
  else if (period === "90d") from.setDate(from.getDate() - 90);
  else from.setDate(from.getDate() - 7);

  return { from, to: now };
}

export function promptIsInPeriodWithDateRange(
  prompt: Pick<RecentPrompt, "time"> & { createdAt?: string },
  period: string,
  dateRange?: DateRange,
) {
  if (prompt.createdAt) {
    const createdAt = new Date(prompt.createdAt);
    if (!Number.isNaN(createdAt.getTime())) {
      const range = getPromptPeriodRange(period, dateRange);
      if (!range) return true;
      return createdAt >= range.from && createdAt <= range.to;
    }
  }

  return promptIsInPeriod(prompt.time, period);
}
