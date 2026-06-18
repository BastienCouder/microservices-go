"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";
import { useMonitoringData } from "@/features/monitoring/_lib/shared/use-monitoring-data";
import { appQueryKeys } from "@/lib/query-keys";
import {
  readOrganizationIdFromSearch,
  readRouteQueryParam,
  readSelectedOrganizationPublicID,
  SELECTED_CONTEXT_CHANGE_EVENT,
} from "@/shared/selection";
import {
  buildPromptPlanUsageSummary,
  buildSimulatedPromptPlanUsageSummary,
  readPromptPlan,
} from "./prompt-plan";
import { loadPromptQuotaUsage } from "./prompt-quota";
import {
  getPromptSelectionKey,
  RESPONSES_BATCH_SIZE,
} from "./prompt-normalizers";
import { loadAnalysisRuns, type AnalysisRunRecord } from "./prompt-api";
import { resolveBulkPromptIds } from "./prompt-mutation-actions";
import {
  isPromptRunProgressComplete,
  isPromptRunProgressExpired,
  type PromptRunProgressEntry,
} from "./prompt-run-progress";
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

function readOrganizationId(routeSearch: string): string {
  const routeOrganizationId = readOrganizationIdFromSearch(routeSearch);
  if (/^\d+$/.test(routeOrganizationId)) {
    return routeOrganizationId;
  }

  return readSelectedOrganizationPublicID();
}

type PromptsWorkspaceLoadingStateInput = {
  monitoringLoading: boolean;
  promptsCatalogInitialLoading: boolean;
  promptMutationPending: boolean;
};

const FAILED_RUN_STATUSES = new Set(["failed", "errored", "cancelled", "cancelled_due_to_timeout", "cancelled_due_to_limits"]);

export function getPromptsWorkspaceLoadingState({
  monitoringLoading,
  promptsCatalogInitialLoading,
  promptMutationPending,
}: PromptsWorkspaceLoadingStateInput) {
  const promptsDataLoading = monitoringLoading || promptsCatalogInitialLoading;

  return {
    promptsDataLoading,
    responsesDataLoading: monitoringLoading,
    promptsBusy: promptsDataLoading || promptMutationPending,
  };
}

