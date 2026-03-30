import type { DateRange } from "react-day-picker";

import type { MonitoringPrompt } from "@/hooks/use-monitoring-data";

import type { MonitoringFiltersSnapshot } from "./use-monitoring-filters";

type AudiencePrompt = Pick<
  MonitoringPrompt,
  "modelId" | "persona" | "competitorsMentioned" | "mention"
>;

type PeriodPrompt = Pick<MonitoringPrompt, "time"> & { createdAt?: string };

type AudienceFilters = Pick<
  MonitoringFiltersSnapshot,
  "selectedModels" | "selectedPersonas" | "selectedCompetitors"
>;

export function normalizeFilterValue(value: string): string {
  return value.trim().toLowerCase();
}

export function matchesPromptAudienceFilters(
  prompt: AudiencePrompt,
  selectedModels: string[],
  selectedPersonas: string[],
  selectedCompetitors: string[],
): boolean {
  const matchesModel =
    selectedModels.length === 0 || selectedModels.includes(prompt.modelId);
  // Persona filtering is intentionally paused for now.
  const matchesPersona = true;
  const promptCompetitors = (prompt.competitorsMentioned || []).map(
    normalizeFilterValue,
  );
  const matchesCompetitor =
    selectedCompetitors.length === 0 ||
    (prompt.mention &&
      selectedCompetitors.some((competitor) =>
        promptCompetitors.includes(normalizeFilterValue(competitor)),
      ));

  return matchesModel && matchesPersona && matchesCompetitor;
}

export function filterPromptsByAudience<T extends AudiencePrompt>(
  prompts: T[],
  filters: AudienceFilters,
): T[] {
  return prompts.filter((prompt) =>
    matchesPromptAudienceFilters(
      prompt,
      filters.selectedModels,
      filters.selectedPersonas,
      filters.selectedCompetitors,
    ),
  );
}

export function promptIsInPeriod(promptTime: string, period: string): boolean {
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

export function getPromptPeriodRange(
  period: string,
  dateRange?: DateRange,
): { from: Date; to: Date } | null {
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
  prompt: PeriodPrompt,
  period: string,
  dateRange?: DateRange,
): boolean {
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

export function filterPromptsByScope<T extends AudiencePrompt & PeriodPrompt>(
  prompts: T[],
  filters: MonitoringFiltersSnapshot,
  options?: {
    applyPeriod?: boolean;
    selectedCompetitors?: string[];
  },
): T[] {
  const selectedCompetitors =
    options?.selectedCompetitors ?? filters.selectedCompetitors;
  const audienceScopedPrompts = filterPromptsByAudience(prompts, {
    selectedModels: filters.selectedModels,
    selectedPersonas: filters.selectedPersonas,
    selectedCompetitors,
  });

  if (options?.applyPeriod === false) {
    return audienceScopedPrompts;
  }

  return audienceScopedPrompts.filter((prompt) =>
    promptIsInPeriodWithDateRange(prompt, filters.period, filters.dateRange),
  );
}
