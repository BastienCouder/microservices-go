import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON } from "@/shared/api/gateway";
import {
  attachStableSlugs,
  findBySlugOrId,
  slugifyPublicName,
} from "@/shared/public-slugs";
import { readRouteQueryParam } from "@/shared/selection";
import type {
  GeoPeriod,
  GeoPropertyQuota,
  GeoTrafficDailyPoint,
  GeoTrafficPage,
  GeoTrafficReport,
  GeoTrafficSource,
  GeoTrafficSummary,
  CompleteTrafficGA4OAuthInput,
  CompleteTrafficGA4OAuthResult,
  SaveTrafficGA4IntegrationInput,
  SelectTrafficGA4OAuthPropertyInput,
  StartTrafficGA4OAuthInput,
  StartTrafficGA4OAuthResult,
  TrafficGA4OAuthProperty,
  TrafficImpactIntegrations,
  TrafficPageData,
} from "./types";

type JsonObject = Record<string, unknown>;
type TrafficRequestScope = "projects" | "project" | "integrations" | "traffic";

type ProjectRouteCandidate = {
  id: string;
  name: string;
  slug: string;
  aliases: string[];
};

type ProjectIdentity = {
  id: string;
  name: string;
  organizationId: string;
};

function normalizeAuthMode(value: string): "oauth" | "service_account" | "" {
  return value === "oauth" || value === "service_account" ? value : "";
}

export class TrafficRequestError extends Error {
  scope: TrafficRequestScope;
  status: number;

