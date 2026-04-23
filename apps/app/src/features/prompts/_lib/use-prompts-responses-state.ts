"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";
import { useMonitoringData } from "@/hooks/use-monitoring-data";
import { appQueryKeys } from "@/lib/query-keys";
import {
  buildPromptPlanUsageSummary,
  buildSimulatedPromptPlanUsageSummary,
  readPromptPlan,
} from "./prompt-plan";
import { loadPromptQuotaUsage } from "./prompt-quota";
import {
  getPromptSelectionKey,
  readSelectedOrganizationId,
  RESPONSES_BATCH_SIZE,
} from "./prompt-normalizers";
import { DEFAULT_PROMPT_PERIOD, rankTone, statusBadgeClassName, truncate } from "./utils";
import { usePromptsDerivedState } from "./use-prompts-derived-state";
import { usePromptsMutations } from "./use-prompts-mutations";
import { usePromptsSourceData } from "./use-prompts-source-data";
import type {
  AIModel,
  PeriodKey,
  Persona,
  PromptItem,
  PromptRowMode,
  PromptSort,
  PromptSortDirection,
  ResponseView,
} from "./types";

export function usePromptsResponsesState(apiBaseURL: string) {
  const queryClient = useQueryClient();
  const { data: monitoringData, mode, projectId } = useMonitoringData();
  const [organizationId, setOrganizationId] = useState("");
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PROMPT_PERIOD);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [tab, setTab] = useState<"prompts" | "responses">("prompts");
  const [persona, setPersona] = useState<"all" | Persona>("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [selectedPromptModels, setSelectedPromptModels] = useState<AIModel[]>([]);
  const [selectedResponseModels, setSelectedResponseModels] = useState<AIModel[]>([]);
  const [promptSort, setPromptSort] = useState<PromptSort>("mention");
  const [promptSortDirection, setPromptSortDirection] = useState<PromptSortDirection>("desc");
  const [viewMode, setViewMode] = useState<ResponseView>("table");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [noMentionOnly, setNoMentionOnly] = useState(false);
  const [showHistorical, setShowHistorical] = useState(true);
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [isPromptDetailsOpen, setIsPromptDetailsOpen] = useState(false);
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const [focusPromptId, setFocusPromptId] = useState<string | null>(null);
  const [manualPrompts, setManualPrompts] = useState<PromptItem[]>([]);
  const [modelsPopoverOpen, setModelsPopoverOpen] = useState(false);
  const [promptPage, setPromptPage] = useState(1);
  const [promptRowMode, setPromptRowMode] = useState<PromptRowMode>("global");
  const [showArchived, setShowArchived] = useState(false);
  const [responseVisibleCount, setResponseVisibleCount] = useState(RESPONSES_BATCH_SIZE);
  const [hiddenPromptIds, setHiddenPromptIds] = useState<string[]>([]);
  const [promptEditorState, setPromptEditorState] = useState<{ mode: "create" | "edit"; promptId?: string } | null>(null);
  const [editingPromptModelsId, setEditingPromptModelsId] = useState<string | null>(null);
  const [editingPromptScheduleId, setEditingPromptScheduleId] = useState<string | null>(null);
  const [runningPromptRowIds, setRunningPromptRowIds] = useState<string[]>([]);

  useEffect(() => {
    setOrganizationId(readSelectedOrganizationId());
  }, []);

  const source = usePromptsSourceData({
    apiBaseURL,
    organizationId,
    monitoringData,
    projectId: projectId ?? null,
    deferredSearch,
    promptSort,
    promptSortDirection,
  });

  useEffect(() => {
    if (source.promptAvailableModels.length === 0) return;
    setSelectedPromptModels((current) => {
      const kept = current.filter((model) => source.promptAvailableModels.includes(model));
      return kept.length > 0 ? kept : source.promptAvailableModels;
    });
  }, [source.promptAvailableModels]);

  useEffect(() => {
    if (source.responseAvailableModels.length === 0) return;
    setSelectedResponseModels((current) => {
      const kept = current.filter((model) => source.responseAvailableModels.includes(model));
      return kept.length > 0 ? kept : source.responseAvailableModels;
    });
  }, [source.responseAvailableModels]);

  const promptQuotaQuery = useQuery({
    queryKey: appQueryKeys.promptQuota(apiBaseURL, organizationId, source.activeProjectId),
    enabled:
      apiBaseURL.trim() !== "" &&
      organizationId.trim() !== "" &&
      source.activeProjectId !== null,
    queryFn: ({ signal }) =>
      loadPromptQuotaUsage(apiBaseURL, source.activeProjectId!, organizationId, { signal }),
  });

  const derived = usePromptsDerivedState({
    monitoringData,
    activeModelKeys: source.activeModelKeys,
    deferredSearch,
    manualPrompts,
    hiddenPromptIds,
    serverPromptItems: source.serverPromptItems,
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
    responseAvailableModels: source.responseAvailableModels,
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
    promptAvailableModels: source.promptAvailableModels,
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
  });

  const fallbackPromptPlanUsage = buildSimulatedPromptPlanUsageSummary({
    plan: readPromptPlan(organizationId),
    usedPrompts: promptQuotaQuery.data?.usedPrompts ?? monitoringData.recent_prompts.length,
  });

  const promptPlanUsage =
    promptQuotaQuery.data?.hasQuota
      ? buildPromptPlanUsageSummary({
          limit: promptQuotaQuery.data.monthlyQuota,
          usedPrompts: promptQuotaQuery.data.usedPrompts,
        })
      : fallbackPromptPlanUsage;

  const mutations = usePromptsMutations({
    apiBaseURL,
    queryClient,
    mode,
    organizationId,
    activeProjectId: source.activeProjectId,
    quotaReached: promptPlanUsage.isLimitReached,
    deferredSearch,
    promptSort,
    promptSortDirection,
    promptAvailableModels: source.promptAvailableModels,
    availablePersonas: source.availablePersonas,
    manualPrompts,
    persistedPromptIds: source.persistedPromptIds,
    setManualPrompts,
    setPromptPage,
    setPromptEditorState,
    setEditingPromptModelsId,
    setEditingPromptScheduleId,
    setHiddenPromptIds,
    setSelectedPromptIds,
    setSelectedPromptId,
    setRunningPromptRowIds,
  });

  const runnableSelectedPrompts = derived.selectedPromptRows.filter((item) =>
    mutations.canRunPrompt(item),
  );
  const runningSelectedPrompts =
    runnableSelectedPrompts.length > 0 &&
    runnableSelectedPrompts.every((item) => runningPromptRowIds.includes(item.id));

  const runPrompt = (prompt: (typeof derived.selectedPromptRows)[number]) => {
    if (!mutations.canRunPrompt(prompt) || mutations.runPromptsMutation.isPending) return;
    mutations.runPromptsMutation.mutate([prompt]);
  };

  const runSelectedPrompts = () => {
    if (runnableSelectedPrompts.length === 0 || mutations.runPromptsMutation.isPending) return;
    mutations.runPromptsMutation.mutate(runnableSelectedPrompts);
  };

  const toggleCompetitor = (competitor: string) => {
    setSelectedCompetitors((current) =>
      current.includes(competitor)
        ? current.filter((item) => item !== competitor)
        : [...current, competitor],
    );
  };

  return {
    mode,
    tab,
    setTab,
    prompts: derived.prompts,
    filteredPrompts: derived.filteredPrompts,
    filteredResponses: derived.visibleResponses,
    filteredResponsesTotal: derived.filteredResponses.length,
    hasMoreResponses: derived.visibleResponses.length < derived.filteredResponses.length,
    loadMoreResponses: derived.loadMoreResponses,
    selectedPrompt: derived.selectedPrompt,
    selectedResponse: derived.selectedResponse,
    selectedPromptIds,
    setSelectedPromptId,
    setSelectedResponseId,
    isPromptDetailsOpen,
    setIsPromptDetailsOpen,
    period,
    setPeriod,
    dateRange,
    setDateRange,
    persona,
    setPersona,
    availablePersonas: source.availablePersonas,
    search,
    setSearch,
    selectedModels: derived.toolbarSelectedModels,
    availableModels: derived.toolbarAvailableModels,
    editorAvailableModels: source.promptAvailableModels,
    allModelsSelected: derived.allModelsSelected,
    modelsPopoverOpen,
    setModelsPopoverOpen,
    showArchived,
    setShowArchived,
    hasActiveGlobalFilters: derived.hasActiveGlobalFilters,
    clearFilters: derived.clearFilters,
    toggleModel: derived.toggleModel,
    promptSort,
    promptSortDirection,
    changePromptSort: derived.changePromptSort,
    promptRowMode,
    setPromptRowMode,
    getPromptSelectionKey: (item: Parameters<typeof getPromptSelectionKey>[0]) =>
      getPromptSelectionKey(item, promptRowMode),
    toggleSelectAllPrompts: derived.toggleSelectAllPrompts,
    togglePromptSelection: derived.togglePromptSelection,
    applyBulkStatus: (status: "active" | "disabled" | "archived") =>
      mutations.applyBulkStatus(status, promptRowMode, selectedPromptIds, derived.prompts),
    setFocusPromptId,
    deletePrompt: (id: string) => mutations.deletePrompt(id, selectedPromptId),
    canRunPrompt: mutations.canRunPrompt,
    runPrompt,
    runSelectedPrompts,
    canRunSelectedPrompts: runnableSelectedPrompts.length > 0,
    selectedRunnablePromptCount: runnableSelectedPrompts.length,
    runningSelectedPrompts,
    runningAnyPrompts: mutations.runPromptsMutation.isPending,
    isPromptRunning: (prompt: { id: string } | null | undefined) =>
      Boolean(prompt && runningPromptRowIds.includes(prompt.id)),
    viewMode,
    setViewMode,
    onlyErrors,
    setOnlyErrors,
    criticalOnly,
    setCriticalOnly,
    noMentionOnly,
    setNoMentionOnly,
    showHistorical,
    setShowHistorical,
    selectedCompetitors,
    toggleCompetitor,
    clearCompetitors: () => setSelectedCompetitors([]),
    availableCompetitors: source.availableCompetitors,
    promptEditorState,
    openCreatePromptEditor: () => setPromptEditorState({ mode: "create" }),
    openEditPromptEditor: (promptId: string) => setPromptEditorState({ mode: "edit", promptId }),
    closePromptEditor: () => {
      if (mutations.savePromptEditorMutation.isPending) return;
      setPromptEditorState(null);
    },
    savePromptEditor: (input: Parameters<typeof mutations.savePromptEditorMutation.mutate>[0]) =>
      mutations.savePromptEditorMutation.mutate(input),
    savingPromptEditor: mutations.savePromptEditorMutation.isPending,
    editingPromptModelsId,
    setEditingPromptModelsId,
    updatePromptModels: mutations.updatePromptModels,
    updatingPromptModels: mutations.updatePromptModelsMutation.isPending,
    editingPromptScheduleId,
    setEditingPromptScheduleId,
    updatePromptSchedule: mutations.updatePromptSchedule,
    updatingPromptSchedule: mutations.updatePromptScheduleMutation.isPending,
    addAutoGeneratedPrompts: mutations.addAutoGeneratedPrompts,
    addImportedPrompts: mutations.addImportedPrompts,
    getModelVisual: source.getModelVisual,
    promptPlanUsage,
    promptPage,
    setPromptPage,
    promptTotalItems: derived.promptTotalItems,
    promptTotalPages: derived.promptTotalPages,
    canPreviousPromptPage: promptPage > 1,
    canNextPromptPage: promptPage < derived.promptTotalPages,
    promptsLoading:
      source.promptsCatalogQuery.isLoading ||
      (source.promptsCatalogQuery.isFetching && !source.promptsCatalogQuery.data) ||
      mutations.bulkPromptStatusMutation.isPending ||
      mutations.savePromptEditorMutation.isPending ||
      mutations.deletePromptMutation.isPending ||
      mutations.updatePromptModelsMutation.isPending ||
      mutations.updatePromptScheduleMutation.isPending,
    rankTone,
    statusBadgeClassName,
    truncate,
  };
}
