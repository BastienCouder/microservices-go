import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  DashboardRequestError,
  loadDashboardData,
  type DashboardData,
  type DashboardPrompt,
} from "@/lib/dashboard-data";
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
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD_DATA);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<RuntimeMode>("live");
  const [projectId, setProjectId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const runRefresh = useCallback(async (signal?: AbortSignal) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      setLoading(true);
      setError(null);
      const result = await loadDashboardData(apiBaseURL, routeSearch, { signal });
      if (signal?.aborted || requestId !== requestIdRef.current) {
        return;
      }
      setData(result.data);
      setMode(result.mode);
      setProjectId(result.projectId);
    } catch (err) {
      if (isAbortError(err) || requestId !== requestIdRef.current) {
        return;
      }
      setError(toDashboardErrorMessage(err));
    } finally {
      if (!signal?.aborted && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [apiBaseURL, routeSearch]);

  const refresh = useCallback(async () => {
    await runRefresh();
  }, [runRefresh]);

  useEffect(() => {
    const controller = new AbortController();
    void runRefresh(controller.signal);
    return () => {
      controller.abort();
    };
  }, [runRefresh]);

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