  constructor(scope: TrafficRequestScope, status: number, message?: string) {
    super(message || `traffic request failed: ${scope}`);
    this.name = "TrafficRequestError";
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

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
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
  if (getField<boolean>(obj, ["success"]) === true && "data" in obj) {
    return obj.data;
  }
  return value;
}

function unwrapRequiredEnvelope<T>(
  result: Awaited<ReturnType<typeof gatewayJSON<T>>>,
  scope: TrafficRequestScope,
): unknown {
  if (!result.ok) {
    throw new TrafficRequestError(scope, result.status, result.error);
  }
  return unwrapSuccessEnvelope(result.data);
}

function encodeProjectPathSegment(projectId: string): string {
  return encodeURIComponent(projectId);
}

function normalizeProjectCandidates(value: unknown): ProjectRouteCandidate[] {
  const payload = unwrapSuccessEnvelope(value);
  if (!Array.isArray(payload)) return [];

  const candidates = payload.flatMap((value) => {
    const entry = asObject(value);
    const id = asString(getField(entry, ["id", "ID"])).trim();
    if (id === "") return [];
    const labels = [
      asString(getField(entry, ["name", "Name"])).trim(),
      asString(getField(entry, ["brandName", "BrandName"])).trim(),
      asString(getField(entry, ["domain", "Domain"])).trim(),
      asString(getField(entry, ["websiteUrl", "websiteURL", "WebsiteURL"])).trim(),
    ].filter((label) => label !== "");
    const name = labels[0] ?? "Projet";
    const aliases = labels.map((label) => slugifyPublicName(label, "project"));
    return [{ id, name, aliases }];
  });

  return attachStableSlugs(candidates, "project");
}

function findProjectCandidate(
  candidates: ProjectRouteCandidate[],
  value: string,
): ProjectRouteCandidate | null {
  const normalized = value.trim();
  if (!normalized) return null;

  return (
    findBySlugOrId(candidates, normalized) ??
    candidates.find((candidate) => candidate.aliases.includes(normalized)) ??
    null
  );
}

function normalizeProjectIdentity(value: unknown): ProjectIdentity {
  const project = asObject(value);
  const id = asString(getField(project, ["id", "ID"])).trim();
  const name =
    asString(getField(project, ["brandName", "BrandName"])).trim() ||
    asString(getField(project, ["name", "Name"])).trim();
  const organizationId = String(
    getField(project, ["organizationId", "OrganizationID"]) ?? "",
  ).trim();

  return { id, name, organizationId };
}

function trafficReportErrorMessage(error: string): string {
  const normalized = error.trim();
  if (normalized === "") {
    return "Connexion GA4 enregistrée. Le rapport est momentanément indisponible.";
  }
  if (normalized.toLowerCase().includes("google analytics")) {
    return normalized;
  }
  return "Connexion GA4 enregistrée. Le rapport est momentanément indisponible. Réessaie avec Actualiser.";
}

function isGA4NotConfiguredError(status: number, error: string): boolean {
  if (status !== 400 && status !== 404) {
    return false;
  }
  const normalized = error.trim().toLowerCase();
  return (
    normalized.includes("ga4 integration is not configured") ||
    normalized.includes("ga4 property id is required")
  );
}

export function normalizeTrafficPeriod(value: string | null | undefined): GeoPeriod {
  const normalized = value?.trim();
  return normalized === "7d" || normalized === "90d" ? normalized : "30d";
}

export function getTrafficQueryContext(routeSearch: string): {
  projectId: string | null;
  organizationId: string | null;
  period: GeoPeriod;
} {
  const projectId = (
    readRouteQueryParam(routeSearch, "projectId") ||
    readRouteQueryParam(routeSearch, "project_id") ||
    readRouteQueryParam(routeSearch, "project")
  ).trim();
  const organizationId = (
    readRouteQueryParam(routeSearch, "organizationId") ||
    readRouteQueryParam(routeSearch, "organization_id") ||
    readRouteQueryParam(routeSearch, "org")
  ).trim();
  const period = normalizeTrafficPeriod(readRouteQueryParam(routeSearch, "period"));
  return { projectId: projectId || null, organizationId: organizationId || null, period };
}

function periodDays(period: GeoPeriod): number {
  if (period === "7d") return 7;
  if (period === "90d") return 90;
  return 30;
}

function getPeriodWindow(period: GeoPeriod, now: Date): { from: Date; to: Date } {
  const to = new Date(now);
  const from = new Date(now);
  from.setDate(from.getDate() - periodDays(period));
  return { from, to };
}

function normalizeSummary(value: unknown): GeoTrafficSummary {
  const row = asObject(value);
  return {
    totalGeoSessions: asNumber(getField(row, ["totalGeoSessions", "TotalGeoSessions"])),
    totalSessions: asNumber(getField(row, ["totalSessions", "TotalSessions"])),
    geoShareOfTotal: asNumber(getField(row, ["geoShareOfTotal", "GeoShareOfTotal"])),
    geoEngagedSessions: asNumber(getField(row, ["geoEngagedSessions", "GeoEngagedSessions"])),
    geoEngagementRate: asNumber(getField(row, ["geoEngagementRate", "GeoEngagementRate"])),
    geoAvgSessionSeconds: asNumber(
      getField(row, ["geoAvgSessionSeconds", "GeoAvgSessionSeconds"]),
    ),
    geoBounceRate: asNumber(getField(row, ["geoBounceRate", "GeoBounceRate"])),
    geoConversions: asNumber(getField(row, ["geoConversions", "GeoConversions"])),
    geoConversionRate: asNumber(getField(row, ["geoConversionRate", "GeoConversionRate"])),
    geoPageViews: asNumber(getField(row, ["geoPageViews", "GeoPageViews"])),
    topEngine: asString(getField(row, ["topEngine", "TopEngine"])).trim(),
  };
}

function normalizeSource(value: unknown): GeoTrafficSource {
  const row = asObject(value);
  return {
    source: asString(getField(row, ["source", "Source"])).trim(),
    medium: asString(getField(row, ["medium", "Medium"])).trim(),
    sourceMedium: asString(getField(row, ["sourceMedium", "SourceMedium"])).trim(),
    landingPage: asString(getField(row, ["landingPage", "LandingPage"])).trim(),
    engine: asString(getField(row, ["engine", "Engine"])).trim(),
    sessions: asNumber(getField(row, ["sessions", "Sessions"])),
    engagedSessions: asNumber(getField(row, ["engagedSessions", "EngagedSessions"])),
    engagementRate: asNumber(getField(row, ["engagementRate", "EngagementRate"])),
    bounceRate: asNumber(getField(row, ["bounceRate", "BounceRate"])),
    avgSessionSeconds: asNumber(getField(row, ["avgSessionSeconds", "AvgSessionSeconds"])),
    conversions: asNumber(getField(row, ["conversions", "Conversions"])),
    pageViews: asNumber(getField(row, ["pageViews", "PageViews"])),
    shareOfGeoSessions: asNumber(getField(row, ["shareOfGeoSessions", "ShareOfGeoSessions"])),
  };
}

function normalizePage(value: unknown): GeoTrafficPage {
  const row = asObject(value);
  return {
    path: asString(getField(row, ["path", "Path"])).trim(),
    title: asString(getField(row, ["title", "Title"])).trim(),
    source: asString(getField(row, ["source", "Source"])).trim(),
    engine: asString(getField(row, ["engine", "Engine"])).trim(),
    sessions: asNumber(getField(row, ["sessions", "Sessions"])),
    engagedSessions: asNumber(getField(row, ["engagedSessions", "EngagedSessions"])),
    engagementRate: asNumber(getField(row, ["engagementRate", "EngagementRate"])),
    conversions: asNumber(getField(row, ["conversions", "Conversions"])),
    pageViews: asNumber(getField(row, ["pageViews", "PageViews"])),
  };
}

function normalizeDailyPoint(value: unknown): GeoTrafficDailyPoint {
  const row = asObject(value);
  return {
    date: asString(getField(row, ["date", "Date"])).trim(),
    sessions: asNumber(getField(row, ["sessions", "Sessions"])),
    engagedSessions: asNumber(getField(row, ["engagedSessions", "EngagedSessions"])),
    conversions: asNumber(getField(row, ["conversions", "Conversions"])),
  };
}

function normalizeQuota(value: unknown): GeoPropertyQuota | null {
  const quota = asObject(value);
  if (Object.keys(quota).length === 0) {
    return null;
  }
  const tokensPerDay = asObject(getField(quota, ["tokensPerDay", "TokensPerDay"]));
  const serverErrors = asObject(
    getField(quota, ["serverErrorsPerProjectPerHour", "ServerErrorsPerProjectPerHour"]),
  );
  return {
    tokensPerDay: {
      consumed: asNumber(getField(tokensPerDay, ["consumed", "Consumed"])),
      remaining: asNumber(getField(tokensPerDay, ["remaining", "Remaining"])),
    },
    serverErrorsPerProjectPerHour: {
      consumed: asNumber(getField(serverErrors, ["consumed", "Consumed"])),
      remaining: asNumber(getField(serverErrors, ["remaining", "Remaining"])),
    },
  };
}

function normalizeTrafficDataSource(value: unknown): GeoTrafficReport["dataSource"] {
  const normalized = asString(value).trim();
  return normalized === "ga4" || normalized === "fake" ? normalized : "";
}

function logFakeTrafficReport(report: GeoTrafficReport) {
  console.info("[traffic] fake data", {
    projectId: report.projectId,
    propertyId: report.propertyId,
    dataSource: report.dataSource,
    summary: report.summary,
    bySourcePreview: report.bySource.slice(0, 5),
    topPagesPreview: report.topPages.slice(0, 5),
    timeseriesCount: report.timeseries.length,
    timeseriesHead: report.timeseries.slice(0, 5),
  });
}

export function normalizeTrafficReport(value: unknown): GeoTrafficReport {
  const payload = asObject(unwrapSuccessEnvelope(value));
  const dateRange = asObject(getField(payload, ["dateRange", "DateRange"]));
  const report = {
    projectId: asString(getField(payload, ["projectId", "ProjectID"])).trim(),
    propertyId: asString(getField(payload, ["propertyId", "PropertyID"])).trim(),
    dataSource: normalizeTrafficDataSource(getField(payload, ["dataSource", "DataSource"])),
    dateRange: {
      startDate: asString(getField(dateRange, ["startDate", "StartDate"])).trim(),
      endDate: asString(getField(dateRange, ["endDate", "EndDate"])).trim(),
    },
    generatedAt: asString(getField(payload, ["generatedAt", "GeneratedAt"])).trim(),
    summary: normalizeSummary(getField(payload, ["summary", "Summary"])),
    bySource: asArray(getField(payload, ["bySource", "BySource"])).map(normalizeSource),
    topPages: asArray(getField(payload, ["topPages", "TopPages"])).map(normalizePage),
    timeseries: asArray(getField(payload, ["timeseries", "Timeseries"])).map(
      normalizeDailyPoint,
    ),
    propertyQuota: normalizeQuota(getField(payload, ["propertyQuota", "PropertyQuota"])),
  };

  if (report.dataSource === "fake") {
    logFakeTrafficReport(report);
  }

  return report;
}

export function normalizeTrafficImpactIntegrations(value: unknown): TrafficImpactIntegrations {
  const payload = asObject(unwrapSuccessEnvelope(value));
  const ga4 = asObject(getField(payload, ["ga4", "GA4"]));
  return {
    projectId: asString(getField(payload, ["projectId", "ProjectID"])).trim(),
    ga4: {
      propertyId: asString(getField(ga4, ["propertyId", "PropertyID"])).trim(),
      authMode: normalizeAuthMode(asString(getField(ga4, ["authMode", "AuthMode"])).trim()),
      hasServiceAccount:
        getField(ga4, ["hasServiceAccount", "HasServiceAccount"]) === true,
      hasOAuthToken: getField(ga4, ["hasOAuthToken", "HasOAuthToken"]) === true,
      isConnected: getField(ga4, ["isConnected", "IsConnected"]) === true,
      connectedAt: asString(getField(ga4, ["connectedAt", "ConnectedAt"])).trim(),
      updatedAt: asString(getField(ga4, ["updatedAt", "UpdatedAt"])).trim(),
    },
  };
}

function emptyTrafficImpactIntegrations(projectId = ""): TrafficImpactIntegrations {
  return {
    projectId,
    ga4: {
      propertyId: "",
      authMode: "",
      hasServiceAccount: false,
      hasOAuthToken: false,
      isConnected: false,
      connectedAt: "",
      updatedAt: "",
    },
  };
}

async function loadProjectIdentity(
  apiBaseURL: string,
  routeProjectId: string | null,
  routeOrganizationId: string | null,
  signal?: AbortSignal,
): Promise<ProjectIdentity | null> {
  let projectId = routeProjectId;
  const organizationId = routeOrganizationId?.trim() ?? "";

  const projectsPayload = unwrapRequiredEnvelope(
    await gatewayJSON<unknown>(apiBaseURL, "/projects", {
      method: "GET",
      organizationId,
      signal,
    }),
    "projects",
  );
  const projectCandidates = normalizeProjectCandidates(projectsPayload);

  if (routeProjectId) {
    const resolvedProject = findProjectCandidate(projectCandidates, routeProjectId);
    projectId = resolvedProject?.id ?? null;
  } else {
    projectId = projectCandidates[0]?.id ?? null;
  }

  if (!projectId) {
    return null;
  }

  const projectRes = await gatewayJSON<unknown>(
    apiBaseURL,
    `/projects/${encodeProjectPathSegment(projectId)}`,
    { method: "GET", organizationId, signal },
  );

  return normalizeProjectIdentity(unwrapRequiredEnvelope(projectRes, "project"));
}

export async function loadTrafficPageData(
  apiBaseURL: string,
  routeSearch: string,
  options?: { signal?: AbortSignal; now?: Date; search?: string; engine?: string },
): Promise<TrafficPageData> {
  const {
    projectId: routeProjectId,
    organizationId: routeOrganizationId,
    period,
  } = getTrafficQueryContext(routeSearch);
  const emptyReport = normalizeTrafficReport({});

  if (apiBaseURL.trim() === "") {
    return {
      report: emptyReport,
      integration: emptyTrafficImpactIntegrations(),
      projectId: null,
      projectName: "",
      organizationId: "",
      period,
      reportError: null,
    };
  }

  const project = await loadProjectIdentity(
    apiBaseURL,
    routeProjectId,
    routeOrganizationId,
    options?.signal,
  );
  if (!project?.id) {
    return {
      report: emptyReport,
      integration: emptyTrafficImpactIntegrations(),
      projectId: null,
      projectName: "",
      organizationId: "",
      period,
      reportError: null,
    };
  }

  const encodedProjectId = encodeProjectPathSegment(project.id);
  const integrationRes = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.projects.impactIntegrations(encodedProjectId),
    {
      method: "GET",
      organizationId: project.organizationId,
      signal: options?.signal,
    },
  );
  const integration = normalizeTrafficImpactIntegrations(
    unwrapRequiredEnvelope(integrationRes, "integrations"),
  );

