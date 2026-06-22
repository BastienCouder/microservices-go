"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";
import { useMonitoringData } from "@/features/monitoring/_lib/shared/use-monitoring-data";
import { dismissToast, pushLoadingToast, type ToastId } from "@/components/ui/toast-actions";
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
  isMonitoringQueryForProject,
  isPromptRunProgressComplete,
  isPromptRunProgressExpired,
  type PromptRunProgressEntry,
} from "./prompt-run-progress";
import { DEFAULT_PROMPT_PERIOD, rankTone, statusBadgeClassName, truncate } from "./utils";
import { usePromptsDerivedState } from "./use-prompts-derived-state";
import { usePromptsMutations } from "./use-prompts-mutations";
import { usePromptsSourceData } from "./use-prompts-source-data";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { deleteAIResponse } from "@/features/shared/ai-responses-api";
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
const RECENT_FAILED_RUN_WINDOW_MS = 10 * 60 * 1000;

function getRunTimestamp(run: AnalysisRunRecord): number {
  const updatedAt = new Date(run.updatedAt || run.createdAt).getTime();
  if (Number.isFinite(updatedAt)) return updatedAt;
  return 0;
}

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

export function readPromptsWorkspaceTab(routeSearch: string): "prompts" | "responses" {
  const tabFromUrl = readRouteQueryParam(routeSearch, "tab");
  return tabFromUrl === "responses" || tabFromUrl === "prompts"
    ? tabFromUrl
    : "prompts";
}

