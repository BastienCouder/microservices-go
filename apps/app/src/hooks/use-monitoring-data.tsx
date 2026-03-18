import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";

import {
  MonitoringRequestError,
  getMonitoringQueryContext,
  loadMonitoringData,
  type MonitoringData,
  type MonitoringModel,
  type MonitoringPrompt,
} from "@/lib/monitoring-data";
import { appQueryKeys } from "@/lib/query-keys";
import type { RuntimeMode } from "@/lib/runtime-mode";

type MonitoringDataContextValue = {
  data: MonitoringData;
  loading: boolean;
  error: string | null;
  mode: RuntimeMode;
  projectId: string | null;
  refresh: () => Promise<void>;
};

type MonitoringDataProviderProps = {
  apiBaseURL: string;
  routeSearch: string;
  includeHistoricalModels?: boolean;
  children: ReactNode;
};

const MonitoringDataContext = createContext<MonitoringDataContextValue | null>(null);

function isAbortError(err: unknown) {
  return err instanceof Error && err.name === "AbortError";
}

function toMonitoringErrorMessage(err: unknown): string {
  if (err instanceof MonitoringRequestError) {
    return "Impossible de charger le monitoring pour le moment.";
  }

  return "Impossible de charger le monitoring pour le moment.";
}

const EMPTY_MONITORING_DATA: MonitoringData = {
  project: {
    id: "",
    name: "",
    tagline: "",
    personas: [],
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

export function MonitoringDataProvider({
  apiBaseURL,
  routeSearch,
  includeHistoricalModels = false,
  children,
}: MonitoringDataProviderProps) {
  const { projectId: queryProjectId, mode: queryMode } = useMemo(
    () => getMonitoringQueryContext(routeSearch),
    [routeSearch],
  );
  const monitoringQuery = useQuery({
    queryKey: appQueryKeys.monitoring(
      apiBaseURL,
      queryProjectId,
      queryMode,
      includeHistoricalModels ? "include_historical_models" : "active_only",
    ),
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) =>
      loadMonitoringData(apiBaseURL, routeSearch, {
        signal,
        includeHistoricalModels,
      }),
  });

  const refresh = useCallback(async () => {
    await monitoringQuery.refetch();
  }, [monitoringQuery.refetch]);

  const error =
    monitoringQuery.error && !isAbortError(monitoringQuery.error)
      ? toMonitoringErrorMessage(monitoringQuery.error)
      : null;
  const result = monitoringQuery.data;
  const data = result?.data ?? EMPTY_MONITORING_DATA;
  const mode: RuntimeMode = result?.mode ?? "live";
  const projectId = result?.projectId ?? null;
  const loading = monitoringQuery.isLoading || (monitoringQuery.isFetching && !monitoringQuery.data);

  const value = useMemo<MonitoringDataContextValue>(
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
    <MonitoringDataContext.Provider value={value}>
      {children}
    </MonitoringDataContext.Provider>
  );
}

export function useMonitoringData(): MonitoringDataContextValue {
  const context = useContext(MonitoringDataContext);
  if (!context) {
    throw new Error("useMonitoringData must be used inside MonitoringDataProvider");
  }
  return context;
}

export type { MonitoringData, MonitoringModel, MonitoringPrompt };
