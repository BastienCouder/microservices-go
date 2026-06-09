"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { pushWarningToast } from "@/components/ui/toast-actions";
import { apiRoutes } from "@/lib/api-config";
import { appQueryKeys } from "@/lib/query-keys";
import { loadPromptQuotaUsage } from "@/features/prompts/_lib/prompt-quota";
import { useClientExportAccess } from "@/shared/export-entitlements";
import {
  readOrganizationIdFromSearch,
  readSelectedOrganizationID,
} from "@/shared/selection";
import {
  derivePerceptionHeatmapFromResponses,
  derivePerceptionRadarFromResponses,
  derivePerceptionScoresFromResponses,
  derivePerceptionTrendSeries,
  filterPerceptionResponses,
  type OptimizePriority,
  type PerceptionError,
  type PerceptionTrendPeriodKey,
  type PerceptionViewData,
} from "./shared/perception-data";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { deletePerceptionClientJSON, getPerceptionClientJSON, postPerceptionClientJSON } from "./client-api";
import {
  getOptimizationActionMatchIds,
  toCanonicalPerceptionSourceErrorId,
} from "./optimization-action-ids";
import { exportPerceptionWorkbook } from "./perception-export";
import { resolvePerceptionGeneratedContent } from "./perception-i18n";

type OptimizeDraft = {
  id: string;
  persistedId?: string;
  priority: OptimizePriority;
  type: PerceptionError["fixType"];
  title: string;
  issue: string;
  impact: string;
  generatedContent: string;
  status: string;
};

type PersistedOptimizeAction = {
  id: string;
  priority: OptimizePriority;
  type: PerceptionError["fixType"] | string;
  title: string;
  issue: string;
  impact?: string | null;
  generatedContent: string;
  status?: string | null;
  sourceErrorId?: string | null;
};

function buildFallbackModelCatalog(initialData: PerceptionViewData) {
  return initialData.metadata.models.map((modelName) => ({
    id: modelName,
    displayName: modelName,
    groupName: modelName,
    provider: "",
    providerModelId: modelName,
    description: modelName,
    iconPath: "/models/openai.svg",
    live: true,
    creditCost: 1,
  }));
}

function mergeDrafts(
  current: OptimizeDraft[],
  actions: PersistedOptimizeAction[],
): OptimizeDraft[] {
  const merged = new Map(current.map((draft) => [draft.id, draft] as const));

  for (const action of actions) {
    const matchIds = getOptimizationActionMatchIds(action.sourceErrorId || action.id);
    const uiId = matchIds.find((id) => !id.includes(":")) || action.sourceErrorId || action.id;
    if (merged.has(uiId)) continue;
    merged.set(uiId, {
      id: uiId,
      persistedId: action.id,
      priority: (action.priority ?? "medium") as OptimizePriority,
      type: (action.type as PerceptionError["fixType"]) ?? "prompt_patch",
      title: action.title,
      issue: action.issue,
      impact: action.impact ?? "",
      generatedContent: action.generatedContent,
      status: action.status || "draft",
    });
  }

  return Array.from(merged.values());
}

