import type { DateRange } from "react-day-picker";

import type { RuntimeMode } from "@/lib/runtime-mode";
import { resolveRuntimeMode } from "@/lib/runtime-mode";
import { gatewayJSON } from "@/shared/api/gateway";

export type DashboardCompetitor = {
  name: string;
  website: string;
  initials: string;
  sov: number;
  trend: "up" | "down" | "stable";
};

export type DashboardModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  icon: string;
  live: boolean;
};

export type DashboardPrompt = {
  model: string;
  modelFilterKey?: string;
  modelIconKey?: string;
  text: string;
  persona: string;
  competitorsMentioned: string[];
  mention: boolean;
  rank?: number;
  score: number;
  time: string;
  createdAt?: string;
};

export type DashboardAlert = {
  type: string;
  prompts: string;
  msg: string;
  time: string;
  isRead: boolean;
  createdAt?: string;
  modelIds?: string[];
  personas?: string[];
  competitors?: string[];
};

export type DashboardData = {
  project: {
    id: string;
    name: string;
    tagline: string;
    competitors: DashboardCompetitor[];
  };
  models: DashboardModel[];
  recent_prompts: DashboardPrompt[];
  alerts: DashboardAlert[];
  kpis: {
    mention_rate: { value: string; trend: string };
    visibility_score: { value: string; trend: string };
    avg_position: { value: string; trend: string };
  };
  trends: {
    mention_rate: number;
    visibility_score: number;
    avg_position: number;
  };
  pagesStats: {
    pages: Array<{ pageUrl: string; citationShare: number }>;
  };
};

export type DashboardLoadResult = {
  data: DashboardData;
  projectId: string | null;
  mode: RuntimeMode;
};

type JsonObject = Record<string, unknown>;
type DashboardRequestScope = "projects" | "project" | "models" | "competitors" | "dashboard" | "alerts";

export type DashboardLoadFilters = {
  period: string;
  dateRange: DateRange | undefined;
  selectedModels: string[];
  selectedPersonas: string[];
  selectedCompetitors: string[];
};

export class DashboardRequestError extends Error {
  scope: DashboardRequestScope;
  status: number;