  if (!integration.ga4.isConnected) {
    return {
      report: emptyReport,
      integration,
      projectId: project.id,
      projectName: project.name,
      organizationId: project.organizationId,
      period,
      reportError: null,
    };
  }

  const { from, to } = getPeriodWindow(period, options?.now ?? new Date());
  const trafficRes = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.attribution.traffic(encodedProjectId, {
      from: from.toISOString(),
      to: to.toISOString(),
      search: options?.search?.trim(),
      engine: options?.engine?.trim(),
    }),
    {
      method: "GET",
      organizationId: project.organizationId,
      signal: options?.signal,
      retry: { attempts: 0 },
    },
  );

  if (!trafficRes.ok) {
    if (isGA4NotConfiguredError(trafficRes.status, trafficRes.error)) {
      return {
        report: emptyReport,
        integration: emptyTrafficImpactIntegrations(project.id),
        projectId: project.id,
        projectName: project.name,
        organizationId: project.organizationId,
        period,
        reportError: null,
      };
    }

    return {
      report: emptyReport,
      integration,
      projectId: project.id,
      projectName: project.name,
      organizationId: project.organizationId,
      period,
      reportError: trafficReportErrorMessage(trafficRes.error),
    };
  }

  return {
    report: normalizeTrafficReport(unwrapRequiredEnvelope(trafficRes, "traffic")),
    integration,
    projectId: project.id,
    projectName: project.name,
    organizationId: project.organizationId,
    period,
    reportError: null,
  };
}

