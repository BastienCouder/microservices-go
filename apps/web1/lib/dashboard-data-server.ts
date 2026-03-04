import { apiRoutes } from "@/lib/api-config";
import { apiFetch } from "@/lib/server-api";
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

export type ServerDashboardContext = {
  mode: "demo" | "project";
  projectId: string | null;
};

export async function getDashboardDataServer(context: ServerDashboardContext): Promise<DashboardData> {
  if (context.mode === "demo" || !context.projectId) {
    throw new Error("Dashboard backend data unavailable: missing projectId (demo mode disabled).");
  }

  const projectId = context.projectId;

  const requestOptions = {
    cache: "no-store" as const,
  };

  const [projectRes, promptsRes, competitorsRes, projectModelsRes, dashboardRes, alertsRes, pagesStatsRes] = await Promise.all([
    apiFetch<ApiEnvelope<ProjectApi>>(apiRoutes.projects.get(projectId), requestOptions).catch(() => undefined),
    apiFetch<ApiEnvelope<PromptApi[]>>(apiRoutes.projects.prompts(projectId), requestOptions).catch(() => undefined),
    apiFetch<ApiEnvelope<CompetitorApi[]>>(apiRoutes.projects.competitors(projectId), requestOptions).catch(() => undefined),
    apiFetch<ApiEnvelope<ProjectModelApi[]>>(apiRoutes.projects.models(projectId), requestOptions).catch(() => undefined),
    apiFetch<ApiEnvelope<DashboardApi>>(apiRoutes.analysis.dashboard(projectId), requestOptions).catch(() => undefined),
    apiFetch<ApiEnvelope<AlertApi[]>>(apiRoutes.analysis.alerts(projectId), requestOptions).catch(() => undefined),
    apiFetch<PagesStatsApi>(apiRoutes.analysis.pagesStats(projectId), requestOptions).catch(() => undefined),
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
