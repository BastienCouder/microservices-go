"use client";

import { useMemo } from "react";
import { differenceInCalendarDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  buildModelScopedPromptRows,
  buildScopedPromptMetrics,
  getPromptSelectionKey,
  PROMPTS_PAGE_SIZE,
  sortPromptItems,
} from "./prompt-normalizers";
import { buildResponseRows } from "./prompt-data-factory";
import { buildPromptsDerivedActions } from "./prompt-derived-actions";
import { usePromptsDerivedEffects } from "./use-prompts-derived-effects";
import { DEFAULT_PROMPT_PERIOD, normalizeModelName, PERIOD_TO_MINUTES, STAGES } from "./utils";
import type { AIModel, PeriodKey, PromptItem, PromptRowMode, PromptSort, PromptSortDirection } from "./types";

type MonitoringDataShape = {
  project: {
    competitors: Array<{ name: string }>;
  };
  recent_prompts: unknown[];
};

type UsePromptsDerivedStateParams = {
  monitoringData: MonitoringDataShape;
  activeModelKeys: Set<string>;
  deferredSearch: string;
  manualPrompts: PromptItem[];
  hiddenPromptIds: string[];
  serverPromptItems: PromptItem[];
  promptRowMode: PromptRowMode;
  period: PeriodKey;
  dateRange: DateRange | undefined;
  selectedPromptModels: AIModel[];
  promptSort: PromptSort;
  promptSortDirection: PromptSortDirection;
  showArchived: boolean;
  promptPage: number;
  selectedPromptIds: string[];
  search: string;
  responseAvailableModels: AIModel[];
  selectedResponseModels: AIModel[];
  onlyErrors: boolean;
  criticalOnly: boolean;
  noMentionOnly: boolean;
  showHistorical: boolean;
  selectedCompetitors: string[];
  focusPromptId: string | null;
  responseVisibleCount: number;
  selectedPromptId: string | null;
  selectedResponseId: string | null;
  tab: "prompts" | "responses";
  promptAvailableModels: AIModel[];
  setPromptPage: (value: number) => void;
  setSelectedPromptIds: (value: string[] | ((current: string[]) => string[])) => void;
  setSelectedPromptId: (value: string | null | ((current: string | null) => string | null)) => void;
  setResponseVisibleCount: (value: number | ((current: number) => number)) => void;
  setPeriod: (value: PeriodKey) => void;
  setDateRange: (value: DateRange | undefined) => void;
  setSelectedPromptModels: (value: AIModel[] | ((current: AIModel[]) => AIModel[])) => void;
  setSelectedResponseModels: (value: AIModel[] | ((current: AIModel[]) => AIModel[])) => void;
  setPersona: (value: "all" | string) => void;
  setShowArchived: (value: boolean) => void;
  setSearch: (value: string) => void;
  setOnlyErrors: (value: boolean) => void;
  setCriticalOnly: (value: boolean) => void;
  setNoMentionOnly: (value: boolean) => void;
  setShowHistorical: (value: boolean) => void;
  setSelectedCompetitors: (value: string[] | ((current: string[]) => string[])) => void;
  setFocusPromptId: (value: string | null) => void;
  setPromptSort: (value: PromptSort) => void;
  setPromptSortDirection: (value: PromptSortDirection | ((current: PromptSortDirection) => PromptSortDirection)) => void;
};

