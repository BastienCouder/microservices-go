import type { DateRange } from "react-day-picker";

import {
  buildProjectModelFilterItems,
  buildSelectedProjectModelFilterIds,
} from "@/lib/project-models";
import type { MonitoringFiltersSnapshot } from "../shared/use-monitoring-filters";
import {
  filterPromptsByAudience,
  getPromptPeriodRange,
  normalizeFilterValue,
  promptIsInPeriodWithDateRange,
} from "../shared/prompt-filters";
import type {
  FilterModelCard,
  FilterModelItem,
  MonitoringModel,
  MonitoringProject,
  MonitoringPrompt,
  PersonaOption,
} from "./types";

type CompetitorMetrics = {
  name: string;
  mentions: number;
  previousMentions: number;
  mentionRate: number;
  previousMentionRate: number;
};

const MODEL_FILTER_LABEL_COLLATOR = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

function inExplicitRange(
  prompt: Pick<MonitoringPrompt, "createdAt">,
  start: Date,
  end: Date,
): boolean {
  if (!prompt.createdAt) return false;

  const createdAt = new Date(prompt.createdAt);
  if (Number.isNaN(createdAt.getTime())) return false;

  return createdAt >= start && createdAt <= end;
}

function getPreviousRange(period: string, dateRange: DateRange | undefined) {
  const currentRange = getPromptPeriodRange(period, dateRange);
  if (!currentRange) return null;

  const rangeMs = Math.max(1, currentRange.to.getTime() - currentRange.from.getTime());

  return {
    start: new Date(currentRange.from.getTime() - rangeMs),
    end: new Date(currentRange.from.getTime() - 1),
  };
}

function getCompetitorMetrics(
  prompts: MonitoringPrompt[],
  competitorName: string,
): { mentions: number; mentionRate: number } {
  const normalizedCompetitor = normalizeFilterValue(competitorName);
  const mentions = prompts.filter((prompt) =>
    (prompt.competitorsMentioned || []).some(
      (name) => normalizeFilterValue(name) === normalizedCompetitor,
    ),
  ).length;

  return {
    mentions,
    mentionRate: prompts.length > 0 ? (mentions / prompts.length) * 100 : 0,
  };
}

export function buildPersonaOptions(
  projectPersonas: string[],
  prompts: MonitoringPrompt[],
): PersonaOption[] {
  return Array.from(
    new Set([
      ...projectPersonas.map((persona) => persona.trim()),
      ...prompts.map((prompt) => prompt.persona.trim()),
    ].filter(Boolean)),
  ).map((persona) => ({
    id: persona,
    label: persona.charAt(0).toUpperCase() + persona.slice(1),
  }));
}

export function buildVisibleModelFilterItems(
  models: MonitoringModel[],
  showUniqueModelFilters: boolean,
): FilterModelItem[] {
  const items = buildProjectModelFilterItems(models, showUniqueModelFilters);

  return [...items].sort((left, right) => {
    const leftLabel = showUniqueModelFilters
      ? left.displayName || left.groupName || left.id
      : left.groupName || left.displayName || left.id;
    const rightLabel = showUniqueModelFilters
      ? right.displayName || right.groupName || right.id
      : right.groupName || right.displayName || right.id;

    const compareByLabel = MODEL_FILTER_LABEL_COLLATOR.compare(
      leftLabel.trim(),
      rightLabel.trim(),
    );
    if (compareByLabel !== 0) return compareByLabel;

    return MODEL_FILTER_LABEL_COLLATOR.compare(left.id, right.id);
  });
}

export function buildModelCards(
  items: FilterModelItem[],
  showUniqueModelFilters: boolean,
): FilterModelCard[] {
  return items.map((model) => ({
    id: model.id,
    name: showUniqueModelFilters ? model.displayName : "",
    description: model.description,
    icon: model.iconPath,
    live: model.live,
    modelGroup: model.groupName,
  }));
}

export function buildSelectedModelFilterIds(
  selectedModels: string[],
  visibleModelFilterItems: FilterModelItem[],
  showUniqueModelFilters: boolean,
): string[] {
  return buildSelectedProjectModelFilterIds(
    selectedModels,
    visibleModelFilterItems,
    showUniqueModelFilters,
  );
}

export function buildProjectWithDynamicCompetitors(
  project: MonitoringProject,
  recentPrompts: MonitoringPrompt[],
  filters: Pick<
    MonitoringFiltersSnapshot,
    "selectedModels" | "selectedPersonas" | "period" | "dateRange"
  >,
): MonitoringProject {
  const scopedPrompts = filterPromptsByAudience(recentPrompts, {
    selectedModels: filters.selectedModels,
    selectedPersonas: filters.selectedPersonas,
    selectedCompetitors: [],
  });
  const periodPrompts = scopedPrompts.filter((prompt) =>
    promptIsInPeriodWithDateRange(prompt, filters.period, filters.dateRange),
  );
  const previousRange = getPreviousRange(filters.period, filters.dateRange);
  const previousPeriodPrompts = previousRange
    ? scopedPrompts.filter((prompt) =>
        inExplicitRange(prompt, previousRange.start, previousRange.end),
      )
    : [];

  const competitorMetrics: CompetitorMetrics[] = project.competitors.map((competitor) => {
    const current = getCompetitorMetrics(periodPrompts, competitor.name);
    const previous = getCompetitorMetrics(previousPeriodPrompts, competitor.name);

    return {
      name: competitor.name,
      mentions: current.mentions,
      previousMentions: previous.mentions,
      mentionRate: current.mentionRate,
      previousMentionRate: previous.mentionRate,
    };
  });

  const totalMentions = competitorMetrics.reduce(
    (sum, competitor) => sum + competitor.mentions,
    0,
  );
  const competitorShareMap = new Map(
    competitorMetrics.map((competitor) => [
      competitor.name,
      totalMentions > 0
        ? Number(((competitor.mentions / totalMentions) * 100).toFixed(1))
        : 0,
    ]),
  );

  return {
    ...project,
    competitors: project.competitors.map((competitor) => {
      const current = competitorMetrics.find(
        (item) => item.name === competitor.name,
      );
      const deltaRate =
        (current?.mentionRate ?? 0) - (current?.previousMentionRate ?? 0);
      const deltaMentions =
        (current?.mentions ?? 0) - (current?.previousMentions ?? 0);

      let trend: "up" | "down" | "stable" = competitor.trend ?? "stable";
      if (deltaRate > 0.5 || deltaMentions > 0) trend = "up";
      else if (deltaRate < -0.5 || deltaMentions < 0) trend = "down";

      return {
        ...competitor,
        sov: competitorShareMap.get(competitor.name) ?? competitor.sov,
        trend,
      };
    }),
  };
}
