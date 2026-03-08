import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";

import {
  DashboardRequestError,
  getDashboardQueryContext,
  loadDashboardData,
  type DashboardData,
  type DashboardPrompt,
} from "@/lib/dashboard-data";
import { appQueryKeys } from "@/lib/query-keys";
import type { RuntimeMode } from "@/lib/runtime-mode";

type DashboardDataContextValue = {
  data: DashboardData;
  loading: boolean;
  error: string | null;
  mode: RuntimeMode;
  projectId: string | null;
  refresh: () => Promise<void>;
};

type DashboardDataProviderProps = {
  apiBaseURL: string;
  routeSearch: string;
  children: ReactNode;
};

const DashboardDataContext = createContext<DashboardDataContextValue | null>(null);

function isAbortError(err: unknown) {
  return err instanceof Error && err.name === "AbortError";
}

function toDashboardErrorMessage(err: unknown): string {
  if (err instanceof DashboardRequestError) {
    return "Impossible de charger le dashboard pour le moment.";
  }

  return "Impossible de charger le dashboard pour le moment.";
}

const EMPTY_DASHBOARD_DATA: DashboardData = {
  project: {
    id: "",
    name: "",
    tagline: "",
    competitors: [],
  },
  models: [],
  recent_prompts: [],
  alerts: [],
  kpis: {
    mention_rate: { value: "0%", trend: "+0 vs 7j" },
    visibility_score: { value: "0 / 100", trend: "+0 vs 7j" },
    avg_position: { value: "0", trend: "+0 (meilleure position)" },
  },
  trends: {
    mention_rate: 0,
    visibility_score: 0,
    avg_position: 0,
  },
  pagesStats: {
    pages: [],
  },
};

export function DashboardDataProvider({
  apiBaseURL,
  routeSearch,
  children,
}: DashboardDataProviderProps) {
  const { projectId: queryProjectId, mode: queryMode } = useMemo(
    () => getDashboardQueryContext(routeSearch),
    [routeSearch],
  );
  const dashboardQuery = useQuery({
    queryKey: appQueryKeys.dashboard(apiBaseURL, queryProjectId, queryMode),
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) => loadDashboardData(apiBaseURL, routeSearch, { signal }),
  });

  const refresh = useCallback(async () => {
    await dashboardQuery.refetch();
  }, [dashboardQuery.refetch]);

  const error =
    dashboardQuery.error && !isAbortError(dashboardQuery.error)
      ? toDashboardErrorMessage(dashboardQuery.error)
      : null;
  const result = dashboardQuery.data;
  const data = result?.data ?? EMPTY_DASHBOARD_DATA;
  const mode: RuntimeMode = result?.mode ?? "live";
  const projectId = result?.projectId ?? null;
  const loading = dashboardQuery.isLoading || (dashboardQuery.isFetching && !dashboardQuery.data);

  const value = useMemo<DashboardDataContextValue>(
    () => ({
      data,
      loading,
      error,
      mode,
      projectId,
      refresh,
    }),
    [data, loading, error, mode, projectId, refresh],
  );

  return (
    <DashboardDataContext.Provider value={value}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData(): DashboardDataContextValue {
  const context = useContext(DashboardDataContext);
  if (!context) {
    throw new Error("useDashboardData must be used inside DashboardDataProvider");
  }
  return context;
}

export type { DashboardData, DashboardPrompt };
