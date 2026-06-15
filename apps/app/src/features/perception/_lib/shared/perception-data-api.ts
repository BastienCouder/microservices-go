import { apiRoutes } from "@/lib/api-config";
import {
  buildProjectModelLookup,
  normalizeModelPayloadList,
  toProjectModelMeta,
} from "@/lib/project-models";
import { resolveRuntimeMode, type RuntimeMode } from "@/lib/runtime-mode";
import { gatewayJSON, unwrapGatewayPayload } from "@/shared/api/gateway";
import { attachStableSlugs, findBySlugOrId } from "@/shared/public-slugs";
import {
  readOptionalProjectTokenFromSearch,
  readOrganizationIdFromSearch,
  readSelectedOrganizationPublicID,
} from "@/shared/selection";
import { buildPerceptionDerivedData } from "./perception-data-analytics";
import {
  PerceptionRequestError,
  type BrandCanon,
  type PerceptionApiPayload,
  type PerceptionApiPayloadWithDashboard,
  type PerceptionLoadResult,
  type PerceptionModelOption,
  type PerceptionViewData,
} from "./perception-data-types";

type JsonObject = Record<string, unknown>;
type ProjectRouteCandidate = {
  id: string;
  name: string;
  slug: string;
};

type MonitoringRequestScope =
  | "projects"
  | "project"
  | "project brand canon"
  | "models"
  | "competitors"
  | "monitoring"
  | "perception";

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" ? (value as JsonObject) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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
    throw new PerceptionRequestError(result.status, `${scope}: ${result.error}`);
  }
  return unwrapGatewayPayload(result.data);
}

function readBundledDashboard(payload: PerceptionApiPayloadWithDashboard): unknown | null {
  const candidate =
    payload.dashboard ??
    payload.Dashboard ??
    payload.monitoring ??
    payload.Monitoring ??
    null;
  return candidate === null || candidate === undefined ? null : candidate;
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

function encodeProjectPathSegment(projectId: string): string {
  return encodeURIComponent(projectId);
}

function resolveOrganizationContext(routeSearch: string): string | undefined {
  const organizationId =
    readOrganizationIdFromSearch(routeSearch) || readSelectedOrganizationPublicID();
  return organizationId || undefined;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeAuthoritativeBrandCanon(value: unknown): Partial<BrandCanon> {
  const payload = asObject(value);

  return {
    brandName: asString(getField(payload, ["brandName", "BrandName"])).trim(),
    category: asString(getField(payload, ["category", "Category"])).trim(),
    positioning: asString(getField(payload, ["positioning", "Positioning"])).trim(),
    audience: asArray(getField(payload, ["audience", "Audience"]))
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean),
    useCases: asArray(getField(payload, ["useCases", "UseCases"]))
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean),
    features: asArray(getField(payload, ["features", "Features"]))
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean),
  };
}

function buildPerceptionBase(
  projectPayload: unknown,
  competitorsPayload: unknown,
  monitoringPayload: unknown,
  perceptionPayload: PerceptionApiPayload,
  modelLookup: Map<string, PerceptionModelOption>,
  modelCatalog: PerceptionModelOption[],
  projectId: string,
): PerceptionViewData {
  const derived = buildPerceptionDerivedData({
    projectPayload,
    competitorsPayload,
    monitoringPayload,
    perceptionPayload,
    modelLookup,
    modelCatalog,
  });
  const sourceMode =
    derived.perceptionResponseCount > 0 ? "perception_primary" : "fallback_all";

  return {
    source: "project",
    brandCanon: derived.brandCanon,
    competitors: derived.competitors,
    radar: derived.radar,
    scores: derived.scores,
    topErrors: derived.topErrors,
    modelAxisHeatmap: derived.modelAxisHeatmap,
    trend: derived.trend,
    responses: derived.responses,
    metadata: {
      ...perceptionPayload.metadata,
      projectId,
      windowLabel: derived.windowLabel,
      analyzedResponses: derived.analyzedResponses,
      perceptionResponses: derived.perceptionResponseCount,
      monitoringResponsesUsed: derived.monitoringResponseCount,
      sourceMode,
      models: derived.models,
      modelCatalog: derived.visibleModelCatalog,
      latestRunId: derived.latestRunId,
      generatedAt: derived.generatedAt,
      runtimeMode: perceptionPayload.metadata?.runtimeMode ?? "live",
    },
  };
}

function mergePerceptionData(
  base: PerceptionViewData,
  payload: PerceptionApiPayload,
  runtimeMode: RuntimeMode,
  projectId: string,
): PerceptionViewData {
  const incomingBrandCanon = payload.brandCanon ?? {};

  const radar = base.radar.map((point) => {
    const incoming = payload.radar?.find((entry) => entry.axis === point.axis);
    return {
      ...point,
      score: clampScore(asNumber(incoming?.score ?? point.score)),
      target: clampScore(asNumber(incoming?.target ?? point.target)),
      label: incoming?.label || point.label,
    };
  });

  const brandCanon: BrandCanon = {
    ...base.brandCanon,
    ...incomingBrandCanon,
    audience: Array.isArray(incomingBrandCanon.audience) ? incomingBrandCanon.audience.filter(Boolean) : base.brandCanon.audience,
    useCases: Array.isArray(incomingBrandCanon.useCases) ? incomingBrandCanon.useCases.filter(Boolean) : base.brandCanon.useCases,
    features: Array.isArray(incomingBrandCanon.features) ? incomingBrandCanon.features.filter(Boolean) : base.brandCanon.features,
    pricing: {
      ...base.brandCanon.pricing,
      ...(incomingBrandCanon.pricing ?? {}),
    },
  };

  return {
    ...base,
    source: "project",
    brandCanon,
    competitors: base.competitors,
    radar,
    scores: {
      positioningAccuracy: clampScore(asNumber(payload.scores?.positioningAccuracy ?? base.scores.positioningAccuracy)),
      factualAccuracy: clampScore(asNumber(payload.scores?.factualAccuracy ?? base.scores.factualAccuracy)),
      sentimentScore: clampScore(asNumber(payload.scores?.sentimentScore ?? base.scores.sentimentScore)),
    },
    topErrors: base.topErrors,
    responses: base.responses,
    metadata: {
      ...base.metadata,
      ...payload.metadata,
      runtimeMode,
      projectId,
      perceptionResponses: base.metadata.perceptionResponses,
      monitoringResponsesUsed: base.metadata.monitoringResponsesUsed,
      sourceMode: base.metadata.sourceMode,
      models: base.metadata.models,
      modelCatalog: base.metadata.modelCatalog,
      analyzedResponses: base.metadata.analyzedResponses,
      windowLabel: base.metadata.windowLabel,
      latestRunId: base.metadata.latestRunId,
      generatedAt: payload.metadata?.generatedAt || base.metadata.generatedAt,
    },
  };
}

