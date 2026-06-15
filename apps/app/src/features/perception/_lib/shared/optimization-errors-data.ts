import { apiRoutes } from "@/lib/api-config";
import {
  normalizeModelPayloadList,
  toProjectModelMeta,
  type ProjectModelMeta,
} from "@/lib/project-models";
import { gatewayJSON, unwrapGatewayPayload } from "@/shared/api/gateway";
import { attachStableSlugs, findBySlugOrId } from "@/shared/public-slugs";
import { readOptionalProjectTokenFromSearch } from "@/shared/selection";
import type { PerceptionError, PerceptionSeverity } from "./perception-data";

export type OptimizationErrorSource = "monitoring" | "perception" | "crawler";
export type OptimizationErrorOrigin = "alert" | "derived";

export type OptimizationError = PerceptionError & {
  source: OptimizationErrorSource;
  origin?: OptimizationErrorOrigin;
  resource?: string;
  createdAt?: string;
};

export type OptimizationErrorColumn = {
  severity: PerceptionSeverity;
  title: string;
  count: number;
  errors: OptimizationError[];
};

export type OptimizationErrorsBoard = {
  errors: OptimizationError[];
  columns: OptimizationErrorColumn[];
  metadata: {
    projectId?: string;
    generatedAt?: string;
    totalErrors: number;
    monitoringErrors: number;
    perceptionErrors: number;
    crawlerErrors: number;
    analyzedResponses?: number;
  };
};

export type OptimizationErrorsLoadResult = {
  data: OptimizationErrorsBoard;
  competitors: string[];
  modelCatalog: ProjectModelMeta[];
  projectId: string;
};

type JsonObject = Record<string, unknown>;
type ProjectRouteCandidate = {
  id: string;
  name: string;
  slug: string;
};

export class OptimizationErrorsRequestError extends Error {
  status: number;

  constructor(status: number, message?: string) {
    super(message || "optimization errors request failed");
    this.name = "OptimizationErrorsRequestError";
    this.status = status;
  }
}

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
  scope: string,
): unknown {
  if (!result.ok) {
    throw new OptimizationErrorsRequestError(result.status, `${scope}: ${result.error}`);
  }
  return unwrapGatewayPayload(result.data);
}

function normalizeSeverity(value: unknown): PerceptionSeverity {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  return "low";
}

function normalizeSource(value: unknown): OptimizationErrorSource {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === "monitoring") return "monitoring";
  if (normalized === "crawler") return "crawler";
  return "perception";
}

function normalizeOrigin(value: unknown): OptimizationErrorOrigin | undefined {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === "alert" || normalized === "derived") {
    return normalized;
  }
  return undefined;
}

function normalizePriority(value: unknown, severity: PerceptionSeverity): PerceptionError["optimizePriority"] {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return severity;
}

function normalizeFixType(value: unknown): PerceptionError["fixType"] {
  const normalized = asString(value).trim();
  if (
    normalized === "prompt_patch" ||
    normalized === "website_copy" ||
    normalized === "schema_update" ||
    normalized === "faq_snippet"
  ) {
    return normalized;
  }
  return "prompt_patch";
}

function normalizeOptimizationError(value: unknown): OptimizationError {
  const item = asObject(value);
  const severity = normalizeSeverity(getField(item, ["severity", "Severity"]));
  const type = asString(getField(item, ["type", "Type"])) || "optimization_error";

  return {
    id: asString(getField(item, ["id", "ID"])) || type,
    source: normalizeSource(getField(item, ["source", "Source"])),
    origin: normalizeOrigin(getField(item, ["origin", "Origin"])),
    resource: asString(getField(item, ["resource", "Resource"])) || undefined,
    severity,
    title: asString(getField(item, ["title", "Title"])) || "Erreur detectee",
    titleKey: asString(getField(item, ["titleKey", "TitleKey"])) || undefined,
    issue: asString(getField(item, ["issue", "Issue"])),
    issueKey: asString(getField(item, ["issueKey", "IssueKey"])) || undefined,
    impact: asString(getField(item, ["impact", "Impact"])),
    impactKey: asString(getField(item, ["impactKey", "ImpactKey"])) || undefined,
    detectedInModels: asArray(getField(item, ["detectedInModels", "DetectedInModels"]))
      .map(asString)
      .filter(Boolean),
    fixType: normalizeFixType(getField(item, ["fixType", "FixType"])),
    generatedContent: asString(getField(item, ["generatedContent", "GeneratedContent"])),
    generatedContentKey:
      asString(getField(item, ["generatedContentKey", "GeneratedContentKey"])) ||
      undefined,
    translationParams:
      ((): Record<string, unknown> | undefined => {
        const params = getField(item, ["translationParams", "TranslationParams"]);
        return params && typeof params === "object" && !Array.isArray(params)
          ? (params as Record<string, unknown>)
          : undefined;
      })(),
    optimizePriority: normalizePriority(getField(item, ["optimizePriority", "OptimizePriority"]), severity),
    type,
    createdAt: asString(getField(item, ["createdAt", "CreatedAt"])) || undefined,
  };
}

