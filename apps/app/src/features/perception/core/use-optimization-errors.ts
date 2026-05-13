import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { apiRoutes } from "@/lib/api-config";
import {
  loadOptimizationErrors,
  readOptimizationProjectIdFromSearch,
  type OptimizationError,
  type OptimizationErrorsBoard,
} from "@/lib/optimization-errors-data";
import type { OptimizePriority, PerceptionError } from "@/lib/perception-data";
import type { ProjectModelMeta } from "@/lib/project-models";
import { appQueryKeys } from "@/lib/query-keys";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { getPerceptionClientJSON, postPerceptionClientJSON } from "../_lib/client-api";

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

type UseOptimizationErrorsResult = {
  data: OptimizationErrorsBoard | null;
  generatedIds: ReadonlySet<string>;
  loading: boolean;
  modelCatalog: ProjectModelMeta[];
  error: string | null;
  persistError: string | null;
  savingErrorIds: ReadonlySet<string>;
  handleFix: (error: OptimizationError) => Promise<void>;
  reload: () => Promise<void>;
};

export function useOptimizationErrors(apiBaseURL: string, routeSearch: string): UseOptimizationErrorsResult {
  const { t } = useScopedI18n("perception");
  const projectId = readOptimizationProjectIdFromSearch(routeSearch);
  const [persistedActions, setPersistedActions] = useState<PersistedOptimizeAction[]>([]);
  const [savingErrorIds, setSavingErrorIds] = useState<Set<string>>(new Set());
  const [persistError, setPersistError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: appQueryKeys.optimizationErrors(apiBaseURL, projectId),
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) => loadOptimizationErrors(apiBaseURL, routeSearch, { signal }),
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
          .map((action) => action.sourceErrorId || action.id)
          .filter(Boolean),
      ),
    [persistedActions],
  );

  const handleFix = useCallback(
    async (error: OptimizationError) => {
      setPersistError(null);
      if (savingErrorIds.has(error.id) || generatedIds.has(error.id) || !activeProjectId) return;

      setSavingErrorIds((current) => new Set(current).add(error.id));
      try {
        const result = await postPerceptionClientJSON<{ id: string; status: string }>(
          apiRoutes.analysis.optimizeActions(activeProjectId),
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
              source: error.source,
              detectedInModels: error.detectedInModels,
              aiModels: error.detectedInModels,
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
            generatedContent: error.generatedContent,
            status: "draft",
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
    [activeProjectId, generatedIds, savingErrorIds, t],
  );

  const reload = useCallback(async () => {
    await query.refetch();
  }, [query.refetch]);

  return {
    data: query.data?.data ?? null,
    generatedIds,
    loading: query.isLoading || (query.isFetching && !query.data),
    modelCatalog: query.data?.modelCatalog ?? [],
    error: query.error instanceof Error ? query.error.message : null,
    persistError,
    savingErrorIds,
    handleFix,
    reload,
  };
}
