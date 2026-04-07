"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRoutes } from "@/lib/api-config";
import {
  derivePerceptionHeatmapFromResponses,
  derivePerceptionRadarFromResponses,
  derivePerceptionScoresFromResponses,
  derivePerceptionTopErrorsFromResponses,
  derivePerceptionTrendSeries,
  filterPerceptionResponses,
  type OptimizePriority,
  type PerceptionError,
  type PerceptionTrendPeriodKey,
  type PerceptionViewData,
} from "@/lib/perception-data";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { getPerceptionClientJSON, postPerceptionClientJSON } from "./client-api";

type OptimizeDraft = {
  id: string;
  persistedId?: string;
  priority: OptimizePriority;
  type: PerceptionError["fixType"];
  title: string;
  issue: string;
  impact: string;
  generatedContent: string;
  status: "draft";
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
  }));
}

function mergeDrafts(
  current: OptimizeDraft[],
  actions: PersistedOptimizeAction[],
): OptimizeDraft[] {
  const merged = new Map(current.map((draft) => [draft.id, draft] as const));

  for (const action of actions) {
    const uiId = action.sourceErrorId || action.id;
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
      status: "draft",
    });
  }

  return Array.from(merged.values());
}

export function usePerceptionViewModel(initialData: PerceptionViewData) {
  const { locale, t } = useScopedI18n("perception");
  const [optimizeDrafts, setOptimizeDrafts] = useState<OptimizeDraft[]>([]);
  const [savingErrorIds, setSavingErrorIds] = useState<Set<string>>(new Set());
  const [persistError, setPersistError] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PerceptionTrendPeriodKey>("all");
  const [showAllModels, setShowAllModels] = useState(false);
  const [showUniqueModelFilters, setShowUniqueModelFilters] = useState(false);

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

  const filteredRadar = useMemo(
    () => derivePerceptionRadarFromResponses(filteredResponses),
    [filteredResponses],
  );
  const filteredTopErrors = useMemo(
    () => derivePerceptionTopErrorsFromResponses(initialData.brandCanon, filteredResponses, locale),
    [filteredResponses, initialData.brandCanon, locale],
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
    () => new Set(optimizeDrafts.map((draft) => draft.id)),
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

  const handleFix = async (error: PerceptionError) => {
    setPersistError(null);
    if (savingErrorIds.has(error.id)) return;

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
                generatedContent: error.generatedContent,
                status: "draft",
              },
              ...current,
            ],
      );
      return;
    }

    setSavingErrorIds((current) => new Set(current).add(error.id));
    try {
      const result = await postPerceptionClientJSON<{ id: string; status: string }>(
        apiRoutes.analysis.optimizeActions(initialData.metadata.projectId),
        {
          priority: error.optimizePriority,
          type: error.fixType,
          title: error.title,
          issue: error.issue,
          impact: error.impact,
          generatedContent: error.generatedContent,
          status: "draft",
          sourceErrorId: error.id,
          metadata: {
            detectedInModels: error.detectedInModels,
            aiModels: error.detectedInModels,
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
                generatedContent: error.generatedContent,
                status: "draft",
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
    savingErrorIds,
    handleFix,
  };
}