export function usePromptsDerivedState({
  monitoringData,
  activeModelKeys,
  deferredSearch,
  manualPrompts,
  hiddenPromptIds,
  serverPromptItems,
  promptRowMode,
  period,
  dateRange,
  selectedPromptModels,
  promptSort,
  promptSortDirection,
  showArchived,
  promptPage,
  selectedPromptIds,
  search,
  responseAvailableModels,
  selectedResponseModels,
  onlyErrors,
  criticalOnly,
  noMentionOnly,
  showHistorical,
  selectedCompetitors,
  focusPromptId,
  responseVisibleCount,
  selectedPromptId,
  selectedResponseId,
  tab,
  promptAvailableModels,
  setPromptPage,
  setSelectedPromptIds,
  setSelectedPromptId,
  setResponseVisibleCount,
  setPeriod,
  setDateRange,
  setSelectedPromptModels,
  setSelectedResponseModels,
  setPersona,
  setShowArchived,
  setSearch,
  setOnlyErrors,
  setCriticalOnly,
  setNoMentionOnly,
  setShowHistorical,
  setSelectedCompetitors,
  setFocusPromptId,
  setPromptSort,
  setPromptSortDirection,
}: UsePromptsDerivedStateParams) {
  const basePrompts = useMemo(() => {
    const searchLower = deferredSearch.toLowerCase();
    const visibleManualPrompts = manualPrompts.filter((item) =>
      searchLower === "" ? true : item.prompt.toLowerCase().includes(searchLower),
    );
    const merged = [...visibleManualPrompts, ...serverPromptItems];
    return merged
      .filter((item) => !hiddenPromptIds.includes(item.sourcePromptId || item.id))
      .map((item) => buildScopedPromptMetrics(item, item.models));
  }, [deferredSearch, hiddenPromptIds, manualPrompts, serverPromptItems]);

  const prompts = useMemo(
    () => (promptRowMode === "global" ? basePrompts : buildModelScopedPromptRows(basePrompts)),
    [basePrompts, promptRowMode],
  );

  const allResponses = useMemo(
    () =>
      buildResponseRows({
        recentPrompts: monitoringData.recent_prompts as never,
        competitors: monitoringData.project.competitors,
        availableModels: responseAvailableModels,
        stages: STAGES,
      }).map((item) => ({
        ...item,
        isHistorical: !activeModelKeys.has(normalizeModelName(item.model)),
      })),
    [
      activeModelKeys,
      monitoringData.project.competitors,
      monitoringData.recent_prompts,
      responseAvailableModels,
    ],
  );

  const rangeMinutes = useMemo(() => {
    if (period === "ytd") {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const days = Math.max(1, differenceInCalendarDays(now, startOfYear) + 1);
      return days * 24 * 60;
    }
    if (period !== "custom") return PERIOD_TO_MINUTES[period];
    if (!dateRange?.from) return PERIOD_TO_MINUTES["90d"];
    const to = dateRange.to ?? dateRange.from;
    const days = Math.max(1, differenceInCalendarDays(to, dateRange.from) + 1);
    return days * 24 * 60;
  }, [dateRange, period]);

  const filteredPromptRows = useMemo(() => {
    const searchLower = deferredSearch.toLowerCase();
    const rows = prompts.filter((item) => {
      const matchesModel =
        selectedPromptModels.length === 0 ||
        item.models.length === 0 ||
        item.models.some((model) => selectedPromptModels.includes(model));
      const matchesSearch = searchLower === "" || item.prompt.toLowerCase().includes(searchLower);
      const matchesArchive = showArchived || item.status !== "archived";
      return matchesModel && matchesSearch && matchesArchive;
    });

    return sortPromptItems(rows, promptSort, promptSortDirection);
  }, [
    deferredSearch,
    promptSort,
    promptSortDirection,
    prompts,
    selectedPromptModels,
    showArchived,
  ]);

  const selectedPromptRows = useMemo(
    () =>
      filteredPromptRows.filter((item) =>
        selectedPromptIds.includes(getPromptSelectionKey(item, promptRowMode)),
      ),
    [filteredPromptRows, promptRowMode, selectedPromptIds],
  );

  const promptTotalItems = filteredPromptRows.length;
  const promptTotalPages = Math.max(1, Math.ceil(promptTotalItems / PROMPTS_PAGE_SIZE));

  const filteredPrompts = useMemo(() => {
    const start = (promptPage - 1) * PROMPTS_PAGE_SIZE;
    return filteredPromptRows.slice(start, start + PROMPTS_PAGE_SIZE);
  }, [filteredPromptRows, promptPage]);

  const filteredResponses = useMemo(() => {
    const searchLower = search.toLowerCase().trim();
    return allResponses
      .filter((item) => {
        const matchesPeriod = item.minutesAgo <= rangeMinutes;
        const matchesModel =
          selectedResponseModels.length === 0 || selectedResponseModels.includes(item.model);
        const matchesSearch = searchLower.length === 0 || item.prompt.toLowerCase().includes(searchLower);
        const matchesError = !onlyErrors || Boolean(item.error);
        const matchesCritical = !criticalOnly || item.critical;
        const matchesNoMention = !noMentionOnly || !item.mention;
        const matchesHistory = showHistorical || !item.isHistorical;
        const matchesCompetitor =
          selectedCompetitors.length === 0 ||
          selectedCompetitors.some(
            (competitor) =>
              item.competitors.includes(competitor) || item.competitor === competitor,
          );
        const matchesFocusedPrompt = !focusPromptId || item.promptId === focusPromptId;
        return (
          matchesPeriod &&
          matchesModel &&
          matchesSearch &&
          matchesError &&
          matchesCritical &&
          matchesNoMention &&
          matchesHistory &&
          matchesCompetitor &&
          matchesFocusedPrompt
        );
      })
      .sort((a, b) => a.minutesAgo - b.minutesAgo);
  }, [
    allResponses,
    criticalOnly,
    focusPromptId,
    noMentionOnly,
    onlyErrors,
    rangeMinutes,
    search,
    selectedResponseModels,
    showHistorical,
    selectedCompetitors,
  ]);

  usePromptsDerivedEffects({
    deferredSearch,
    period,
    dateRangeFrom: dateRange?.from?.toISOString(),
    dateRangeTo: dateRange?.to?.toISOString(),
    selectedPromptModelsKey: selectedPromptModels.join("|"),
    promptRowMode,
    showArchived,
    promptSort,
    promptSortDirection,
    setPromptPage,
    setSelectedPromptIds,
    promptPage,
    promptTotalPages,
    filteredPromptRows,
    selectedResponseModelsKey: selectedResponseModels.join("|"),
    focusPromptId,
    noMentionOnly,
    onlyErrors,
    criticalOnly,
    showHistorical,
    selectedCompetitorsKey: selectedCompetitors.join("|"),
    search,
    setSelectedPromptId,
    setResponseVisibleCount,
    filteredResponsesLength: filteredResponses.length,
  });

  const visibleResponses = useMemo(
    () => filteredResponses.slice(0, responseVisibleCount),
    [filteredResponses, responseVisibleCount],
  );

  const selectedPrompt = filteredPromptRows.find((item) => item.id === selectedPromptId) ?? null;
  const selectedResponse = allResponses.find((item) => item.id === selectedResponseId) ?? null;
  const toolbarAvailableModels = tab === "responses" ? responseAvailableModels : promptAvailableModels;
  const toolbarSelectedModels = tab === "responses" ? selectedResponseModels : selectedPromptModels;
  const allModelsSelected =
    toolbarAvailableModels.length > 0 &&
    toolbarSelectedModels.length === toolbarAvailableModels.length &&
    toolbarAvailableModels.every((model) => toolbarSelectedModels.includes(model));

  const hasActiveGlobalFilters =
    showArchived ||
    search.trim().length > 0 ||
    toolbarSelectedModels.length !== toolbarAvailableModels.length ||
    toolbarAvailableModels.some((model) => !toolbarSelectedModels.includes(model)) ||
    (tab === "responses" &&
      (period !== DEFAULT_PROMPT_PERIOD || !showHistorical || selectedCompetitors.length > 0));

  const actions = buildPromptsDerivedActions({
    allModelsSelected,
    tab,
    promptRowMode,
    filteredPrompts,
    filteredResponsesLength: filteredResponses.length,
    promptSort,
    promptAvailableModels,
    responseAvailableModels,
    setPeriod,
    setDateRange,
    setSelectedPromptModels,
    setSelectedResponseModels,
    setPersona,
    setShowArchived,
    setSearch,
    setOnlyErrors,
    setCriticalOnly,
    setNoMentionOnly,
    setShowHistorical,
    setSelectedCompetitors,
    setFocusPromptId,
    setPromptPage,
    setSelectedPromptIds,
    setPromptSort,
    setPromptSortDirection,
    setResponseVisibleCount,
  });

  return {
    editorPrompts: basePrompts,
    prompts: filteredPromptRows,
    filteredPrompts,
    allResponses,
    filteredResponses,
    visibleResponses,
    selectedPromptRows,
    selectedPrompt,
    selectedResponse,
    toolbarAvailableModels,
    toolbarSelectedModels,
    allModelsSelected,
    hasActiveGlobalFilters,
    promptTotalItems,
    promptTotalPages,
    ...actions,
  };
}