  constructor(scope: DashboardRequestScope, status: number, message?: string) {
    super(message || `dashboard request failed: ${scope}`);
    this.name = "DashboardRequestError";
    this.scope = scope;
    this.status = status;
  }
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" ? (value as JsonObject) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  return asArray(value)
    .map((entry) => asString(entry).trim())
    .filter(Boolean);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asBool(value: unknown): boolean {
  return value === true;
}

function normalizeFilterValue(value: string): string {
  return value.trim().toLowerCase();
}

function getField<T = unknown>(obj: JsonObject, keys: string[]): T | undefined {
  for (const key of keys) {
    if (key in obj) {
      return obj[key] as T;
    }
  }
  return undefined;
}

function unwrapSuccessEnvelope(value: unknown): unknown {
  const obj = asObject(value);
  const success = getField<boolean>(obj, ["success"]);
  if (success === true && "data" in obj) {
    return obj.data;
  }
  return value;
}

function unwrapRequiredEnvelope<T>(
  result: Awaited<ReturnType<typeof gatewayJSON<T>>>,
  scope: DashboardRequestScope,
): unknown {
  if (!result.ok) {
    throw new DashboardRequestError(scope, result.status, result.error);
  }
  return unwrapSuccessEnvelope(result.data);
}

function toInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "NA";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function toRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

function normalizeModelId(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

function toPersona(response: JsonObject, promptRunsById: Map<string, JsonObject>, promptRunId: string): string {
  const fromResponse = asString(
    getField(response, ["persona", "personaName", "personaLabel", "Persona", "PersonaName", "PersonaLabel"]),
  ).trim();
  if (fromResponse !== "") {
    return fromResponse;
  }

  const promptRun = promptRunsById.get(promptRunId);
  if (!promptRun) {
    return "";
  }

  return asString(
    getField(promptRun, ["persona", "personaName", "personaLabel", "Persona", "PersonaName", "PersonaLabel"]),
  ).trim();
}

function scoreFromAnalysis(response: JsonObject): number {
  const mention = asBool(getField(response, ["brandMentioned", "BrandMentioned"]));
  const citation = asBool(getField(response, ["citationFound", "CitationFound"]));
  const sentiment = asString(getField(response, ["sentiment", "Sentiment"]))
    .trim()
    .toLowerCase();
  const position = asString(getField(response, ["brandPosition", "BrandPosition"]))
    .trim()
    .toLowerCase();

  let score = 30;
  if (mention) score += 35;
  if (citation) score += 20;
  if (sentiment === "positive") score += 10;
  if (sentiment === "neutral") score += 5;
  if (position === "first" || position === "top" || position === "1") score += 10;
  if (position === "second" || position === "2") score += 5;

  return Math.max(0, Math.min(100, score));
}

function rankFromPosition(response: JsonObject): number | undefined {
  const position = asString(getField(response, ["brandPosition", "BrandPosition"]))
    .trim()
    .toLowerCase();
  if (["1", "first", "top"].includes(position)) return 1;
  if (["2", "second"].includes(position)) return 2;
  if (["3", "third"].includes(position)) return 3;
  return undefined;
}

function readProjectIdFromSearch(routeSearch: string): string | null {
  const normalized = routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch;
  const params = new URLSearchParams(normalized);
  const value =
    params.get("projectId") || params.get("project_id") || params.get("project") || "";
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function pickProjectTagline(project: JsonObject): string {
  const brandDescription = asString(getField(project, ["brandDescription", "BrandDescription"]));
  if (brandDescription !== "") return brandDescription;
  const website = asString(getField(project, ["websiteUrl", "WebsiteURL"]));
  if (website !== "") return website;
  const domain = asString(getField(project, ["domain", "Domain"]));
  if (domain !== "") return domain;
  return "";
}

function fallbackDashboardData(): DashboardData {
  return {
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
    pagesStats: { pages: [] },
  };
}

function alertMatchesDateScope(
  alert: Pick<DashboardAlert, "createdAt">,
  period: string,
  dateRange: DateRange | undefined,
) {
  if (!alert.createdAt) {
    return period === "7d" && dateRange === undefined;
  }

  const createdAt = new Date(alert.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }

  const now = new Date();

  if (period === "custom") {
    if (!dateRange?.from) return true;
    const from = new Date(dateRange.from);
    from.setHours(0, 0, 0, 0);
    const to = new Date(dateRange.to ?? dateRange.from);
    to.setHours(23, 59, 59, 999);
    return createdAt >= from && createdAt <= to;
  }

  const from = new Date(now);
  if (period === "today" || period === "24h") from.setHours(from.getHours() - 24);
  else if (period === "14d") from.setDate(from.getDate() - 14);
  else if (period === "30d") from.setDate(from.getDate() - 30);
  else if (period === "90d") from.setDate(from.getDate() - 90);
  else from.setDate(from.getDate() - 7);

  return createdAt >= from && createdAt <= now;
}

function alertMatchesAudienceScope(
  values: string[] | undefined,
  selected: string[],
) {
  if (selected.length === 0) {
    return true;
  }
  if (!values || values.length === 0) {
    return false;
  }

  const normalizedValues = values.map(normalizeFilterValue);
  return selected.some((value) => normalizedValues.includes(normalizeFilterValue(value)));
}

export function filterDashboardAlerts(
  alerts: DashboardAlert[],
  filters: DashboardLoadFilters,
): DashboardAlert[] {
  return alerts.filter((alert) => {
    if (!alertMatchesDateScope(alert, filters.period, filters.dateRange)) {
      return false;
    }

    return (
      alertMatchesAudienceScope(alert.modelIds, filters.selectedModels) &&
      alertMatchesAudienceScope(alert.personas, filters.selectedPersonas) &&
      alertMatchesAudienceScope(alert.competitors, filters.selectedCompetitors)
    );
  });
}

function computeKpis(prompts: DashboardPrompt[]): DashboardData["kpis"] {
  if (prompts.length === 0) {
    return {
      mention_rate: { value: "0%", trend: "+0 vs 7j" },
      visibility_score: { value: "0 / 100", trend: "+0 vs 7j" },
      avg_position: { value: "0", trend: "+0 (meilleure position)" },
    };
  }

  const mentionCount = prompts.filter((prompt) => prompt.mention).length;
  const mentionRate = Math.round((mentionCount / prompts.length) * 100);
  const visibilityScore = Math.round(
    prompts.reduce((sum, prompt) => sum + prompt.score, 0) / prompts.length,
  );
  const ranked = prompts.filter((prompt) => typeof prompt.rank === "number");
  const avgPosition =
    ranked.length === 0
      ? 0
      : Number(
          (
            ranked.reduce((sum, prompt) => sum + (prompt.rank ?? 0), 0) / ranked.length
          ).toFixed(1),
        );

  return {
    mention_rate: { value: `${mentionRate}%`, trend: "+0 vs 7j" },
    visibility_score: { value: `${visibilityScore} / 100`, trend: "+0 vs 7j" },
    avg_position: { value: `${avgPosition}`, trend: "+0 (meilleure position)" },
  };
}

export async function loadDashboardData(
  apiBaseURL: string,
  routeSearch: string,
  options?: { signal?: AbortSignal },
): Promise<DashboardLoadResult> {
  const mode = resolveRuntimeMode(routeSearch);
  const fallback = fallbackDashboardData();

  if (apiBaseURL.trim() === "") {
    return { data: fallback, projectId: null, mode };
  }

  let projectId = readProjectIdFromSearch(routeSearch);

  const projectsPayload = unwrapRequiredEnvelope(
    await gatewayJSON<unknown>(apiBaseURL, "/projects", {
      method: "GET",
      signal: options?.signal,
    }),
    "projects",
  );
  const projects = asArray(projectsPayload).map(asObject);

  if (!projectId) {
    const first = projects[0];
    if (first) {
      projectId = asString(getField(first, ["id", "ID"])) || null;
    }
  }

  if (!projectId) {
    return { data: fallback, projectId: null, mode };
  }

  const [projectRes, modelsRes, competitorsRes, dashboardRes, alertsRes] = await Promise.all([
    gatewayJSON<unknown>(apiBaseURL, `/projects/${projectId}`, {
      method: "GET",
      signal: options?.signal,
    }),
    gatewayJSON<unknown>(apiBaseURL, `/projects/${projectId}/models`, {
      method: "GET",
      signal: options?.signal,
    }),
    gatewayJSON<unknown>(apiBaseURL, `/projects/${projectId}/competitors`, {
      method: "GET",
      signal: options?.signal,
    }),
    gatewayJSON<unknown>(apiBaseURL, `/analysis/projects/${projectId}/dashboard`, {
      method: "GET",
      signal: options?.signal,
    }),
    gatewayJSON<unknown>(apiBaseURL, `/analysis/projects/${projectId}/alerts`, {
      method: "GET",
      signal: options?.signal,
    }),
  ]);

  const project = asObject(unwrapRequiredEnvelope(projectRes, "project"));
  const modelsPayload = asArray(unwrapRequiredEnvelope(modelsRes, "models"));
  const competitorsPayload = asArray(unwrapRequiredEnvelope(competitorsRes, "competitors"));
  const dashboardPayload = asObject(unwrapRequiredEnvelope(dashboardRes, "dashboard"));
  const alertsPayload = asArray(unwrapRequiredEnvelope(alertsRes, "alerts"));

  const models: DashboardModel[] = modelsPayload.map((entry) => {
    const row = asObject(entry);
    const id = asString(getField(row, ["id", "ID"])) || normalizeModelId(asString(getField(row, ["name", "label", "Name", "Label"])));
    const iconKey = asString(getField(row, ["iconKey", "IconKey"]));
    return {
      id,
      name: asString(getField(row, ["name", "label", "Name", "Label"])) || id,
      provider: asString(getField(row, ["provider", "Provider"])) || "unknown",
      description: asString(getField(row, ["description", "Description"])),
      icon: iconKey ? `/models/${iconKey}.svg` : `/models/${id}.svg`,
      live:
        asBool(getField(row, ["isEnabledForProject"])) ||
        asBool(getField(row, ["isActive", "IsActive"])) ||
        true,
    };
  });

  const modelById = new Map(models.map((model) => [model.id, model]));

  const competitors: DashboardCompetitor[] = competitorsPayload.map((entry) => {
    const row = asObject(entry);
    const name = asString(getField(row, ["name", "Name"]));
    return {
      name,
      website:
        asString(getField(row, ["websiteUrl", "WebsiteURL"])) ||
        asString(getField(row, ["domain", "Domain"])),
      initials: toInitials(name),
      sov: 0,
      trend: "stable",
    };
  });

  const promptRuns = asArray(getField(dashboardPayload, ["promptRuns", "PromptRuns"]))
    .map(asObject);
  const promptRunById = new Map(
    promptRuns.map((row) => [
      asString(getField(row, ["id", "ID"])),
      asString(getField(row, ["promptText", "PromptText"])) ||
      asString(getField(row, ["text", "Text"])),
    ]),
  );
  const promptRunMetaById = new Map(
    promptRuns.map((row) => [asString(getField(row, ["id", "ID"])), row]),
  );

  const projectName =
    asString(getField(project, ["brandName", "BrandName"])) ||
    asString(getField(project, ["name", "Name"])) ||
    "";
  const projectTagline = pickProjectTagline(project);

  const responses = asArray(getField(dashboardPayload, ["aiResponses", "responses", "Responses"])).map(asObject);

  const prompts: DashboardPrompt[] = responses.map((response) => {
    const modelId =
      asString(getField(response, ["modelId", "ModelID"])) ||
      normalizeModelId(asString(getField(response, ["model", "Model"])));
    const model = modelById.get(modelId);

    const createdAt = asString(getField(response, ["createdAt", "CreatedAt"]));
    const rawResponse = asString(getField(response, ["rawResponse", "RawResponse"]));
    const promptRunId = asString(getField(response, ["promptRunId", "PromptRunID"]));

    const competitorsMentioned = competitors
      .map((competitor) => competitor.name)
      .filter((name) => name !== "")
      .filter((name) => rawResponse.toLowerCase().includes(name.toLowerCase()));

    return {
      model: model?.name || modelId || "",
      modelFilterKey: modelId || undefined,
      modelIconKey: model?.id || undefined,
      text: promptRunById.get(promptRunId) || rawResponse.slice(0, 160) || "",
      persona: toPersona(response, promptRunMetaById, promptRunId),
      competitorsMentioned,
      mention: asBool(getField(response, ["brandMentioned", "BrandMentioned"])),
      rank: rankFromPosition(response),
      score: scoreFromAnalysis(response),
      time: createdAt ? toRelativeTime(createdAt) : "-",
      createdAt: createdAt || undefined,
    };
  });

  const promptsCount = Math.max(1, prompts.length);
  const competitorMentionCount = new Map<string, number>();
  for (const prompt of prompts) {
    for (const competitor of prompt.competitorsMentioned) {
      competitorMentionCount.set(
        competitor,
        (competitorMentionCount.get(competitor) ?? 0) + 1,
      );
    }
  }

  const normalizedCompetitors = competitors.map((competitor) => {
    const mentions = competitorMentionCount.get(competitor.name) ?? 0;
    const share = Math.round((mentions / promptsCount) * 1000) / 10;
    const trend: DashboardCompetitor["trend"] =
      share > 30 ? "up" : share > 10 ? "stable" : "down";
    return {
      ...competitor,
      sov: share,
      trend,
    };
  });

  const alerts: DashboardAlert[] = alertsPayload.map((entry) => {
    const row = asObject(entry);
    const severity = asString(getField(row, ["severity", "Severity"])) || "warning";
    const alertType =
      asString(getField(row, ["alertType", "AlertType"])) ||
      asString(getField(row, ["type", "Type"])) ||
      "update";
    const createdAt = asString(getField(row, ["createdAt", "CreatedAt"]));

    return {
      type: severity.toLowerCase() === "critical" ? "critical" : "warning",
      prompts: alertType,
      msg:
        asString(getField(row, ["title", "Title"])) ||
        asString(getField(row, ["description", "Description"])) ||
        "",
      time: createdAt ? toRelativeTime(createdAt) : "-",
      isRead: asBool(getField(row, ["isRead", "IsRead"])),
      createdAt: createdAt || undefined,
      modelIds: (() => {
        const modelIds = asStringArray(getField(row, ["modelIds", "ModelIDs"]));
        if (modelIds.length > 0) return modelIds;
        const modelId = asString(getField(row, ["modelId", "ModelID"])).trim();
        return modelId ? [modelId] : undefined;
      })(),
      personas: (() => {
        const personas = asStringArray(getField(row, ["personas", "Personas"]));
        if (personas.length > 0) return personas;
        const persona = asString(getField(row, ["persona", "Persona"])).trim();
        return persona ? [persona] : undefined;
      })(),
      competitors: (() => {
        const competitors = asStringArray(
          getField(row, ["competitors", "Competitors", "competitorNames", "CompetitorNames"]),
        );
        return competitors.length > 0 ? competitors : undefined;
      })(),
    };
  });

  const citedPagesCount = new Map<string, number>();
  for (const response of responses) {
    const urls = asArray(getField(response, ["citedUrls", "CitedURLs"]));
    for (const rawUrl of urls) {
      const value = asString(rawUrl).trim();
      if (value === "") continue;
      citedPagesCount.set(value, (citedPagesCount.get(value) ?? 0) + 1);
    }
  }

  const pages = Array.from(citedPagesCount.entries())
    .map(([pageUrl, count]) => ({
      pageUrl,
      citationShare: Number(((count / Math.max(1, responses.length)) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.citationShare - a.citationShare)
    .slice(0, 10);

  const data: DashboardData = {
    project: {
      id: projectId,
      name: projectName,
      tagline: projectTagline,
      competitors: normalizedCompetitors,
    },
    models,
    recent_prompts: prompts,
    alerts,
    kpis: computeKpis(prompts),
    trends: {
      mention_rate: 0,
      visibility_score: 0,
      avg_position: 0,
    },
    pagesStats: {
      pages,
    },
  };

  return { data, projectId, mode };
}
