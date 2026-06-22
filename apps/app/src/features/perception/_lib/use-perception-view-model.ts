"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dismissToast,
  pushErrorToast,
  pushLoadingToast,
  pushWarningToast,
} from "@/components/ui/toast-actions";
import { getAIProviderIconPath } from "@/lib/ai-provider-assets";
import { apiRoutes } from "@/lib/api-config";
import { appQueryKeys } from "@/lib/query-keys";
import { resolveRuntimeMode } from "@/lib/runtime-mode";
import { loadPromptQuotaUsage } from "@/features/prompts/_lib/prompt-quota";
import {
  cancelAnalysisRun,
  loadAnalysisRuns,
  type AnalysisRunRecord,
} from "@/features/prompts/_lib/prompt-api";
import { useClientExportAccess } from "@/shared/export-entitlements";
import {
  readOrganizationIdFromSearch,
  readSelectedOrganizationPublicID,
} from "@/shared/selection";
import {
  derivePerceptionHeatmapFromResponses,
  derivePerceptionRadarFromResponses,
  derivePerceptionScoresFromResponses,
  derivePerceptionTrendSeries,
  filterPerceptionResponses,
  type PerceptionResponseRecord,
  type PerceptionSourceFilter,
  type PerceptionTrendPeriodKey,
  type PerceptionViewData,
} from "./shared/perception-data";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { postPerceptionClientJSON } from "./client-api";
import { exportPerceptionWorkbook } from "./perception-export";
import {
  getDefaultPerceptionFilters,
  readPersistedPerceptionFilters,
  writePersistedPerceptionFilters,
} from "./perception-filters-storage";

const DISABLE_GATEWAY_TIMEOUT_MS = 0;
const FAILED_RUN_STATUSES = new Set(["failed", "cancelled", "cancelled_by_user"]);
const PERCEPTION_ANALYSIS_TOAST_ID = "perception-analysis-in-progress";
const DEFAULT_PERCEPTION_PROMPT_COUNT = 3;

function buildFallbackModelCatalog(initialData: PerceptionViewData) {
  return initialData.metadata.models.map((modelName) => ({
    id: modelName,
    displayName: modelName,
    groupName: modelName,
    provider: "",
    providerModelId: modelName,
    description: modelName,
    iconPath: getAIProviderIconPath(modelName),
    live: true,
    creditCost: 1,
  }));
}

function getDefaultSourceFilter(): PerceptionSourceFilter {
  return "perception";
}

function getLatestRunIdForResponses(
  responses: PerceptionResponseRecord[],
  fallbackLatestRunId?: string,
): string {
  let latestRunId = "";
  let latestTimestamp = Number.NEGATIVE_INFINITY;

  for (const response of responses) {
    if (!response.runId) {
      continue;
    }

    const timestamp = response.createdAt
      ? new Date(response.createdAt).getTime()
      : Number.NEGATIVE_INFINITY;
    if (timestamp >= latestTimestamp) {
      latestTimestamp = timestamp;
      latestRunId = response.runId;
    } else if (latestRunId === "") {
      latestRunId = response.runId;
    }
  }

  return latestRunId || fallbackLatestRunId || "";
}

function hasMinimumPerceptionBrandContext(data: PerceptionViewData): boolean {
  const canon = data.brandCanon;
  return (
    canon.brandName.trim() !== "" &&
    canon.category.trim() !== ""
  );
}

function getPerceptionPromptProgress(
  run: AnalysisRunRecord | null,
  fallbackPromptCount: number | null,
): { completed: number; total: number } {
  const total = Math.max(
    1,
    run?.promptsCount || fallbackPromptCount || DEFAULT_PERCEPTION_PROMPT_COUNT,
  );
  const modelsCount = Math.max(1, run?.modelsCount || 1);
  const completedResponses = Math.max(0, run?.completedResponses || 0);
  const completed = run
    ? Math.min(total, Math.floor(completedResponses / modelsCount))
    : 0;
  return { completed, total };
}