function normalizeColumn(value: unknown): OptimizationErrorColumn {
  const item = asObject(value);
  const errors = asArray(getField(item, ["errors", "Errors"])).map(normalizeOptimizationError);
  return {
    severity: normalizeSeverity(getField(item, ["severity", "Severity"])),
    title: asString(getField(item, ["title", "Title"])),
    count: asNumber(getField(item, ["count", "Count"])) || errors.length,
    errors,
  };
}

function normalizeBoard(value: unknown): OptimizationErrorsBoard {
  const payload = asObject(value);
  const metadata = asObject(getField(payload, ["metadata", "Metadata"]));
  const errors = asArray(getField(payload, ["errors", "Errors"])).map(normalizeOptimizationError);
  const columns = asArray(getField(payload, ["columns", "Columns"])).map(normalizeColumn);

  return {
    errors,
    columns,
    metadata: {
      projectId: asString(getField(metadata, ["projectId", "ProjectID"])) || undefined,
      generatedAt: asString(getField(metadata, ["generatedAt", "GeneratedAt"])) || undefined,
      totalErrors: asNumber(getField(metadata, ["totalErrors", "TotalErrors"])) || errors.length,
      monitoringErrors: asNumber(getField(metadata, ["monitoringErrors", "MonitoringErrors"])),
      perceptionErrors: asNumber(getField(metadata, ["perceptionErrors", "PerceptionErrors"])),
      crawlerErrors: asNumber(getField(metadata, ["crawlerErrors", "CrawlerErrors"])),
      analyzedResponses: asNumber(getField(metadata, ["analyzedResponses", "AnalyzedResponses"])) || undefined,
    },
  };
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

function normalizeCompetitorNames(value: unknown): string[] {
  const payload = unwrapGatewayPayload(value);
  if (!Array.isArray(payload)) return [];

  return Array.from(
    new Set(
      payload
        .map(asObject)
        .map((entry) => asString(getField(entry, ["name", "Name"])).trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

export function readOptimizationProjectIdFromSearch(routeSearch: string): string | null {
  return readOptionalProjectTokenFromSearch(routeSearch);
}

async function resolveFirstProjectId(apiBaseURL: string, signal?: AbortSignal): Promise<string | null> {
  const projectsPayload = unwrapRequiredEnvelope(
    await gatewayJSON<unknown>(apiBaseURL, "/projects", {
      method: "GET",
      signal,
    }),
    "projects",
  );
  const projects = normalizeProjectCandidates(projectsPayload);
  return projects[0]?.id ?? null;
}

async function resolveProjectSlug(
  apiBaseURL: string,
  projectId: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const projectsPayload = unwrapRequiredEnvelope(
    await gatewayJSON<unknown>(apiBaseURL, "/projects", {
      method: "GET",
      signal,
    }),
    "projects",
  );
  const projects = normalizeProjectCandidates(projectsPayload);
  return findBySlugOrId(projects, projectId)?.id ?? null;
}

async function loadOptimizationModelCatalog(
  apiBaseURL: string,
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectModelMeta[]> {
  const result = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.projects.models(encodeURIComponent(projectId)),
    {
      method: "GET",
      signal,
    },
  );

  if (!result.ok) return [];

  return normalizeModelPayloadList(unwrapGatewayPayload(result.data)).map((model) =>
    toProjectModelMeta(model),
  );
}

async function loadOptimizationCompetitors(
  apiBaseURL: string,
  projectId: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const result = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.projects.competitors(encodeURIComponent(projectId)),
    {
      method: "GET",
      signal,
    },
  );

  if (!result.ok) return [];

  return normalizeCompetitorNames(result.data);
}

export async function loadOptimizationErrors(
  apiBaseURL: string,
  routeSearch: string,
  options?: { signal?: AbortSignal },
): Promise<OptimizationErrorsLoadResult> {
  if (apiBaseURL.trim() === "") {
    throw new OptimizationErrorsRequestError(0, "api base url is empty");
  }

  let projectId = readOptimizationProjectIdFromSearch(routeSearch);
  if (!projectId) {
    projectId = await resolveFirstProjectId(apiBaseURL, options?.signal);
  }
  if (!projectId) {
    throw new OptimizationErrorsRequestError(404, "no project available");
  }

  let result = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.analysis.optimizationErrors(encodeURIComponent(projectId)),
    {
      method: "GET",
      signal: options?.signal,
    },
  );

  if (!result.ok && [401, 403, 404].includes(result.status)) {
    const resolvedProjectId = await resolveProjectSlug(apiBaseURL, projectId, options?.signal);
    if (resolvedProjectId && resolvedProjectId !== projectId) {
      projectId = resolvedProjectId;
      result = await gatewayJSON<unknown>(
        apiBaseURL,
        apiRoutes.analysis.optimizationErrors(encodeURIComponent(projectId)),
        {
          method: "GET",
          signal: options?.signal,
        },
      );
    }
  }

  const board = normalizeBoard(unwrapRequiredEnvelope(result, "optimization-errors"));

  return {
    competitors: await loadOptimizationCompetitors(apiBaseURL, projectId, options?.signal),
    data: board,
    modelCatalog: await loadOptimizationModelCatalog(apiBaseURL, projectId, options?.signal),
    projectId,
  };
}
