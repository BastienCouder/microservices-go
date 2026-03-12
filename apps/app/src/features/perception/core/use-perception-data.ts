import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import { loadPerceptionData, type PerceptionViewData } from "@/lib/perception-data";
import { appQueryKeys } from "@/lib/query-keys";
import { resolveRuntimeMode } from "@/lib/runtime-mode";

type UsePerceptionDataResult = {
  data: PerceptionViewData | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function usePerceptionData(apiBaseURL: string, routeSearch: string): UsePerceptionDataResult {
  const projectId = readProjectIdFromSearch(routeSearch);
  const runtimeMode = resolveRuntimeMode(routeSearch);
  const perceptionQuery = useQuery({
    queryKey: appQueryKeys.perception(apiBaseURL, projectId, runtimeMode),
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) => loadPerceptionData(apiBaseURL, routeSearch, { signal }),
  });

  const reload = useCallback(async () => {
    await perceptionQuery.refetch();
  }, [perceptionQuery.refetch]);

  return {
    data: perceptionQuery.data?.data ?? null,
    loading: perceptionQuery.isLoading || (perceptionQuery.isFetching && !perceptionQuery.data),
    error: perceptionQuery.error instanceof Error ? perceptionQuery.error.message : null,
    reload,
  };
}

function readProjectIdFromSearch(routeSearch: string): string | null {
  const normalized = routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch;
  const params = new URLSearchParams(normalized);
  const value = params.get("projectId") || params.get("project_id") || params.get("project") || "";
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