export function usePerceptionViewModel(
  initialData: PerceptionViewData,
  options: { apiBaseURL?: string; routeSearch?: string } = {},
) {
  const { locale, t } = useScopedI18n("perception");
  const exportAccess = useClientExportAccess({
    apiBaseURL: options.apiBaseURL,
    routeSearch: options.routeSearch,
  });
  const [optimizeDrafts, setOptimizeDrafts] = useState<OptimizeDraft[]>([]);
  const [savingErrorIds, setSavingErrorIds] = useState<Set<string>>(new Set());
  const [persistError, setPersistError] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PerceptionTrendPeriodKey>("all");
  const [showAllModels, setShowAllModels] = useState(false);
  const [showUniqueModelFilters, setShowUniqueModelFilters] = useState(false);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [lastAnalysisCredits, setLastAnalysisCredits] = useState<number | null>(null);
  const organizationId = useMemo(
    () =>
      readOrganizationIdFromSearch(options.routeSearch ?? "") ||
      readSelectedOrganizationID(),
    [options.routeSearch],
  );

  useEffect(() => {
    const projectId = initialData.metadata.projectId;
    if (!projectId) return;

    let isMounted = true;
    void getPerceptionClientJSON<PersistedOptimizeAction[]>(
      apiRoutes.analysis.optimizeActions(projectId),
    )
      .then((actions) => {
        if (!isMounted) return;
        setOptimizeDrafts((current) => mergeDrafts(current, actions));
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [initialData.metadata.projectId]);

  const modelCatalog = useMemo(
    () =>
      initialData.metadata.modelCatalog.length > 0
        ? initialData.metadata.modelCatalog
        : buildFallbackModelCatalog(initialData),
    [initialData],
  );

  const modelScopedResponses = useMemo(
    () =>
      filterPerceptionResponses(initialData.responses, {
        selectedModels,
        period: "all",
        referenceDate: initialData.metadata.generatedAt,
        latestRunId: initialData.metadata.latestRunId,
      }),
    [initialData, selectedModels],
  );

  const filteredResponses = useMemo(
    () =>
      filterPerceptionResponses(modelScopedResponses, {
        period: selectedPeriod,
        referenceDate: initialData.metadata.generatedAt,
        latestRunId: initialData.metadata.latestRunId,
      }),
    [initialData.metadata.generatedAt, initialData.metadata.latestRunId, modelScopedResponses, selectedPeriod],
  );

  const lastRunScores = useMemo(
    () =>
      derivePerceptionScoresFromResponses(
        filterPerceptionResponses(initialData.responses, {
          period: "last-run",
          referenceDate: initialData.metadata.generatedAt,
          latestRunId: initialData.metadata.latestRunId,
        }),
      ),
    [initialData],
  );

  const actionStatusesByErrorId = useMemo(() => {
    const statuses = new Map<string, string>();
    for (const draft of optimizeDrafts) {
      for (const id of getOptimizationActionMatchIds(draft.id)) {
        statuses.set(id, draft.status);
      }
    }
    return statuses;
  }, [optimizeDrafts]);
  const filteredRadar = useMemo(
    () => derivePerceptionRadarFromResponses(filteredResponses),
    [filteredResponses],
  );
  const filteredTopErrors = useMemo(
    () =>
      initialData.topErrors
        .filter((error) => actionStatusesByErrorId.get(error.id) !== "done")
        .slice(0, 3),
    [actionStatusesByErrorId, initialData.topErrors],
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
        latestRunId: initialData.metadata.latestRunId,
      }),
    [initialData.metadata.generatedAt, initialData.metadata.latestRunId, modelScopedResponses, selectedPeriod],
  );
  const generatedIds = useMemo(
    () => new Set(optimizeDrafts.flatMap((draft) => getOptimizationActionMatchIds(draft.id))),
    [optimizeDrafts],
  );
  const visibleOptimizeDrafts = useMemo(
    () => optimizeDrafts.filter((draft) => draft.status !== "done"),
    [optimizeDrafts],
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

  const findDraftForError = (error: PerceptionError) =>
    optimizeDrafts.find((draft) => getOptimizationActionMatchIds(draft.id).includes(error.id));

  const handleRemoveAction = async (error: PerceptionError) => {
    setPersistError(null);
    const draft = findDraftForError(error);
    if (!draft || savingErrorIds.has(error.id)) return;

    if (!initialData.metadata.projectId || !draft.persistedId) {
      setOptimizeDrafts((current) =>
        current.filter((item) => !getOptimizationActionMatchIds(item.id).includes(error.id)),
      );
      return;
    }

    setSavingErrorIds((current) => new Set(current).add(error.id));
    try {
      await deletePerceptionClientJSON<{ deleted: boolean }>(
        apiRoutes.analysis.optimizeAction(initialData.metadata.projectId, draft.persistedId),
      );
      setOptimizeDrafts((current) =>
        current.filter((item) => !getOptimizationActionMatchIds(item.id).includes(error.id)),
      );
    } catch (err) {
      setPersistError(
        err instanceof Error ? err.message : t("optimizeActionsCreateError"),
      );
    } finally {
      setSavingErrorIds((current) => {
        const next = new Set(current);
        next.delete(error.id);
        return next;
      });
    }
  };

  const handleFix = async (error: PerceptionError) => {
    setPersistError(null);
    if (savingErrorIds.has(error.id)) return;
    if (generatedIds.has(error.id)) {
      await handleRemoveAction(error);
      return;
    }

    const localizedGeneratedContent = resolvePerceptionGeneratedContent(
      error.generatedContent,
      error.generatedContentKey,
      locale,
    );

    if (!initialData.metadata.projectId) {
      setOptimizeDrafts((current) =>
        current.some((draft) => draft.id === error.id)
          ? current
          : [
              {
                id: error.id,
                priority: error.optimizePriority,
                type: error.fixType,
                title: error.title,
                issue: error.issue,
                impact: error.impact,
                generatedContent: localizedGeneratedContent,
                status: "processing",
              },
              ...current,
            ],
      );
      return;
    }

    setSavingErrorIds((current) => new Set(current).add(error.id));
    try {
      const result = await postPerceptionClientJSON<{
        id: string;
        generatedContent?: string;
        status: string;
      }>(
        apiRoutes.analysis.optimizeActions(initialData.metadata.projectId),
        {
          priority: error.optimizePriority,
          type: error.fixType,
          title: error.title,
          issue: error.issue,
          impact: error.impact,
          generatedContent: localizedGeneratedContent,
          status: "processing",
          sourceErrorId: toCanonicalPerceptionSourceErrorId(error.id),
          metadata: {
            detectedInModels: error.detectedInModels,
            aiModels: error.detectedInModels,
            createdBy: "ai",
            workflow: "perception_fix",
            promptsCount: 0,
          },
        },
      );

      setOptimizeDrafts((current) =>
        current.some((draft) => draft.id === error.id)
          ? current
          : [
              {
                id: error.id,
                persistedId: result.id,
                priority: error.optimizePriority,
                type: error.fixType,
                title: error.title,
                issue: error.issue,
                impact: error.impact,
                generatedContent: result.generatedContent || localizedGeneratedContent,
                status: result.status || "processing",
              },
              ...current,
            ],
      );
    } catch (err) {
      setPersistError(
        err instanceof Error ? err.message : t("optimizeActionsCreateError"),
      );
    } finally {
      setSavingErrorIds((current) => {
        const next = new Set(current);
        next.delete(error.id);
        return next;
      });
    }
  };

  const estimatedPerceptionCredits = useMemo(() => {
    const modelCreditCostSum = Math.max(
      1,
      modelCatalog.reduce(
        (total, model) => total + Math.max(1, Math.floor(model.creditCost ?? 1)),
        0,
      ),
    );
    return 10 + 5 * modelCreditCostSum;
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

  const handleRunPerceptionAnalysis = async () => {
    const projectId = initialData.metadata.projectId;
    if (!projectId || analysisRunning) return;
    if (perceptionQuotaExceeded) {
      pushWarningToast(
        "Crédits insuffisants",
        `Cette analyse coûte ${estimatedPerceptionCredits} crédits. Il reste ${quotaQuery.data?.remainingCredits ?? 0}/${quotaQuery.data?.monthlyCredits ?? 0} crédits sur votre quota mensuel.`,
      );
      return;
    }

    setAnalysisError(null);
    setLastAnalysisCredits(null);
    setAnalysisRunning(true);
    try {
      const result = await postPerceptionClientJSON<{
        RequestedCredits?: number;
        requestedCredits?: number;
      }>(apiRoutes.analysis.perceptionRun(projectId), {
        force: true,
        requestId: `${projectId}-perception-manual-${Date.now()}`,
      });
      const credits =
        typeof result.requestedCredits === "number"
          ? result.requestedCredits
          : typeof result.RequestedCredits === "number"
            ? result.RequestedCredits
            : estimatedPerceptionCredits;
      setLastAnalysisCredits(credits);
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : "Impossible de lancer l'analyse de perception.",
      );
    } finally {
      setAnalysisRunning(false);
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
    selectedPeriod,
    setSelectedPeriod,
    showAllModels,
    setShowAllModels,
    showUniqueModelFilters,
    setShowUniqueModelFilters,
    filteredResponses,
    filteredRadar,
    filteredTopErrors,
    modelAxisHeatmap,
    perceptionTrend,
    scoreCards,
    optimizeDrafts,
    persistError,
    generatedIds,
    visibleOptimizeDrafts,
    actionStatusesByErrorId,
    savingErrorIds,
    analysisRunning,
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
      filteredRadar.length === 0 &&
      filteredTopErrors.length === 0 &&
      visibleOptimizeDrafts.length === 0,
    handleFix,
    handleRemoveAction,
    handleRunPerceptionAnalysis,
    handleExportPerceptionData,
  };
}