export async function loadPerceptionData(
  apiBaseURL: string,
  routeSearch: string,
  options?: { signal?: AbortSignal },
): Promise<PerceptionLoadResult> {
  const mode = resolveRuntimeMode(routeSearch);
  let projectId = readOptionalProjectTokenFromSearch(routeSearch);
  const organizationId = resolveOrganizationContext(routeSearch);

  if (apiBaseURL.trim() === "") {
    throw new PerceptionRequestError(0, "api base url is empty");
  }

  if (!projectId) {
    const projectsPayload = unwrapRequiredEnvelope(
      await gatewayJSON<unknown>(apiBaseURL, "/projects", {
        method: "GET",
        organizationId,
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
    throw new PerceptionRequestError(404, "no project available");
  }

  let projectRes = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.projects.get(encodeProjectPathSegment(projectId)),
    {
      method: "GET",
      organizationId,
      signal: options?.signal,
    },
  );

  if (!projectRes.ok && projectId && [401, 403, 404].includes(projectRes.status)) {
    const projectsPayload = unwrapRequiredEnvelope(
      await gatewayJSON<unknown>(apiBaseURL, "/projects", {
        method: "GET",
        organizationId,
        signal: options?.signal,
      }),
      "projects",
    );
    const projects = normalizeProjectCandidates(projectsPayload);
    const resolvedProject = findBySlugOrId(projects, projectId);
    if (resolvedProject) {
      projectId = resolvedProject.id;
      projectRes = await gatewayJSON<unknown>(
        apiBaseURL,
        apiRoutes.projects.get(encodeProjectPathSegment(projectId)),
        {
          method: "GET",
          organizationId,
          signal: options?.signal,
        },
      );
    }
  }

  const encodedProjectId = encodeProjectPathSegment(projectId);

  const [modelsRes, competitorsRes, brandCanonRes, perceptionRes] = await Promise.all([
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.models(encodedProjectId), {
      method: "GET",
      organizationId,
      signal: options?.signal,
    }),
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.competitors(encodedProjectId), {
      method: "GET",
      organizationId,
      signal: options?.signal,
    }),
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.brandCanon(encodedProjectId), {
      method: "GET",
      organizationId,
      signal: options?.signal,
    }),
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.analysis.perception(encodedProjectId, { includeDashboard: true }), {
      method: "GET",
      organizationId,
      signal: options?.signal,
    }),
  ]);

  const projectPayload = unwrapRequiredEnvelope(projectRes, "project");
  const modelsPayload = unwrapRequiredEnvelope(modelsRes, "models");
  const competitorsPayload = unwrapRequiredEnvelope(competitorsRes, "competitors");
  const projectBrandCanonPayload = unwrapRequiredEnvelope(brandCanonRes, "project brand canon");
  const perceptionPayload = asObject(unwrapRequiredEnvelope(perceptionRes, "perception")) as PerceptionApiPayloadWithDashboard;
  let monitoringPayload = readBundledDashboard(perceptionPayload);

  if (!monitoringPayload) {
    monitoringPayload = unwrapRequiredEnvelope(
      await gatewayJSON<unknown>(apiBaseURL, apiRoutes.analysis.monitoring(encodedProjectId), {
        method: "GET",
        organizationId,
        signal: options?.signal,
      }),
      "monitoring",
    );
  }

  const modelCatalog = normalizeModelPayloadList(modelsPayload).map((model) =>
    toProjectModelMeta(model),
  );
  const modelLookup = buildProjectModelLookup(modelCatalog);
  const base = buildPerceptionBase(
    projectPayload,
    competitorsPayload,
    monitoringPayload,
    perceptionPayload,
    modelLookup,
    modelCatalog,
    projectId,
  );
  const authoritativeBrandCanon = normalizeAuthoritativeBrandCanon(projectBrandCanonPayload);
  const merged = mergePerceptionData(base, perceptionPayload, mode, projectId);
  const data: PerceptionViewData = {
    ...merged,
    brandCanon: {
      ...merged.brandCanon,
      ...authoritativeBrandCanon,
      audience: authoritativeBrandCanon.audience ?? merged.brandCanon.audience,
      useCases: authoritativeBrandCanon.useCases ?? merged.brandCanon.useCases,
      features: authoritativeBrandCanon.features ?? merged.brandCanon.features,
      pricing: { ...merged.brandCanon.pricing },
    },
  };

  return {
    data,
    projectId,
    mode,
  };
}
