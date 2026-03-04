"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRoutes } from "@/lib/api-config";
import { apiFetchRuntimeJson } from "@/lib/runtime-api";
import { resolveRuntimeContext, type RuntimeContext, type RuntimeMode } from "@/lib/runtime-mode";
import {
  type AlertApi,
  type ApiEnvelope,
  type CompetitorApi,
  type DashboardApi,
  type DashboardData,
  mapDashboardData,
  type PagesStatsApi,
  type ProjectModelApi,
  type ProjectApi,
  type PromptApi,
} from "@/lib/dashboard-data";

export type { DashboardData, DashboardPrompt } from "@/lib/dashboard-data";

type DashboardState = {
  data: DashboardData;
  isLoading: boolean;
  error: string | null;
  mode: RuntimeMode;
  projectId: string | null;
};

const DashboardDataContext = createContext<DashboardState | null>(null);
async function fetchDashboardDataForContext(context: RuntimeContext): Promise<DashboardData> {
  if (context.mode === "demo" || !context.projectId) {
    throw new Error("Dashboard backend data unavailable: missing projectId (demo mode disabled).");
  }

  const projectId = context.projectId;

  const [projectRes, promptsRes, competitorsRes, projectModelsRes, dashboardRes, alertsRes, pagesStatsRes] = await Promise.all([
    apiFetchRuntimeJson<ApiEnvelope<ProjectApi>>({
      projectPath: () => apiRoutes.projects.get(projectId),
      demoPath: apiRoutes.projects.get("demo"),
      mode: "project",
      projectId,
    }).catch(() => undefined),
    apiFetchRuntimeJson<ApiEnvelope<PromptApi[]>>({
      projectPath: () => apiRoutes.projects.prompts(projectId),
      demoPath: apiRoutes.projects.prompts("demo"),
      mode: "project",
      projectId,
    }).catch(() => undefined),
    apiFetchRuntimeJson<ApiEnvelope<CompetitorApi[]>>({
      projectPath: () => apiRoutes.projects.competitors(projectId),
      demoPath: apiRoutes.projects.competitors("demo"),
      mode: "project",
      projectId,
    }).catch(() => undefined),
    apiFetchRuntimeJson<ApiEnvelope<ProjectModelApi[]>>({
      projectPath: () => apiRoutes.projects.models(projectId),
      demoPath: apiRoutes.projects.models("demo"),
      mode: "project",
      projectId,
    }).catch(() => undefined),
    apiFetchRuntimeJson<ApiEnvelope<DashboardApi>>({
      projectPath: () => apiRoutes.analysis.dashboard(projectId),
      demoPath: apiRoutes.analysis.dashboard("demo"),
      mode: "project",
      projectId,
    }).catch(() => undefined),
    apiFetchRuntimeJson<ApiEnvelope<AlertApi[]>>({
      projectPath: () => apiRoutes.analysis.alerts(projectId),
      demoPath: apiRoutes.analysis.alerts("demo"),
      mode: "project",
      projectId,
    }).catch(() => undefined),
    apiFetchRuntimeJson<PagesStatsApi>({
      projectPath: () => apiRoutes.analysis.pagesStats(projectId),
      demoPath: apiRoutes.analysis.pagesStats("demo"),
      mode: "project",
      projectId,
    }).catch(() => undefined),
  ]);

  const mapped = mapDashboardData({
    project: projectRes?.data,
    prompts: promptsRes?.data,
    competitors: competitorsRes?.data,
    projectModels: projectModelsRes?.data,
    dashboard: dashboardRes?.data,
    alerts: alertsRes?.data,
    pagesStats: pagesStatsRes || undefined,
  });

  return mapped;
}

type DashboardDataProviderProps = {
  children: ReactNode;
  initialData: DashboardData;
  initialMode: RuntimeMode;
  initialProjectId: string | null;
};

export function DashboardDataProvider({
  children,
  initialData,
  initialMode,
  initialProjectId,
}: DashboardDataProviderProps) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const context = useMemo(() => resolveRuntimeContext(), []);

  useEffect(() => {
    let cancelled = false;

    const hasSameProject =
      context.mode === initialMode &&
      (context.projectId || null) === (initialProjectId || null);

    if (hasSameProject) {
      return;
    }

    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const mapped = await fetchDashboardDataForContext(context);
        if (!cancelled) {
          setData(mapped);
        }
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : String(e);
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [context.mode, context.projectId, initialMode, initialProjectId]);

  return (
    <DashboardDataContext.Provider
      value={{
        data,
        isLoading,
        error,
        mode: context.mode,
        projectId: context.projectId,
      }}
    >
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  const provided = useContext(DashboardDataContext);
  if (!provided) {
    throw new Error("useDashboardData must be used within DashboardDataProvider.");
  }
  return provided;
}
