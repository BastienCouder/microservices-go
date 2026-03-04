import { DASHBOARD_TEXT } from "@/lib/app-data";
import { type DashboardPrompt } from "@/hooks/use-dashboard-data";
import { type ChartConfig } from "@/components/ui/chart";
import type { DateRange } from "react-day-picker";

export const chartConfig = {
  chatgpt: { label: DASHBOARD_TEXT.chartConfig.models.chatgpt, color: "hsl(var(--primary))" },
  perplexity: { label: DASHBOARD_TEXT.chartConfig.models.perplexity, color: "hsl(200, 90%, 45%)" },
  claude: { label: DASHBOARD_TEXT.chartConfig.models.claude, color: "hsl(230, 85%, 60%)" },
  gemini: { label: DASHBOARD_TEXT.chartConfig.models.gemini, color: "hsl(190, 80%, 50%)" },
  mistral: { label: DASHBOARD_TEXT.chartConfig.models.mistral, color: "hsl(210, 90%, 55%)" },
  copilot: { label: DASHBOARD_TEXT.chartConfig.models.copilot, color: "hsl(240, 75%, 65%)" },
  brand: { label: DASHBOARD_TEXT.chartConfig.brands.brand, color: "hsl(var(--primary))" },
  comp1: { label: DASHBOARD_TEXT.chartConfig.brands.comp1, color: "hsl(200, 50%, 40%)" },
  comp2: { label: DASHBOARD_TEXT.chartConfig.brands.comp2, color: "hsl(220, 40%, 40%)" },
  other: { label: DASHBOARD_TEXT.chartConfig.brands.other, color: "hsl(var(--muted))" },
  sentiment: { label: DASHBOARD_TEXT.chartConfig.sentiment.sentiment, color: "hsl(var(--primary))" },
  positive: { label: DASHBOARD_TEXT.chartConfig.sentiment.positive, color: "hsl(var(--primary))" },
  neutral: { label: DASHBOARD_TEXT.chartConfig.sentiment.neutral, color: "hsl(200, 90%, 45%)" },
  negative: { label: DASHBOARD_TEXT.chartConfig.sentiment.negative, color: "hsl(230, 85%, 60%)" },
} satisfies ChartConfig;

export type RecentPrompt = DashboardPrompt;

export function normalizeModelId(modelName: string) {
  const normalized = modelName.toLowerCase();
  return normalized === "google" ? "gemini" : normalized;
}

export function matchesPromptAudienceFilters(
  prompt: Pick<RecentPrompt, "model" | "persona" | "competitorsMentioned"> & { modelFilterKey?: string },
  selectedModels: string[],
  selectedPersonas: string[],
  selectedCompetitors: string[],
) {
  const promptModel = prompt.modelFilterKey || normalizeModelId(prompt.model);
  const matchesModel = selectedModels.length === 0 || selectedModels.includes(promptModel);
  const matchesPersona = selectedPersonas.length === 0 || selectedPersonas.includes(prompt.persona);
  const promptCompetitors = (prompt.competitorsMentioned || []).map((name) => name.trim().toLowerCase());
  const matchesCompetitor =
    selectedCompetitors.length === 0 ||
    selectedCompetitors.some((competitor) => promptCompetitors.includes(competitor.trim().toLowerCase()));

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

export function promptIsInPeriodWithDateRange(
  prompt: Pick<RecentPrompt, "time"> & { createdAt?: string },
  period: string,
  dateRange?: DateRange,
) {
  if (period === "custom") {
    if (!dateRange?.from) return true;
    if (prompt.createdAt) {
      const createdAt = new Date(prompt.createdAt);
      if (!Number.isNaN(createdAt.getTime())) {
        const from = new Date(dateRange.from);
        from.setHours(0, 0, 0, 0);
        const to = new Date(dateRange.to ?? dateRange.from);
        to.setHours(23, 59, 59, 999);
        return createdAt >= from && createdAt <= to;
      }
    }
    return true;
  }

  return promptIsInPeriod(prompt.time, period);
}