export function usePerceptionViewModel(
  initialData: PerceptionViewData,
  options: { apiBaseURL?: string; routeSearch?: string } = {},
) {
  const { t } = useScopedI18n("perception");
  const queryClient = useQueryClient();
  const modelCatalog = useMemo(
    () =>
      initialData.metadata.modelCatalog.length > 0
        ? initialData.metadata.modelCatalog
        : buildFallbackModelCatalog(initialData),
    [initialData],
  );
  const persistedFilters = useMemo(
    () => readPersistedPerceptionFilters(modelCatalog.map((model) => model.id)),
    [modelCatalog],
  );
  const defaultFilters = useMemo(() => getDefaultPerceptionFilters(), []);
  const exportAccess = useClientExportAccess({
    apiBaseURL: options.apiBaseURL,
    routeSearch: options.routeSearch,
  });
  const [selectedModels, setSelectedModels] = useState<string[]>(
    () => persistedFilters.selectedModels ?? defaultFilters.selectedModels,
  );
  const [selectedSourceFilter, setSelectedSourceFilter] =
    useState<PerceptionSourceFilter>(
      () => getDefaultSourceFilter(),
    );
  const [selectedPeriod, setSelectedPeriod] =
    useState<PerceptionTrendPeriodKey>(
      () => persistedFilters.selectedPeriod ?? defaultFilters.selectedPeriod,
    );
  const [showAllModels, setShowAllModels] = useState(false);
  const [showUniqueModelFilters, setShowUniqueModelFilters] = useState(
    () =>
      persistedFilters.showUniqueModelFilters ??
      defaultFilters.showUniqueModelFilters,
  );
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [locallyAcceptedAnalysis, setLocallyAcceptedAnalysis] = useState(false);
  const [observedPerceptionRunId, setObservedPerceptionRunId] = useState<string | null>(null);
  const [reportedFailedRunId, setReportedFailedRunId] = useState<string | null>(null);
  const [analysisAcceptedAt, setAnalysisAcceptedAt] = useState<number | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [lastAnalysisCredits, setLastAnalysisCredits] = useState<number | null>(null);
  const [stoppingPerceptionAnalysis, setStoppingPerceptionAnalysis] = useState(false);
  const [pendingPerceptionPromptCount, setPendingPerceptionPromptCount] = useState<number | null>(null);
  const perceptionBrandContextReady = useMemo(
    () => hasMinimumPerceptionBrandContext(initialData),
    [initialData],
  );
  const organizationId = useMemo(
    () =>
      readOrganizationIdFromSearch(options.routeSearch ?? "") ||
      readSelectedOrganizationPublicID(),
    [options.routeSearch],
  );

  useEffect(() => {
    writePersistedPerceptionFilters({
      selectedModels,
      selectedSourceFilter,
      selectedPeriod,
      showUniqueModelFilters,
    });
  }, [
    selectedModels,
    selectedPeriod,
    selectedSourceFilter,
    showUniqueModelFilters,
  ]);

  const sourceScopedResponses = useMemo(
    () => {
      if (!perceptionBrandContextReady) return [];
      return filterPerceptionResponses(initialData.responses, {
        sourceFilter: selectedSourceFilter,
        period: "all",
        referenceDate: initialData.metadata.generatedAt,
        latestRunId: initialData.metadata.latestRunId,
      });
    },
    [
      initialData.metadata.generatedAt,
      initialData.metadata.latestRunId,
      initialData.responses,
      perceptionBrandContextReady,
      selectedSourceFilter,
    ],
  );

  const sourceLatestRunId = useMemo(
    () =>
      getLatestRunIdForResponses(
        sourceScopedResponses,
        initialData.metadata.latestRunId,
      ),
    [initialData.metadata.latestRunId, sourceScopedResponses],
  );

  const modelScopedResponses = useMemo(
    () =>
      filterPerceptionResponses(sourceScopedResponses, {
        selectedModels,
        period: "all",
        referenceDate: initialData.metadata.generatedAt,
        latestRunId: sourceLatestRunId,
      }),
    [
      initialData.metadata.generatedAt,
      selectedModels,
      sourceLatestRunId,
      sourceScopedResponses,
    ],
  );

  const filteredResponses = useMemo(
    () =>
      filterPerceptionResponses(modelScopedResponses, {
        period: selectedPeriod,
        referenceDate: initialData.metadata.generatedAt,
        latestRunId: sourceLatestRunId,
      }),
    [
      initialData.metadata.generatedAt,
      modelScopedResponses,
      selectedPeriod,
      sourceLatestRunId,
    ],
  );

  const lastRunScores = useMemo(
    () =>
      derivePerceptionScoresFromResponses(
        filterPerceptionResponses(modelScopedResponses, {
          period: "last-run",
          referenceDate: initialData.metadata.generatedAt,
          latestRunId: sourceLatestRunId,
        }),
      ),
    [initialData.metadata.generatedAt, modelScopedResponses, sourceLatestRunId],
  );
  const filteredRadar = useMemo(
    () => derivePerceptionRadarFromResponses(filteredResponses),
    [filteredResponses],
  );
  const modelAxisHeatmap = useMemo(
    () =>
      derivePerceptionHeatmapFromResponses(filteredResponses, {
        groupByModelFamily: !showUniqueModelFilters,
      }),
    [filteredResponses, showUniqueModelFilters],
  );
  const perceptionTrend = useMemo(
    () =>
      derivePerceptionTrendSeries(modelScopedResponses, {
        period: selectedPeriod,
        referenceDate: initialData.metadata.generatedAt,
        latestRunId: sourceLatestRunId,
      }),
    [
      initialData.metadata.generatedAt,
      modelScopedResponses,
      selectedPeriod,
      sourceLatestRunId,
    ],
  );
  const scoreCards = useMemo(
    () => [
      {
        id: "positioning",
        title: t("scoreCardPositioningTitle"),
        value: lastRunScores.positioningAccuracy,
        hint: t("scoreCardPositioningHint"),
      },
      {
        id: "factual",
        title: t("scoreCardFactualTitle"),
        value: lastRunScores.factualAccuracy,
        hint: t("scoreCardFactualHint"),
      },
      {
        id: "sentiment",
        title: t("scoreCardSentimentTitle"),
        value: lastRunScores.sentimentScore,
        hint: t("scoreCardSentimentHint"),
      },
    ],
    [lastRunScores, t],
  );

  const estimatedPerceptionCredits = useMemo(() => {
    const modelCreditCostSum = Math.max(
      1,
      modelCatalog.reduce(
        (total, model) => total + Math.max(1, Math.floor(model.creditCost ?? 1)),
        0,
      ),
    );
    return 3 * modelCreditCostSum;
  }, [modelCatalog]);
  const quotaQuery = useQuery({
    queryKey: appQueryKeys.promptQuota(
      options.apiBaseURL ?? "",
      organizationId,
      initialData.metadata.projectId ?? null,
    ),
    enabled:
      (options.apiBaseURL ?? "").trim() !== "" &&
      organizationId.trim() !== "" &&
      Boolean(initialData.metadata.projectId),
    queryFn: ({ signal }) =>
      loadPromptQuotaUsage(
        options.apiBaseURL ?? "",
        initialData.metadata.projectId!,
        organizationId,
        { signal },
      ),
  });
  const perceptionQuotaExceeded =
    quotaQuery.data?.hasQuota === true &&
    quotaQuery.data.monthlyCredits > 0 &&
    quotaQuery.data.remainingCredits < estimatedPerceptionCredits;
  const analysisRunsQueryKey = useMemo(
    () =>
      [
        "analysis-runs",
        options.apiBaseURL ?? "",
        organizationId,
        initialData.metadata.projectId ?? null,
        "perception",
      ] as const,
    [initialData.metadata.projectId, options.apiBaseURL, organizationId],
  );
  const analysisRunsQuery = useQuery({
    queryKey: analysisRunsQueryKey,
    enabled:
      (options.apiBaseURL ?? "").trim() !== "" &&
      organizationId.trim() !== "" &&
      Boolean(initialData.metadata.projectId),
    queryFn: ({ signal }) =>
      loadAnalysisRuns(
        options.apiBaseURL ?? "",
        organizationId,
        initialData.metadata.projectId!,
        10,
        signal,
      ),
    refetchInterval: (query) => {
      const runs = ((query.state.data ?? []) as AnalysisRunRecord[]).filter(
        (run) => run.runType === "perception",
      );
      return runs.some(
        (run) =>
          run.status === "running" &&
          (run.expectedResponses === 0 || run.completedResponses < run.expectedResponses),
      )
        ? 3000
        : false;
    },
  });
  const perceptionRuns = (analysisRunsQuery.data ?? []).filter(
    (run) => run.runType === "perception",
  );
  const runningPerceptionRuns = perceptionRuns.filter(
    (run) =>
      run.status === "running" &&
      (run.expectedResponses === 0 || run.completedResponses < run.expectedResponses),
  );
  const runningPerceptionRun = runningPerceptionRuns[0] ?? null;
  const latestFailedPerceptionRun =
    perceptionRuns.find((run) => FAILED_RUN_STATUSES.has(run.status)) ?? null;
  const latestFailedPartialPerceptionRun =
    latestFailedPerceptionRun &&
    latestFailedPerceptionRun.status !== "cancelled_by_user" &&
    latestFailedPerceptionRun.completedResponses > 0 &&
    (latestFailedPerceptionRun.expectedResponses === 0 ||
      latestFailedPerceptionRun.completedResponses < latestFailedPerceptionRun.expectedResponses)
      ? latestFailedPerceptionRun
      : null;
  const perceptionAnalysisPending =
    analysisRunning || locallyAcceptedAnalysis || runningPerceptionRuns.length > 0;
  const perceptionDataLoading = perceptionAnalysisPending;
  const perceptionPromptProgress = useMemo(
    () =>
      getPerceptionPromptProgress(
        runningPerceptionRun,
        pendingPerceptionPromptCount,
      ),
    [pendingPerceptionPromptCount, runningPerceptionRun],
  );
  const perceptionQueryKey = useMemo(
    () =>
      appQueryKeys.perception(
        options.apiBaseURL ?? "",
        initialData.metadata.projectId ?? null,
        organizationId || null,
        resolveRuntimeMode(options.routeSearch ?? ""),
      ),
    [initialData.metadata.projectId, options.apiBaseURL, options.routeSearch, organizationId],
  );

  useEffect(() => {
    if (runningPerceptionRun?.id) {
      setObservedPerceptionRunId(runningPerceptionRun.id);
      setLocallyAcceptedAnalysis(false);
      setAnalysisAcceptedAt(null);
    }
  }, [runningPerceptionRun?.id]);

  useEffect(() => {
    if (perceptionAnalysisPending) {
      pushLoadingToast(
        `${t("analysisInProgressToastTitle")} ${perceptionPromptProgress.completed}/${perceptionPromptProgress.total}`,
        undefined,
        undefined,
        PERCEPTION_ANALYSIS_TOAST_ID,
      );
      return;
    }

    dismissToast(PERCEPTION_ANALYSIS_TOAST_ID);
  }, [perceptionAnalysisPending, perceptionPromptProgress, t]);

  useEffect(() => {
    return () => {
      if (!perceptionAnalysisPending) {
        dismissToast(PERCEPTION_ANALYSIS_TOAST_ID);
      }
    };
  }, [perceptionAnalysisPending]);

  useEffect(() => {
    if (!perceptionAnalysisPending) return;

    const intervalId = window.setInterval(() => {
      void queryClient.refetchQueries({ queryKey: analysisRunsQueryKey, type: "active" });
      void queryClient.invalidateQueries({ queryKey: perceptionQueryKey });
      void queryClient.refetchQueries({ queryKey: perceptionQueryKey, type: "active" });
      void queryClient.invalidateQueries({
        queryKey: appQueryKeys.promptQuota(
          options.apiBaseURL ?? "",
          organizationId,
          initialData.metadata.projectId ?? null,
        ),
      });
    }, 3500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    initialData.metadata.projectId,
    analysisRunsQueryKey,
    options.apiBaseURL,
    organizationId,
    perceptionAnalysisPending,
    perceptionQueryKey,
    queryClient,
  ]);

  useEffect(() => {
    if (!locallyAcceptedAnalysis || analysisAcceptedAt === null) return;
    if (runningPerceptionRuns.length > 0) return;
    if (Date.now() - analysisAcceptedAt < 20000) return;

    setLocallyAcceptedAnalysis(false);
    setAnalysisAcceptedAt(null);
    setPendingPerceptionPromptCount(null);
    void queryClient.invalidateQueries({ queryKey: perceptionQueryKey });
    void queryClient.refetchQueries({ queryKey: perceptionQueryKey, type: "active" });
    void quotaQuery.refetch();
  }, [
    analysisAcceptedAt,
    locallyAcceptedAnalysis,
    perceptionQueryKey,
    queryClient,
    quotaQuery,
    runningPerceptionRuns.length,
  ]);

  useEffect(() => {
    if (
      !observedPerceptionRunId ||
      runningPerceptionRuns.length > 0 ||
      analysisRunsQuery.isFetching
    ) {
      return;
    }

    const observedRun = perceptionRuns.find((run) => run.id === observedPerceptionRunId);
    if (!observedRun || observedRun.status === "running") return;

    setObservedPerceptionRunId(null);
    setLocallyAcceptedAnalysis(false);
    setAnalysisAcceptedAt(null);
    setPendingPerceptionPromptCount(null);
    void queryClient.invalidateQueries({ queryKey: perceptionQueryKey });
    void queryClient.refetchQueries({ queryKey: perceptionQueryKey, type: "active" });
    void quotaQuery.refetch();
  }, [
    analysisRunsQuery.isFetching,
    analysisAcceptedAt,
    observedPerceptionRunId,
    perceptionQueryKey,
    perceptionRuns,
    queryClient,
    quotaQuery,
    runningPerceptionRuns.length,
  ]);

  useEffect(() => {
    if (!latestFailedPerceptionRun || latestFailedPerceptionRun.id === reportedFailedRunId) return;
    if (!locallyAcceptedAnalysis && !observedPerceptionRunId) return;
    if (observedPerceptionRunId && latestFailedPerceptionRun.id !== observedPerceptionRunId) return;
    if (!observedPerceptionRunId && analysisAcceptedAt !== null) {
      const failedAt = new Date(
        latestFailedPerceptionRun.updatedAt || latestFailedPerceptionRun.createdAt,
      ).getTime();
      if (!Number.isFinite(failedAt) || failedAt < analysisAcceptedAt) return;
    }
    setReportedFailedRunId(latestFailedPerceptionRun.id);
    setLocallyAcceptedAnalysis(false);
    setAnalysisAcceptedAt(null);
    setPendingPerceptionPromptCount(null);
    if (latestFailedPerceptionRun.status === "cancelled_by_user") return;
    setAnalysisError(t("analysisLaunchError"));
    pushErrorToast(
      t("analysisLaunchError"),
      t("analysisLaunchError"),
      latestFailedPerceptionRun.status,
    );
  }, [
    analysisAcceptedAt,
    latestFailedPerceptionRun,
    locallyAcceptedAnalysis,
    observedPerceptionRunId,
    reportedFailedRunId,
    t,
  ]);

  const handleRunPerceptionAnalysis = async (input?: {
    promptIds?: string[];
    modelIds?: string[];
    estimatedCredits?: number;
    restart?: boolean;
  }) => {
    const projectId = initialData.metadata.projectId;
    if (!projectId || perceptionAnalysisPending) return;
    const requestedCredits = input?.estimatedCredits ?? estimatedPerceptionCredits;
    const hasQuotaExceeded =
      quotaQuery.data?.hasQuota === true &&
      quotaQuery.data.monthlyCredits > 0 &&
      quotaQuery.data.remainingCredits < requestedCredits;
    if (hasQuotaExceeded) {
      pushWarningToast(
        t("analysisInsufficientCreditsTitle"),
        t("analysisInsufficientCreditsDescription", {
          credits: requestedCredits,
          remaining: quotaQuery.data?.remainingCredits ?? 0,
          total: quotaQuery.data?.monthlyCredits ?? 0,
        }),
      );
      return;
    }

    setAnalysisError(null);
    setLastAnalysisCredits(null);
    setAnalysisRunning(true);
    setLocallyAcceptedAnalysis(true);
    setAnalysisAcceptedAt(Date.now());
    setPendingPerceptionPromptCount(
      input?.promptIds && input.promptIds.length > 0
        ? input.promptIds.length
        : DEFAULT_PERCEPTION_PROMPT_COUNT,
    );
    try {
      const result = await postPerceptionClientJSON<{
        RunID?: string;
        runId?: string;
        RequestedCredits?: number;
        requestedCredits?: number;
      }>(apiRoutes.analysis.perceptionRun(projectId), {
        force: true,
        restart: input?.restart === true,
        promptIds: input?.promptIds ?? [],
        modelIds: input?.modelIds ?? [],
        requestId: `${projectId}-perception-manual-${Date.now()}`,
      }, {
        timeoutMs: DISABLE_GATEWAY_TIMEOUT_MS,
      });
      const credits =
        typeof result.requestedCredits === "number"
          ? result.requestedCredits
          : typeof result.RequestedCredits === "number"
            ? result.RequestedCredits
            : requestedCredits;
      const runId =
        typeof result.runId === "string" && result.runId.trim() !== ""
          ? result.runId
          : typeof result.RunID === "string" && result.RunID.trim() !== ""
            ? result.RunID
            : "";
      if (runId) {
        setObservedPerceptionRunId(runId);
      }
      setLastAnalysisCredits(credits);
      await analysisRunsQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: perceptionQueryKey });
      void queryClient.refetchQueries({ queryKey: perceptionQueryKey, type: "active" });
      void quotaQuery.refetch();
    } catch (err) {
      setLocallyAcceptedAnalysis(false);
      setAnalysisAcceptedAt(null);
      setPendingPerceptionPromptCount(null);
      setAnalysisError(
        err instanceof Error ? err.message : t("analysisLaunchError"),
      );
    } finally {
      setAnalysisRunning(false);
    }
  };

  const handleResumePerceptionAnalysis = async () => {
    await handleRunPerceptionAnalysis({ restart: false });
  };

  const handleRestartPerceptionAnalysis = async () => {
    await handleRunPerceptionAnalysis({ restart: true });
  };

  const handleStopPerceptionAnalysis = async () => {
    if (stoppingPerceptionAnalysis) return;
    setStoppingPerceptionAnalysis(true);
    try {
      let runIds = runningPerceptionRuns.map((run) => run.id);
      if (runIds.length === 0) {
        const result = await analysisRunsQuery.refetch();
        runIds =
          result.data
            ?.filter(
              (run) =>
                run.runType === "perception" &&
                run.status === "running" &&
                (run.expectedResponses === 0 || run.completedResponses < run.expectedResponses),
            )
            .map((run) => run.id) ?? [];
      }

      if (runIds.length > 0) {
        await Promise.all(
          runIds.map((runId) =>
            cancelAnalysisRun(options.apiBaseURL ?? "", organizationId, runId),
          ),
        );
      }

      setAnalysisRunning(false);
      setLocallyAcceptedAnalysis(false);
      setAnalysisAcceptedAt(null);
      setPendingPerceptionPromptCount(null);
      setObservedPerceptionRunId(null);
      dismissToast(PERCEPTION_ANALYSIS_TOAST_ID);
      await analysisRunsQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: perceptionQueryKey });
      void queryClient.refetchQueries({ queryKey: perceptionQueryKey, type: "active" });
      void quotaQuery.refetch();
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : t("analysisStopError"),
      );
      pushErrorToast(err, t("analysisStopError"));
    } finally {
      setStoppingPerceptionAnalysis(false);
    }
  };

  const handleExportPerceptionData = (periodLabel: string) => {
    exportPerceptionWorkbook({
      data: initialData,
      periodLabel,
      selectedModels,
      scoreCards,
      radar: filteredRadar,
      heatmap: modelAxisHeatmap,
      trendData: perceptionTrend.data,
    });
  };

  return {
    modelCatalog,
    selectedModels,
    setSelectedModels,
    selectedSourceFilter,
    setSelectedSourceFilter,
    selectedPeriod,
    setSelectedPeriod,
    showAllModels,
    setShowAllModels,
    showUniqueModelFilters,
    setShowUniqueModelFilters,
    filteredResponses,
    filteredRadar,
    modelAxisHeatmap,
    perceptionTrend,
    scoreCards,
    analysisRunning,
    perceptionAnalysisPending,
    perceptionDataLoading,
    perceptionStopPending: stoppingPerceptionAnalysis,
    perceptionBrandContextReady,
    canResumePerceptionAnalysis: Boolean(latestFailedPartialPerceptionRun),
    analysisError,
    estimatedPerceptionCredits,
    perceptionQuotaExceeded,
    perceptionQuotaLoading:
      quotaQuery.isLoading || (quotaQuery.isFetching && !quotaQuery.data),
    perceptionRemainingCredits: quotaQuery.data?.remainingCredits ?? 0,
    perceptionMonthlyCredits: quotaQuery.data?.monthlyCredits ?? 0,
    lastAnalysisCredits,
    canExport: exportAccess.canExport,
    exportDisabled:
      filteredResponses.length === 0 &&
      filteredRadar.length === 0,
    handleRunPerceptionAnalysis,
    handleResumePerceptionAnalysis,
    handleRestartPerceptionAnalysis,
    handleStopPerceptionAnalysis,
    handleExportPerceptionData,
  };
}
