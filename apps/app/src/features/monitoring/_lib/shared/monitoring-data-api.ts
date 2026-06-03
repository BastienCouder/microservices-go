import { apiRoutes } from "@/lib/api-config";
import {
  buildProjectModelLookup,
  normalizeModelPayloadList,
  toProjectModelMeta,
} from "@/lib/project-models";
import { resolveRuntimeMode } from "@/lib/runtime-mode";
import { gatewayJSON, unwrapGatewayPayload } from "@/shared/api/gateway";
import { attachStableSlugs, findBySlugOrId } from "@/shared/public-slugs";
import { readOptionalProjectTokenFromSearch } from "@/shared/selection";
import {
  createEmptyMonitoringData,
  MonitoringRequestError,
  type MonitoringCompetitor,
  type MonitoringAlert,
  type MonitoringData,
  type MonitoringLoadResult,
  type MonitoringModel,
  type MonitoringPrompt,
  type MonitoringQueryContext,
  type MonitoringRequestScope,
} from "./monitoring-data-types";

type JsonObject = Record<string, unknown>;

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

function asPersonaArray(value: unknown): string[] {
  return asArray(value)
    .flatMap((entry) => {
      if (typeof entry === "string") {
        const normalizedValue = entry.trim();
        return normalizedValue ? [normalizedValue] : [];
      }

      const row = asObject(entry);
      const normalizedValue = asString(
        getField(row, [
          "name",
          "Name",
          "label",
          "Label",
          "persona",
          "Persona",
          "value",
          "Value",
        ]),
      ).trim();

      return normalizedValue ? [normalizedValue] : [];
    })
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

type ProjectRouteCandidate = {
  id: string;
  name: string;
  slug: string;
};

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

function unwrapRequiredEnvelope<T>(
  result: Awaited<ReturnType<typeof gatewayJSON<T>>>,
  scope: MonitoringRequestScope,
): unknown {
  if (!result.ok) {
    throw new MonitoringRequestError(scope, result.status, result.error);
  }
  return unwrapGatewayPayload(result.data);
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

function scoreFromAnalysis(response: JsonObject, citationFoundOverride?: boolean): number {
  const mention = asBool(getField(response, ["brandMentioned", "BrandMentioned"]));
  const citation =
    citationFoundOverride ??
    asBool(getField(response, ["citationFound", "CitationFound"]));
  const position = asString(getField(response, ["brandPosition", "BrandPosition"]))
    .trim()
    .toLowerCase();

  let score = 0;
  if (mention) score += 50;
  if (citation) score += 30;
  if (position === "first" || position === "top" || position === "1") score += 20;

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

function normalizeProjectCandidates(value: unknown): ProjectRouteCandidate[] {
  const payload = unwrapGatewayPayload(value);
  if (!Array.isArray(payload)) return [];

  return attachStableSlugs(
    payload
      .map(asObject)
      .map((entry) => ({
        id: asString(getField(entry, ["id", "ID"])).trim(),
        name: asString(getField(entry, ["name", "Name"])).trim() || "Projet",
      }))
      .filter((project) => project.id !== ""),
    "project",
  );
}

export function getMonitoringQueryContext(routeSearch: string): MonitoringQueryContext {
  return {
    projectId: readOptionalProjectTokenFromSearch(routeSearch),
    mode: resolveRuntimeMode(routeSearch),
  };
}

function encodeProjectPathSegment(projectId: string): string {
  return encodeURIComponent(projectId);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeComparableText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPhraseMatcher(value: string): RegExp | null {
  const normalized = normalizeComparableText(value);
  if (!normalized) return null;
  return new RegExp(`(?:^| )${escapeRegExp(normalized).replace(/\s+/g, " +")}(?=$| )`, "i");
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

function pickProjectWebsite(project: JsonObject): string {
  return (
    asString(getField(project, ["websiteUrl", "WebsiteURL"])).trim() ||
    asString(getField(project, ["domain", "Domain"])).trim()
  );
}

function parseComparableHost(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`);
    return normalizeComparableHost(parsed.hostname);
  } catch {
    const host = trimmed.replace(/^https?:\/\//i, "").split(/[/?#]/)[0] ?? "";
    if (!host.includes(".")) return null;
    return normalizeComparableHost(host);
  }
}

function normalizeComparableHost(value: string): string {
  return value.trim().toLowerCase().replace(/^www\./, "");
}

function isExactProjectURL(rawUrl: string, projectHost: string | null): boolean {
  if (!projectHost) return true;
  const urlHost = parseComparableHost(rawUrl);
  return urlHost === projectHost;
}

function pickProjectPersonas(project: JsonObject): string[] {
  const directPersonas = asPersonaArray(
    getField(project, [
      "brandPersonas",
      "BrandPersonas",
      "targetPersonas",
      "TargetPersonas",
      "personas",
      "Personas",
    ]),
  );
  const brandCanon = asObject(
    getField(project, ["brandCanon", "BrandCanon", "profile", "Profile"]),
  );
  const nestedPersonas = asPersonaArray(
    getField(brandCanon, [
      "brandPersonas",
      "BrandPersonas",
      "targetPersonas",
      "TargetPersonas",
      "personas",
      "Personas",
    ]),
  );

  return Array.from(
    new Set([...directPersonas, ...nestedPersonas].map((value) => value.trim()).filter(Boolean)),
  );
}

function computeKpis(prompts: MonitoringPrompt[]): MonitoringData["kpis"] {
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

export async function loadMonitoringData(
  apiBaseURL: string,
  routeSearch: string,
  options?: { signal?: AbortSignal; includeHistoricalModels?: boolean },
): Promise<MonitoringLoadResult> {
  const { mode, projectId: routeProjectId } = getMonitoringQueryContext(routeSearch);
  const fallback = createEmptyMonitoringData();

  if (apiBaseURL.trim() === "") {
    return { data: fallback, projectId: null, mode };
  }

  let projectId = routeProjectId;

  if (!projectId) {
    const projectsPayload = unwrapRequiredEnvelope(
      await gatewayJSON<unknown>(apiBaseURL, "/projects", {
        method: "GET",
        signal: options?.signal,
      }),
      "projects",
    );
    const projects = asArray(projectsPayload).map(asObject);

    const first = projects[0];
    if (first) {
      projectId = asString(getField(first, ["id", "ID"])) || null;
    }
  }

  if (!projectId) {
    return { data: fallback, projectId: null, mode };
  }

  let projectRes = await gatewayJSON<unknown>(
    apiBaseURL,
    `/projects/${encodeProjectPathSegment(projectId)}`,
    {
      method: "GET",
      signal: options?.signal,
    },
  );

  if (
    !projectRes.ok &&
    routeProjectId &&
    [401, 403, 404].includes(projectRes.status)
  ) {
    const projectsPayload = unwrapRequiredEnvelope(
      await gatewayJSON<unknown>(apiBaseURL, "/projects", {
        method: "GET",
        signal: options?.signal,
      }),
      "projects",
    );
    const projects = normalizeProjectCandidates(projectsPayload);
    const resolvedProject = findBySlugOrId(projects, routeProjectId);
    if (resolvedProject) {
      projectId = resolvedProject.id;
      projectRes = await gatewayJSON<unknown>(
        apiBaseURL,
        `/projects/${encodeProjectPathSegment(projectId)}`,
        {
          method: "GET",
          signal: options?.signal,
        },
      );
    }
  }

  const encodedProjectId = encodeProjectPathSegment(projectId);

  const [modelsRes, competitorsRes, monitoringRes, alertsRes] = await Promise.all([
    gatewayJSON<unknown>(apiBaseURL, `/projects/${encodedProjectId}/models`, {
      method: "GET",
      signal: options?.signal,
    }),
    gatewayJSON<unknown>(apiBaseURL, `/projects/${encodedProjectId}/competitors`, {
      method: "GET",
      signal: options?.signal,
    }),
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.analysis.monitoring(encodedProjectId), {
      method: "GET",
      signal: options?.signal,
    }),
    gatewayJSON<unknown>(apiBaseURL, `/analysis/projects/${encodedProjectId}/alerts`, {
      method: "GET",
      signal: options?.signal,
    }),
  ]);

  const project = asObject(unwrapRequiredEnvelope(projectRes, "project"));
  const modelsPayload = asArray(unwrapRequiredEnvelope(modelsRes, "models"));
  const competitorsPayload = asArray(unwrapRequiredEnvelope(competitorsRes, "competitors"));
  const monitoringPayload = asObject(unwrapRequiredEnvelope(monitoringRes, "monitoring"));
  const alertsPayload = asArray(unwrapRequiredEnvelope(alertsRes, "alerts"));

  const projectModels: MonitoringModel[] = normalizeModelPayloadList(modelsPayload).map((model) =>
    toProjectModelMeta(model),
  );

  const liveModels = projectModels.filter((model) => model.live);
  const models = options?.includeHistoricalModels ? projectModels : liveModels;
  const modelLookup = buildProjectModelLookup(projectModels);

  function resolveProjectModel(value: string): MonitoringModel | undefined {
    return modelLookup.get(normalizeFilterValue(value));
  }

  const competitors: MonitoringCompetitor[] = competitorsPayload.map((entry) => {
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

  const promptRuns = asArray(getField(monitoringPayload, ["promptRuns", "PromptRuns"]))
    .map(asObject);
  const promptRunById = new Map(
    promptRuns.map((row) => [
      asString(getField(row, ["id", "ID"])),
      asString(getField(row, ["promptText", "PromptText"])) ||
      asString(getField(row, ["text", "Text"])),
    ]),
  );
  const promptRunPromptIdById = new Map(
    promptRuns.map((row) => [
      asString(getField(row, ["id", "ID"])),
      asString(getField(row, ["promptId", "PromptID"])),
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
  const projectWebsite = pickProjectWebsite(project);
  const projectHost = parseComparableHost(projectWebsite);
  const projectPersonas = pickProjectPersonas(project);

  const responses = asArray(getField(monitoringPayload, ["aiResponses", "responses", "Responses"]))
    .map(asObject)
    .filter((response) => {
      const runType = asString(getField(response, ["runType", "RunType"])).trim().toLowerCase();
      if (runType === "perception") {
        return false;
      }
      if (options?.includeHistoricalModels) {
        return true;
      }
      const rawModelId =
        asString(getField(response, ["modelId", "ModelID"])) ||
        asString(getField(response, ["model", "Model"]));
      return resolveProjectModel(rawModelId)?.live === true;
    });
  const competitorMatchers = competitors
    .map((competitor) => ({ name: competitor.name, matcher: buildPhraseMatcher(competitor.name) }))
    .filter((entry): entry is { name: string; matcher: RegExp } => entry.matcher !== null);

  const prompts: MonitoringPrompt[] = responses.map((response) => {
    const rawModelId =
      asString(getField(response, ["modelId", "ModelID"])) ||
      asString(getField(response, ["model", "Model"]));
    const model = resolveProjectModel(rawModelId);

    const createdAt = asString(getField(response, ["createdAt", "CreatedAt"]));
    const rawResponse = asString(getField(response, ["rawResponse", "RawResponse"]));
    const promptRunId = asString(getField(response, ["promptRunId", "PromptRunID"]));
    const normalizedRawResponse = normalizeComparableText(rawResponse);

    const competitorsMentioned = competitorMatchers
      .filter(({ matcher }) => matcher.test(normalizedRawResponse))
      .map(({ name }) => name);

    const allCitedUrls = asArray(getField(response, ["citedUrls", "CitedURLs"]))
      .map((entry) => asString(entry).trim())
      .filter(Boolean);
    const citedUrls = allCitedUrls.filter((url) => isExactProjectURL(url, projectHost));
    const citationFound = citedUrls.length > 0;

    return {
      responseId: asString(getField(response, ["id", "ID"])),
      promptId: promptRunPromptIdById.get(promptRunId) || "",
      modelId: model?.id || rawModelId || "",
      modelGroupName: model?.groupName || model?.displayName || rawModelId || "",
      modelDisplayName: model?.displayName || rawModelId || "",
      modelProviderModelId: model?.providerModelId || rawModelId || "",
      modelIconPath: model?.iconPath || "",
      text: promptRunById.get(promptRunId) || rawResponse.slice(0, 160) || "",
      persona: toPersona(response, promptRunMetaById, promptRunId),
      competitorsMentioned,
      mention: asBool(getField(response, ["brandMentioned", "BrandMentioned"])),
      sentiment: (() => {
        const value = asString(getField(response, ["sentiment", "Sentiment"])).trim().toLowerCase();
        if (value === "positive" || value === "negative") return value;
        return "neutral";
      })(),
      citationFound,
      citedUrls,
      allCitedUrls,
      rank: rankFromPosition(response),
      score: scoreFromAnalysis(response, citationFound),
      time: createdAt ? toRelativeTime(createdAt) : "-",
      createdAt: createdAt || undefined,
      response: rawResponse,
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
    const trend: MonitoringCompetitor["trend"] =
      share > 30 ? "up" : share > 10 ? "stable" : "down";
    return {
      ...competitor,
      sov: share,
      trend,
    };
  });

  const alerts: MonitoringAlert[] = alertsPayload.map((entry) => {
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
      if (!isExactProjectURL(value, projectHost)) continue;
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

  const data: MonitoringData = {
    project: {
      id: projectId,
      name: projectName,
      website: projectWebsite,
      tagline: projectTagline,
      personas: projectPersonas,
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