export async function saveTrafficGA4Integration(
  apiBaseURL: string,
  input: SaveTrafficGA4IntegrationInput,
  signal?: AbortSignal,
): Promise<TrafficImpactIntegrations> {
  const projectId = input.projectId.trim();
  const organizationId = input.organizationId.trim();
  const propertyId = input.propertyId.trim();
  const serviceAccountJSON = input.serviceAccountJSON.trim();

  if (!projectId || !organizationId || !propertyId || !serviceAccountJSON) {
    throw new TrafficRequestError(
      "integrations",
      400,
      "propertyId and serviceAccountJSON are required",
    );
  }

  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.projects.impactIntegrations(encodeProjectPathSegment(projectId)),
    {
      method: "PATCH",
      organizationId,
      signal,
      body: JSON.stringify({
        ga4: {
          propertyId,
          serviceAccountJSON,
        },
      }),
    },
  );

  return normalizeTrafficImpactIntegrations(
    unwrapRequiredEnvelope(response, "integrations"),
  );
}

export async function disconnectTrafficGA4Integration(
  apiBaseURL: string,
  projectId: string,
  organizationId: string,
  signal?: AbortSignal,
): Promise<TrafficImpactIntegrations> {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.projects.impactIntegrations(encodeProjectPathSegment(projectId)),
    {
      method: "PATCH",
      organizationId,
      signal,
      body: JSON.stringify({
        ga4: {
          disconnect: true,
        },
      }),
    },
  );

  return normalizeTrafficImpactIntegrations(
    unwrapRequiredEnvelope(response, "integrations"),
  );
}

