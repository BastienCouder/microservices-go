import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import { loadPerceptionData, type PerceptionViewData } from "@/lib/perception-data";
import { appQueryKeys } from "@/lib/query-keys";

type UsePerceptionDataResult = {
  data: PerceptionViewData | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function usePerceptionData(apiBaseURL: string, routeSearch: string): UsePerceptionDataResult {
  const perceptionQuery = useQuery({
    queryKey: appQueryKeys.perception(apiBaseURL, routeSearch),
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
