import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { apiRoutes } from "@/lib/api-config";
import type { ProjectModelMeta } from "@/lib/project-models";
import { appQueryKeys } from "@/lib/query-keys";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { getPerceptionClientJSON, patchPerceptionClientJSON, postPerceptionClientJSON } from "../client-api";
import { getOptimizationActionMatchIds } from "../optimization-action-ids";
import { resolvePerceptionGeneratedContent } from "../perception-i18n";
import {
  loadOptimizationErrors,
  readOptimizationProjectIdFromSearch,
  type OptimizationError,
  type OptimizationErrorsBoard,
} from "./optimization-errors-data";
import type {
  OptimizePriority,
  PerceptionError,
} from "./perception-data";

type OptimizeActionStatus = "draft" | "published" | "processing" | "done" | string;

type PersistedOptimizeAction = {
  id: string;
  priority: OptimizePriority;
  type: PerceptionError["fixType"] | string;
  title: string;
  issue: string;
  impact?: string | null;
  generatedContent: string;
  status?: OptimizeActionStatus | null;
  sourceErrorId?: string | null;
};

type UseOptimizationErrorsResult = {
  competitors: string[];
  data: OptimizationErrorsBoard | null;
  generatedIds: ReadonlySet<string>;
  actionStatusesByErrorId: ReadonlyMap<string, OptimizeActionStatus>;
  loading: boolean;
  markingDoneErrorIds: ReadonlySet<string>;
  modelCatalog: ProjectModelMeta[];
  error: string | null;
  persistError: string | null;
  savingErrorIds: ReadonlySet<string>;
  handleFix: (error: OptimizationError) => Promise<void>;
  handleMarkDone: (error: OptimizationError) => Promise<void>;
  reload: () => Promise<void>;
};

export function useOptimizationErrors(apiBaseURL: string, routeSearch: string): UseOptimizationErrorsResult {
  const { locale, t } = useScopedI18n("perception");
  const projectId = readOptimizationProjectIdFromSearch(routeSearch);
  const [persistedActions, setPersistedActions] = useState<PersistedOptimizeAction[]>([]);
  const [savingErrorIds, setSavingErrorIds] = useState<Set<string>>(new Set());
  const [markingDoneErrorIds, setMarkingDoneErrorIds] = useState<Set<string>>(new Set());
  const [persistError, setPersistError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: appQueryKeys.optimizationErrors(apiBaseURL, projectId),
    enabled: apiBaseURL.trim() !== "",
    queryFn: () => loadOptimizationErrors(apiBaseURL, routeSearch),
  });
  const activeProjectId = query.data?.projectId ?? projectId ?? "";

  useEffect(() => {
    if (!activeProjectId) return;

    let isMounted = true;
    void getPerceptionClientJSON<PersistedOptimizeAction[]>(
      apiRoutes.analysis.optimizeActions(activeProjectId),
    )
      .then((actions) => {
        if (isMounted) {
          setPersistedActions(actions);
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [activeProjectId]);

  const generatedIds = useMemo(
    () =>
      new Set(
        persistedActions
          .flatMap((action) => getOptimizationActionMatchIds(action.sourceErrorId || action.id)),
      ),
    [persistedActions],
  );
  const actionsByErrorId = useMemo(() => {
    const actions = new Map<string, PersistedOptimizeAction>();
    for (const action of persistedActions) {
      const errorIds = getOptimizationActionMatchIds(action.sourceErrorId || action.id);
      for (const errorId of errorIds) {
        if (!actions.has(errorId)) actions.set(errorId, action);
      }
    }
    return actions;
  }, [persistedActions]);
  const actionStatusesByErrorId = useMemo(() => {
    const statuses = new Map<string, OptimizeActionStatus>();
    for (const [errorId, action] of actionsByErrorId) {
      statuses.set(errorId, action.status || "draft");
    }
    return statuses;
  }, [actionsByErrorId]);

  const handleFix = useCallback(
    async (error: OptimizationError) => {
      setPersistError(null);
      if (savingErrorIds.has(error.id) || generatedIds.has(error.id) || !activeProjectId) return;

      const localizedGeneratedContent = resolvePerceptionGeneratedContent(
        error.generatedContent,
        error.generatedContentKey,
        locale,
      );

      setSavingErrorIds((current) => new Set(current).add(error.id));
      try {
        const result = await postPerceptionClientJSON<{ id: string; status: OptimizeActionStatus }>(
          apiRoutes.analysis.optimizeActions(activeProjectId),
          {
            priority: error.optimizePriority,
            type: error.fixType,
            title: error.title,
            issue: error.issue,
            impact: error.impact,
            generatedContent: localizedGeneratedContent,
            status: "processing",
            sourceErrorId: error.id,
            metadata: {
              source: error.source,
              detectedInModels: error.detectedInModels,
              aiModels: error.detectedInModels,
              createdBy: "ai",
              workflow: "error_hub_fix",
              promptsCount: 0,
            },
          },
        );

        setPersistedActions((current) => [
          {
            id: result.id,
            priority: error.optimizePriority,
            type: error.fixType,
            title: error.title,
            issue: error.issue,
            impact: error.impact,
            generatedContent: localizedGeneratedContent,
            status: result.status || "processing",
            sourceErrorId: error.id,
          },
          ...current,
        ]);
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
    },
    [activeProjectId, generatedIds, locale, savingErrorIds, t],
  );

  const handleMarkDone = useCallback(
    async (error: OptimizationError) => {
      setPersistError(null);
      const action = actionsByErrorId.get(error.id);
      if (!action || action.status === "done" || markingDoneErrorIds.has(error.id) || !activeProjectId) return;

      setMarkingDoneErrorIds((current) => new Set(current).add(error.id));
      const previousStatus = action.status || "processing";
      setPersistedActions((current) =>
        current.map((item) => (item.id === action.id ? { ...item, status: "done" } : item)),
      );

      try {
        const result = await patchPerceptionClientJSON<{ id: string; status: OptimizeActionStatus }>(
          apiRoutes.analysis.optimizeAction(activeProjectId, action.id),
          { status: "done" },
        );
        setPersistedActions((current) =>
          current.map((item) =>
            item.id === action.id ? { ...item, status: result.status || "done" } : item,
          ),
        );
      } catch (err) {
        setPersistedActions((current) =>
          current.map((item) => (item.id === action.id ? { ...item, status: previousStatus } : item)),
        );
        setPersistError(
          err instanceof Error ? err.message : t("optimizeActionsCreateError"),
        );
      } finally {
        setMarkingDoneErrorIds((current) => {
          const next = new Set(current);
          next.delete(error.id);
          return next;
        });
      }
    },
    [actionsByErrorId, activeProjectId, markingDoneErrorIds, t],
  );

  const reload = useCallback(async () => {
    await query.refetch();
  }, [query.refetch]);

  return {
    competitors: query.data?.competitors ?? [],
    data: query.data?.data ?? null,
    generatedIds,
    actionStatusesByErrorId,
    loading: query.isLoading || (query.isFetching && !query.data),
    markingDoneErrorIds,
    modelCatalog: query.data?.modelCatalog ?? [],
    error: query.error instanceof Error ? query.error.message : null,
    persistError,
    savingErrorIds,
    handleFix,
    handleMarkDone,
    reload,
  };
}