function normalizeTrafficGA4OAuthProperty(value: unknown): TrafficGA4OAuthProperty {
  const row = asObject(value);
  const propertyId = asString(getField(row, ["propertyId", "PropertyID"])).trim();
  return {
    propertyId,
    displayName:
      asString(getField(row, ["displayName", "DisplayName"])).trim() || propertyId,
    accountName: asString(getField(row, ["accountName", "AccountName"])).trim(),
  };
}

function normalizeTrafficGA4OAuthProperties(value: unknown): TrafficGA4OAuthProperty[] {
  return asArray(unwrapSuccessEnvelope(value))
    .map(normalizeTrafficGA4OAuthProperty)
    .filter((property) => property.propertyId !== "");
}

export async function startTrafficGA4OAuth(
  apiBaseURL: string,
  input: StartTrafficGA4OAuthInput,
  signal?: AbortSignal,
): Promise<StartTrafficGA4OAuthResult> {
  const projectId = input.projectId.trim();
  const organizationId = input.organizationId.trim();
  const redirectUri = input.redirectUri.trim();
  if (!projectId || !organizationId || !redirectUri) {
    throw new TrafficRequestError("integrations", 400, "projectId, organizationId and redirectUri are required");
  }
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.projects.ga4OAuthStart(encodeProjectPathSegment(projectId)),
    {
      method: "POST",
      organizationId,
      signal,
      body: JSON.stringify({ redirectUri }),
    },
  );
  const payload = asObject(unwrapRequiredEnvelope(response, "integrations"));
  return {
    authorizationUrl: asString(getField(payload, ["authorizationUrl", "AuthorizationURL"])).trim(),
    state: asString(getField(payload, ["state", "State"])).trim(),
  };
}