export function usePromptsResponsesState(apiBaseURL: string, routeSearch = "") {
  const { t } = useScopedI18n("prompts-workspace");
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
  const [tab, setTab] = useState<"prompts" | "responses">(() =>
    readPromptsWorkspaceTab(routeSearch),
  );
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
  const [locallyCompletedAnalysisRunIds, setLocallyCompletedAnalysisRunIds] = useState<string[]>([]);
  const [runPromptToastId, setRunPromptToastId] = useState<ToastId | null>(null);
  const [hadPendingPromptResponse, setHadPendingPromptResponse] = useState(false);
  const [observedRunningAnalysisRunId, setObservedRunningAnalysisRunId] = useState<string | null>(null);
  const [analysisAcceptedAt, setAnalysisAcceptedAt] = useState<number | null>(null);

  useEffect(() => {
    setOrganizationId(readOrganizationId(routeSearch));
  }, [routeSearch]);

  useEffect(() => {
    setTab(readPromptsWorkspaceTab(routeSearch));
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
      return current.filter((model) => source.promptAvailableModels.includes(model));
    });
  }, [source.promptAvailableModels]);

  useEffect(() => {
    if (source.responseAvailableModels.length === 0) return;
    setSelectedResponseModels((current) => {
      return current.filter((model) => source.responseAvailableModels.includes(model));
    });
  }, [source.responseAvailableModels]);

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
      const runs = ((query.state.data ?? []) as AnalysisRunRecord[]).filter(
        (run) => run.runType !== "perception",
      );
      if (pendingPromptRuns.length > 0) return 1000;
      return runs.some((run) => run.status === "running") ? 4000 : false;
    },
  });
  const analysisRuns = analysisRunsQuery.data ?? [];
  const promptAnalysisRuns = useMemo(
    () => analysisRuns.filter((run) => run.runType !== "perception"),
    [analysisRuns],
  );
  const cancelledAnalysisRunIdsSet = useMemo(
    () => new Set(cancelledAnalysisRunIds),
    [cancelledAnalysisRunIds],
  );
  const locallyCompletedAnalysisRunIdsSet = useMemo(
    () => new Set(locallyCompletedAnalysisRunIds),
    [locallyCompletedAnalysisRunIds],
  );
  const serverRunningRuns = promptAnalysisRuns.filter(
    (run) =>
      run.status === "running" &&
      !cancelledAnalysisRunIdsSet.has(run.id) &&
      !locallyCompletedAnalysisRunIdsSet.has(run.id),
  );
  const serverRunningRun = serverRunningRuns[0] ?? null;
  const latestFailedRun =
    promptAnalysisRuns.find((run) => {
      if (!FAILED_RUN_STATUSES.has(run.status)) return false;
      if (observedRunningAnalysisRunId) {
        return run.id === observedRunningAnalysisRunId;
      }
      const runTimestamp = getRunTimestamp(run);
      if (analysisAcceptedAt !== null) {
        return runTimestamp >= analysisAcceptedAt;
      }
      return Date.now() - runTimestamp <= RECENT_FAILED_RUN_WINDOW_MS;
    }) ?? null;
  const serverAnalysisInProgress = Boolean(serverRunningRun);
  const activePromptAnalysisCount = Math.max(
    pendingPromptRuns.length,
    serverRunningRuns.length,
  );
  const pendingPromptResponse =
    activePromptAnalysisCount > 0;
  const activeAnalysisRunIds = useMemo(
    () => serverRunningRuns.map((run) => run.id),
    [serverRunningRuns],
  );
  const activeAnalysisRunId = activeAnalysisRunIds[0] ?? null;

  useEffect(() => {
    if (pendingPromptRuns.length === 0) {
      setRunningPromptRowIds([]);
      return;
    }

    const next = serverAnalysisInProgress
      ? pendingPromptRuns
      : pendingPromptRuns.filter((entry) => {
          if (isPromptRunProgressExpired(entry)) return false;
          return !isPromptRunProgressComplete(entry, monitoringData.recent_prompts as never);
        });

    if (next.length !== pendingPromptRuns.length) {
      setPendingPromptRuns(next);
    }
    setRunningPromptRowIds(next.map((entry) => entry.rowId));
  }, [monitoringData.recent_prompts, pendingPromptRuns, serverAnalysisInProgress]);

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
    if (serverRunningRun?.id) {
      setObservedRunningAnalysisRunId(serverRunningRun.id);
    }
  }, [serverRunningRun?.id]);

  useEffect(() => {
    if (!latestFailedRun) return;

    setPendingPromptRuns([]);
    setRunningPromptRowIds([]);
    setObservedRunningAnalysisRunId(null);
    setAnalysisAcceptedAt(null);
    if (runPromptToastId) {
      dismissToast(runPromptToastId);
      setRunPromptToastId(null);
    }
  }, [latestFailedRun, runPromptToastId]);

  useEffect(() => {
    if (
      !observedRunningAnalysisRunId ||
      serverAnalysisInProgress ||
      analysisRunsQuery.isFetching
    ) {
      return;
    }

    const observedRun = promptAnalysisRuns.find((run) => run.id === observedRunningAnalysisRunId);
    if (!observedRun || observedRun.status === "running") return;

    setPendingPromptRuns([]);
    setRunningPromptRowIds([]);
    setObservedRunningAnalysisRunId(null);
    setAnalysisAcceptedAt(null);
    if (runPromptToastId) {
      dismissToast(runPromptToastId);
      setRunPromptToastId(null);
    }
  }, [
    promptAnalysisRuns,
    analysisRunsQuery.isFetching,
    observedRunningAnalysisRunId,
    runPromptToastId,
    serverAnalysisInProgress,
  ]);

  useEffect(() => {
    if (cancelledAnalysisRunIds.length === 0 || promptAnalysisRuns.length === 0) return;
    const stillRunning = new Set(
      promptAnalysisRuns.filter((run) => run.status === "running").map((run) => run.id),
    );
    setCancelledAnalysisRunIds((current) => {
      const next = current.filter((runId) => stillRunning.has(runId));
      return next.length === current.length ? current : next;
    });
  }, [promptAnalysisRuns, cancelledAnalysisRunIds.length]);

  useEffect(() => {
    if (locallyCompletedAnalysisRunIds.length === 0 || promptAnalysisRuns.length === 0) return;
    const stillRunning = new Set(
      promptAnalysisRuns.filter((run) => run.status === "running").map((run) => run.id),
    );
    setLocallyCompletedAnalysisRunIds((current) => {
      const next = current.filter((runId) => stillRunning.has(runId));
      return next.length === current.length ? current : next;
    });
  }, [promptAnalysisRuns, locallyCompletedAnalysisRunIds.length]);

  useEffect(() => {
    if (pendingPromptResponse) {
      setHadPendingPromptResponse(true);
      return;
    }

    if (runPromptToastId) {
      dismissToast(runPromptToastId);
      setRunPromptToastId(null);
    }

    if (!hadPendingPromptResponse) return;
    setHadPendingPromptResponse(false);
    void refreshMonitoringData();
    void queryClient.invalidateQueries({
      predicate: (query) =>
        isMonitoringQueryForProject(query.queryKey, apiBaseURL, source.activeProjectId),
    });
    void queryClient.invalidateQueries({
      queryKey: ["analysis-runs", apiBaseURL, organizationId, source.activeProjectId],
    });
    void queryClient.invalidateQueries({
      queryKey: appQueryKeys.promptQuota(apiBaseURL, organizationId, source.activeProjectId),
    });
    void queryClient.refetchQueries({
      queryKey: appQueryKeys.promptQuota(apiBaseURL, organizationId, source.activeProjectId),
      type: "active",
    });
  }, [
    apiBaseURL,
    hadPendingPromptResponse,
    organizationId,
    pendingPromptResponse,
    queryClient,
    refreshMonitoringData,
    runPromptToastId,
    source.activeProjectId,
  ]);

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

  useEffect(() => {
    if (pendingPromptRuns.length === 0 || derived.visibleResponses.length === 0) return;
    if (serverAnalysisInProgress) return;

    const completedPromptIds = new Set(
      derived.visibleResponses
        .filter((response) =>
          pendingPromptRuns.some((entry) => {
            if (response.promptId !== entry.sourcePromptId) return false;
            if (!response.createdAt) return true;
            return response.createdAt > entry.startedAt;
          }),
        )
        .map((response) => response.promptId),
    );

    if (completedPromptIds.size === 0) return;

    if (activeAnalysisRunId) {
      setLocallyCompletedAnalysisRunIds((current) =>
        current.includes(activeAnalysisRunId) ? current : [...current, activeAnalysisRunId],
      );
    }
    setPendingPromptRuns((current) => {
      const next = current.filter((entry) => !completedPromptIds.has(entry.sourcePromptId));
      if (next.length === current.length) return current;
      if (next.length === 0 && runPromptToastId) {
        dismissToast(runPromptToastId);
        setRunPromptToastId(null);
      }
      if (next.length === 0) {
        void queryClient.invalidateQueries({
          queryKey: appQueryKeys.promptQuota(apiBaseURL, organizationId, source.activeProjectId),
        });
        void queryClient.refetchQueries({
          queryKey: appQueryKeys.promptQuota(apiBaseURL, organizationId, source.activeProjectId),
          type: "active",
        });
      }
      return next;
    });
    setRunningPromptRowIds((current) =>
      current.filter((rowId) =>
        pendingPromptRuns.some(
          (entry) => entry.rowId === rowId && !completedPromptIds.has(entry.sourcePromptId),
        ),
      ),
    );
  }, [
    activeAnalysisRunId,
    apiBaseURL,
    derived.visibleResponses,
    organizationId,
    pendingPromptRuns,
    queryClient,
    runPromptToastId,
    serverAnalysisInProgress,
    source.activeProjectId,
  ]);

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

  const runnableSelectedPrompts = derived.selectedPromptRows.filter(
    (item) => mutations.canRunPrompt(item) && !runningPromptRowIds.includes(item.id),
  );
  const selectedPromptCredits = mutations.estimatePromptRunsCredits(runnableSelectedPrompts);
  const runningSelectedPrompts =
    derived.selectedPromptRows.some((item) => runningPromptRowIds.includes(item.id));
  const runPromptBusy = false;

  const runPrompt = (prompt: (typeof derived.selectedPromptRows)[number]) => {
    if (
      !mutations.canRunPrompt(prompt) ||
      runningPromptRowIds.includes(prompt.id)
    ) {
      return;
    }
    const credits = mutations.estimatePromptRunsCredits([prompt]);
    if (!mutations.hasEnoughCreditsFor(credits)) {
      mutations.pushInsufficientCreditsToast(credits);
      return;
    }
    setAnalysisAcceptedAt(Date.now());
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
    setAnalysisAcceptedAt(Date.now());
    mutations.runPromptsMutation.mutate(runnableSelectedPrompts);
  };

  const stopActiveAnalyses = useCallback(async () => {
    if (mutations.cancelAnalysisMutation.isPending) return;
    let runIds = activeAnalysisRunIds;
    if (runIds.length === 0) {
      const result = await analysisRunsQuery.refetch();
      runIds =
        result.data
          ?.filter(
            (run) =>
              run.runType !== "perception" &&
              run.status === "running" &&
              !cancelledAnalysisRunIdsSet.has(run.id) &&
              !locallyCompletedAnalysisRunIdsSet.has(run.id),
          )
          .map((run) => run.id) ?? [];
    }
    for (const runId of runIds) {
      mutations.cancelAnalysisMutation.mutate(runId);
    }
  }, [
    activeAnalysisRunIds,
    analysisRunsQuery.refetch,
    cancelledAnalysisRunIdsSet,
    locallyCompletedAnalysisRunIdsSet,
    mutations.cancelAnalysisMutation,
  ]);

  const deleteResponse = useCallback(
    async (responseId: string) => {
      await deleteAIResponse(apiBaseURL, routeSearch, responseId);
      if (selectedResponseId === responseId) {
        setSelectedResponseId(null);
      }
      await refreshMonitoringData();
      await queryClient.invalidateQueries({
        predicate: (query) =>
          isMonitoringQueryForProject(query.queryKey, apiBaseURL, source.activeProjectId),
      });
    },
    [
      apiBaseURL,
      queryClient,
      refreshMonitoringData,
      routeSearch,
      selectedResponseId,
      source.activeProjectId,
    ],
  );

  useEffect(() => {
    if (activePromptAnalysisCount <= 0) {
      if (runPromptToastId) {
        dismissToast(runPromptToastId);
        setRunPromptToastId(null);
      }
      return;
    }

    const nextToastId = pushLoadingToast(
      t("runPromptInProgressDescription", { count: activePromptAnalysisCount }),
      undefined,
      undefined,
      runPromptToastId ?? undefined,
    );
    if (nextToastId !== runPromptToastId) {
      setRunPromptToastId(nextToastId);
    }
  }, [
    activePromptAnalysisCount,
    runPromptToastId,
    t,
  ]);

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
    activeAnalysisRunCount: activePromptAnalysisCount,
    stopActiveAnalyses,
    deleteResponse,
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
