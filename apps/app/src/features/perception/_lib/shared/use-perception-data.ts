import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import { appQueryKeys } from "@/lib/query-keys";
import { resolveRuntimeMode } from "@/lib/runtime-mode";
import { readOptionalProjectTokenFromSearch } from "@/shared/selection";
import {
  loadPerceptionData,
  type PerceptionViewData,
} from "./perception-data";

type UsePerceptionDataResult = {
  data: PerceptionViewData | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function usePerceptionData(apiBaseURL: string, routeSearch: string): UsePerceptionDataResult {
  const projectId = readOptionalProjectTokenFromSearch(routeSearch);
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