export async function completeTrafficGA4OAuth(
  apiBaseURL: string,
  input: CompleteTrafficGA4OAuthInput,
  signal?: AbortSignal,
): Promise<CompleteTrafficGA4OAuthResult> {
  const projectId = input.projectId.trim();
  const organizationId = input.organizationId.trim();
  const code = input.code.trim();
  const state = input.state.trim();
  const redirectUri = input.redirectUri.trim();
  const propertyId = input.propertyId?.trim() ?? "";
  if (!projectId || !organizationId || !code || !state || !redirectUri) {
    throw new TrafficRequestError("integrations", 400, "projectId, organizationId, code, state and redirectUri are required");
  }
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.projects.ga4OAuthCallback(encodeProjectPathSegment(projectId)),
    {
      method: "POST",
      organizationId,
      signal,
      body: JSON.stringify({ code, state, redirectUri, propertyId }),
    },
  );
  const payload = asObject(unwrapRequiredEnvelope(response, "integrations"));
  return {
    integration: normalizeTrafficImpactIntegrations(getField(payload, ["integration", "Integration"])),
    properties: normalizeTrafficGA4OAuthProperties(getField(payload, ["properties", "Properties"])),
  };
}

export async function listTrafficGA4OAuthProperties(
  apiBaseURL: string,
  projectId: string,
  organizationId: string,
  signal?: AbortSignal,
): Promise<TrafficGA4OAuthProperty[]> {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.projects.ga4OAuthProperties(encodeProjectPathSegment(projectId)),
    {
      method: "GET",
      organizationId,
      signal,
    },
  );
  return normalizeTrafficGA4OAuthProperties(unwrapRequiredEnvelope(response, "integrations"));
}

export async function selectTrafficGA4OAuthProperty(
  apiBaseURL: string,
  input: SelectTrafficGA4OAuthPropertyInput,
  signal?: AbortSignal,
): Promise<TrafficImpactIntegrations> {
  const projectId = input.projectId.trim();
  const organizationId = input.organizationId.trim();
  const propertyId = input.propertyId.trim();
  if (!projectId || !organizationId || !propertyId) {
    throw new TrafficRequestError("integrations", 400, "projectId, organizationId and propertyId are required");
  }
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.projects.ga4OAuthProperty(encodeProjectPathSegment(projectId)),
    {
      method: "PATCH",
      organizationId,
      signal,
      body: JSON.stringify({ propertyId }),
    },
  );
  return normalizeTrafficImpactIntegrations(
    unwrapRequiredEnvelope(response, "integrations"),
  );
}