export function usePromptsResponsesState(apiBaseURL: string, routeSearch = "") {
  const queryClient = useQueryClient();
  const {
    data: monitoringData,
    loading: monitoringLoading,
    mode,
    projectId,
    refresh: refreshMonitoringData,
  } = useMonitoringData();
  const [organizationId, setOrganizationId] = useState(() =>
    readOrganizationId(routeSearch),
  );
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
  const [pendingPromptRuns, setPendingPromptRuns] = useState<PromptRunProgressEntry[]>([]);
  const [cancelledAnalysisRunIds, setCancelledAnalysisRunIds] = useState<string[]>([]);

  useEffect(() => {
    setOrganizationId(readOrganizationId(routeSearch));
  }, [routeSearch]);

  useEffect(() => {
    const tabFromUrl = readRouteQueryParam(routeSearch, "tab");
    if (tabFromUrl === "responses" || tabFromUrl === "prompts") {
      setTab(tabFromUrl);
    } else {
      setTab("prompts");
    }
  }, [routeSearch]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncOrganizationId = () => {
      setOrganizationId(readOrganizationId(routeSearch));
    };

    window.addEventListener(SELECTED_CONTEXT_CHANGE_EVENT, syncOrganizationId);
    return () => {
      window.removeEventListener(SELECTED_CONTEXT_CHANGE_EVENT, syncOrganizationId);
    };
  }, [routeSearch]);

  const source = usePromptsSourceData({
    apiBaseURL,
    organizationId,
    monitoringData,
    projectId: projectId ?? null,
    deferredSearch,
    promptSort,
    promptSortDirection,
  });
  const hasActiveProjectId = source.activeProjectId.trim() !== "";

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

  useEffect(() => {
    if (pendingPromptRuns.length === 0) {
      setRunningPromptRowIds([]);
      return;
    }

    const next = pendingPromptRuns.filter((entry) => {
      if (isPromptRunProgressExpired(entry)) return false;
      return !isPromptRunProgressComplete(entry, monitoringData.recent_prompts as never);
    });

    if (next.length !== pendingPromptRuns.length) {
      setPendingPromptRuns(next);
    }
    setRunningPromptRowIds(next.map((entry) => entry.rowId));
  }, [monitoringData.recent_prompts, pendingPromptRuns]);

  useEffect(() => {
    if (pendingPromptRuns.length === 0) return undefined;

    const intervalId = window.setInterval(() => {
      void refreshMonitoringData();
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [pendingPromptRuns.length, refreshMonitoringData]);

  const promptQuotaQuery = useQuery({
    queryKey: appQueryKeys.promptQuota(apiBaseURL, organizationId, source.activeProjectId),
    enabled:
      apiBaseURL.trim() !== "" &&
      organizationId.trim() !== "" &&
      hasActiveProjectId,
    queryFn: ({ signal }) =>
      loadPromptQuotaUsage(apiBaseURL, source.activeProjectId, organizationId, { signal }),
  });
  const analysisRunsQuery = useQuery({
    queryKey: ["analysis-runs", apiBaseURL, organizationId, source.activeProjectId],
    enabled:
      apiBaseURL.trim() !== "" &&
      organizationId.trim() !== "" &&
      hasActiveProjectId,
    queryFn: ({ signal }) =>
      loadAnalysisRuns(apiBaseURL, organizationId, source.activeProjectId, 5, signal),
    refetchInterval: (query) => {
      const runs = (query.state.data ?? []) as AnalysisRunRecord[];
      return runs.some((run) => run.status === "running") ? 4000 : false;
    },
  });
  const analysisRuns = analysisRunsQuery.data ?? [];
  const cancelledAnalysisRunIdsSet = useMemo(
    () => new Set(cancelledAnalysisRunIds),
    [cancelledAnalysisRunIds],
  );
  const serverRunningRun =
    analysisRuns.find(
      (run) => run.status === "running" && !cancelledAnalysisRunIdsSet.has(run.id),
    ) ?? null;
  const latestFailedRun =
    analysisRuns.find((run) => FAILED_RUN_STATUSES.has(run.status)) ?? null;
  const serverAnalysisInProgress = Boolean(serverRunningRun);
  const pendingPromptResponse =
    pendingPromptRuns.length > 0 || serverAnalysisInProgress;
  const activeAnalysisRunId = serverAnalysisInProgress ? serverRunningRun?.id ?? null : null;
  const analysisProgressLabel = serverRunningRun
    ? `${serverRunningRun.completedResponses}/${serverRunningRun.expectedResponses}`
    : "";
  const analysisIssue =
    latestFailedRun
        ? {
            tone: "error" as const,
            titleKey: "analysisFailedTitle",
            descriptionKey: "analysisFailedDescription",
            values: { status: latestFailedRun.status },
          }
        : null;

  useEffect(() => {
    if (cancelledAnalysisRunIds.length === 0 || analysisRuns.length === 0) return;
    const stillRunning = new Set(
      analysisRuns.filter((run) => run.status === "running").map((run) => run.id),
    );
    setCancelledAnalysisRunIds((current) => {
      const next = current.filter((runId) => stillRunning.has(runId));
      return next.length === current.length ? current : next;
    });
  }, [analysisRuns, cancelledAnalysisRunIds.length]);

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
  const modelCreditCosts = useMemo(() => {
    const costs = new Map<string, number>();
    for (const model of source.projectModels) {
      const cost = Math.max(1, Math.floor(model.creditCost ?? 1));
      for (const key of [
        model.id,
        model.providerModelId,
        model.displayName,
        model.groupName,
      ]) {
        const normalized = key.trim();
        if (!normalized) continue;
        costs.set(normalized, cost);
        costs.set(normalized.toLowerCase(), cost);
      }
    }
    return costs;
  }, [source.projectModels]);

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
    modelCreditCosts,
    quotaUsage: promptQuotaQuery.data ?? null,
    availablePersonas: source.availablePersonas,
    recentPrompts: monitoringData.recent_prompts,
    manualPrompts,
    persistedPromptIds: source.persistedPromptIds,
    setManualPrompts,
    setPromptPage,
    setPromptEditorState,
    setEditingPromptModelsId,
    setEditingPromptScheduleId,
    setHiddenPromptIds,
    setPendingPromptRuns,
    setCancelledAnalysisRunIds,
    setSelectedPromptIds,
    setSelectedPromptId,
    setRunningPromptRowIds,
    refreshMonitoringData,
    refetchPromptsCatalog: source.promptsCatalogQuery.refetch,
    refetchPromptQuota: promptQuotaQuery.refetch,
  });
  const promptsCatalogInitialLoading =
    source.promptsCatalogQuery.isLoading ||
    (source.promptsCatalogQuery.isFetching && !source.promptsCatalogQuery.data);
  const promptMutationPending =
    mutations.bulkPromptStatusMutation.isPending ||
    mutations.savePromptEditorMutation.isPending ||
    mutations.deletePromptMutation.isPending ||
    mutations.updatePromptModelsMutation.isPending ||
    mutations.updatePromptScheduleMutation.isPending;
  const loadingState = getPromptsWorkspaceLoadingState({
    monitoringLoading,
    promptsCatalogInitialLoading,
    promptMutationPending,
  });

  const runnableSelectedPrompts = derived.selectedPromptRows.filter((item) =>
    mutations.canRunPrompt(item),
  );
  const selectedPromptCredits = mutations.estimatePromptRunsCredits(runnableSelectedPrompts);
  const runningSelectedPrompts =
    runnableSelectedPrompts.length > 0 &&
    runnableSelectedPrompts.every((item) => runningPromptRowIds.includes(item.id));
  const runPromptBusy = mutations.runPromptsMutation.isPending || serverAnalysisInProgress;

  const runPrompt = (prompt: (typeof derived.selectedPromptRows)[number]) => {
    if (!mutations.canRunPrompt(prompt) || runPromptBusy) return;
    const credits = mutations.estimatePromptRunsCredits([prompt]);
    if (!mutations.hasEnoughCreditsFor(credits)) {
      mutations.pushInsufficientCreditsToast(credits);
      return;
    }
    mutations.runPromptsMutation.mutate([prompt]);
  };

  const runSelectedPrompts = () => {
    if (
      runnableSelectedPrompts.length === 0 ||
      runPromptBusy
    ) {
      return;
    }
    if (!mutations.hasEnoughCreditsFor(selectedPromptCredits)) {
      mutations.pushInsufficientCreditsToast(selectedPromptCredits);
      return;
    }
    mutations.runPromptsMutation.mutate(runnableSelectedPrompts);
  };

  const stopActiveAnalysis = () => {
    if (!activeAnalysisRunId || mutations.cancelAnalysisMutation.isPending) return;
    mutations.cancelAnalysisMutation.mutate(activeAnalysisRunId);
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
    editorPrompts: derived.editorPrompts,
    filteredPrompts: derived.filteredPrompts,
    selectedPromptRows: derived.selectedPromptRows,
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
    deleteSelectedPrompts: () =>
      mutations.deleteSelectedPrompts(
        resolveBulkPromptIds({
          promptRowMode,
          selectedPromptIds,
          filteredPromptRows: derived.prompts,
        }),
      ),
    canRunPrompt: mutations.canRunPrompt,
    runPrompt,
    runSelectedPrompts,
    canRunSelectedPrompts: runnableSelectedPrompts.length > 0,
    selectedRunnablePromptCount: runnableSelectedPrompts.length,
    runningSelectedPrompts,
    runningAnyPrompts: runPromptBusy || pendingPromptResponse,
    pendingPromptResponse,
    activeAnalysisRunId,
    stopActiveAnalysis,
    stoppingAnalysis: mutations.cancelAnalysisMutation.isPending,
    analysisIssue,
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
    generatingPrompts: mutations.generatingPrompts,
    addImportedPrompts: mutations.addImportedPrompts,
    getModelVisual: source.getModelVisual,
    promptPlanUsage,
    promptPage,
    setPromptPage,
    promptTotalItems: derived.promptTotalItems,
    promptTotalPages: derived.promptTotalPages,
    canPreviousPromptPage: promptPage > 1,
    canNextPromptPage: promptPage < derived.promptTotalPages,
    promptsDataLoading: loadingState.promptsDataLoading,
    responsesDataLoading: loadingState.responsesDataLoading,
    promptsLoading: loadingState.promptsBusy,
    rankTone,
    statusBadgeClassName,
    truncate,
  };
}
