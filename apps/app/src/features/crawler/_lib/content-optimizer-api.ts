import { apiRoutes } from "@/lib/api-config";
import {
  gatewayJSON,
  unwrapGatewayPayload,
  type GatewayResult,
} from "@/shared/api/gateway";
import { resolveProjectTokenToId } from "@/shared/project-token-resolution";

export type ContentOptimizerCrawlJob = {
  id: string;
  status: string;
};

export type ContentOptimizerIssue = {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  fixType: string;
  source?: "rule" | "ai" | string;
};

export type ContentOptimizerCrawlRecord = {
  url: string;
  status: string;
  httpStatus?: number;
  title?: string;
  markdown?: string;
  html?: string;
  json?: unknown;
  issues?: ContentOptimizerIssue[];
};

export type ContentOptimizerCrawlResult = {
  id: string;
  status: string;
  browserSecondsUsed?: number;
  total: number;
  finished: number;
  records: ContentOptimizerCrawlRecord[];
  cursor?: string;
};

export type ContentOptimizerCrawlSnapshot = {
  projectId: string;
  organizationId: number;
  jobId: string;
  result: ContentOptimizerCrawlResult;
  createdAt: string;
  updatedAt: string;
};

export type ContentOptimizerProject = {
  id?: string;
  name?: string;
  websiteUrl?: string;
  domain?: string;
};

export type ContentOptimizerProjectSummary = {
  name: string;
  websiteUrl: string;
};

export type StartContentOptimizerCrawlInput = {
  projectId: string;
  organizationId?: string;
  url: string;
  limit: number;
  depth: number;
  render: boolean;
  includePatterns?: string[];
};

export type GetContentOptimizerCrawlInput = {
  projectId: string;
  organizationId?: string;
  jobId: string;
  limit?: number;
  status?: string;
  cursor?: string;
  analyze?: boolean;
};

export type AnalyzeSelectedContentOptimizerRecordsInput = {
  projectId: string;
  organizationId?: string;
  records: ContentOptimizerCrawlRecord[];
};

function encodePathSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

function unwrapGatewayData<T>(response: GatewayResult<unknown>): T {
  if (!response.ok) {
    throw new Error(normalizeContentOptimizerError(response.error));
  }
  return unwrapGatewayPayload(response.data) as T;
}

function shouldRetryWithResolvedProjectId(response: GatewayResult<unknown>): boolean {
  return !response.ok && [401, 403, 404].includes(response.status);
}

async function resolveProjectPathToken(
  apiBaseURL: string,
  input: {
    projectId: string;
    organizationId?: string;
  },
  signal?: AbortSignal,
): Promise<string> {
  const resolvedProjectId = await resolveProjectTokenToId(apiBaseURL, {
    projectToken: input.projectId,
    organizationId: input.organizationId,
    signal,
  });

  return resolvedProjectId ?? input.projectId;
}

function normalizeContentOptimizerError(error: string): string {
  const normalized = error.trim();
  if (
    normalized.includes("cloudflare crawl authentication failed") ||
    normalized.includes('"code":10000') ||
    normalized.toLowerCase().includes("authentication error")
  ) {
    return "Authentification Cloudflare invalide. Vérifie le token Browser Rendering dans deployments/secrets/cloudflare_api_token.txt, puis redémarre analysis-service.";
  }
  return normalized || "request failed";
}

function uniqueTrimmedValues(values: string[] | undefined): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values ?? []) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeProjectURL(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function readProjectWebsiteURL(payload: unknown): string {
  const item = asRecord(payload);
  return normalizeProjectURL(
    asString(item.websiteUrl) ||
      asString(item.WebsiteURL) ||
      asString(item.domain) ||
      asString(item.Domain),
  );
}

function readProjectName(payload: unknown): string {
  const item = asRecord(payload);
  return asString(item.name) || asString(item.Name);
}

export async function getProjectWebsiteURL(
  apiBaseURL: string,
  input: {
    projectId: string;
    organizationId?: string;
  },
  signal?: AbortSignal,
): Promise<string> {
  let response = await gatewayJSON<ContentOptimizerProject>(
    apiBaseURL,
    apiRoutes.projects.get(encodePathSegment(input.projectId)),
    {
      method: "GET",
      organizationId: input.organizationId,
      signal,
    },
  );

  if (shouldRetryWithResolvedProjectId(response)) {
    const resolvedProjectId = await resolveProjectPathToken(apiBaseURL, input, signal);
    if (resolvedProjectId !== input.projectId) {
      response = await gatewayJSON<ContentOptimizerProject>(
        apiBaseURL,
        apiRoutes.projects.get(encodePathSegment(resolvedProjectId)),
        {
          method: "GET",
          organizationId: input.organizationId,
          signal,
        },
      );
    }
  }

  return readProjectWebsiteURL(unwrapGatewayData(response));
}

export async function getProjectSummary(
  apiBaseURL: string,
  input: {
    projectId: string;
    organizationId?: string;
  },
  signal?: AbortSignal,
): Promise<ContentOptimizerProjectSummary> {
  let response = await gatewayJSON<ContentOptimizerProject>(
    apiBaseURL,
    apiRoutes.projects.get(encodePathSegment(input.projectId)),
    {
      method: "GET",
      organizationId: input.organizationId,
      signal,
    },
  );

  if (shouldRetryWithResolvedProjectId(response)) {
    const resolvedProjectId = await resolveProjectPathToken(apiBaseURL, input, signal);
    if (resolvedProjectId !== input.projectId) {
      response = await gatewayJSON<ContentOptimizerProject>(
        apiBaseURL,
        apiRoutes.projects.get(encodePathSegment(resolvedProjectId)),
        {
          method: "GET",
          organizationId: input.organizationId,
          signal,
        },
      );
    }
  }

  const payload = unwrapGatewayData(response);
  return {
    name: readProjectName(payload),
    websiteUrl: readProjectWebsiteURL(payload),
  };
}

export async function startContentOptimizerCrawl(
  apiBaseURL: string,
  input: StartContentOptimizerCrawlInput,
  signal?: AbortSignal,
): Promise<ContentOptimizerCrawlJob> {
  const includePatterns = uniqueTrimmedValues(input.includePatterns);
  const body = {
    url: input.url.trim(),
    limit: input.limit,
    depth: input.depth,
    render: input.render,
    source: "all",
    formats: ["markdown"],
    crawlPurposes: ["search", "ai-input"],
    ...(includePatterns.length > 0 ? { options: { includePatterns } } : {}),
  };

  let response = await gatewayJSON<ContentOptimizerCrawlJob>(
    apiBaseURL,
    `/analysis/projects/${encodePathSegment(input.projectId)}/content-optimizer/crawl`,
    {
      method: "POST",
      organizationId: input.organizationId,
      signal,
      body: JSON.stringify(body),
    },
  );

  if (shouldRetryWithResolvedProjectId(response)) {
    const resolvedProjectId = await resolveProjectPathToken(apiBaseURL, input, signal);
    if (resolvedProjectId !== input.projectId) {
      response = await gatewayJSON<ContentOptimizerCrawlJob>(
        apiBaseURL,
        `/analysis/projects/${encodePathSegment(resolvedProjectId)}/content-optimizer/crawl`,
        {
          method: "POST",
          organizationId: input.organizationId,
          signal,
          body: JSON.stringify(body),
        },
      );
    }
  }

  return unwrapGatewayData(response);
}

export async function getContentOptimizerCrawl(
  apiBaseURL: string,
  input: GetContentOptimizerCrawlInput,
  signal?: AbortSignal,
): Promise<ContentOptimizerCrawlResult> {
  const params = new URLSearchParams();
  if (input.limit && input.limit > 0) {
    params.set("limit", String(input.limit));
  }
  if (input.status?.trim()) {
    params.set("status", input.status.trim());
  }
  if (input.cursor?.trim()) {
    params.set("cursor", input.cursor.trim());
  }
  if (input.analyze === false) {
    params.set("analyze", "false");
  }

  const query = params.toString();
  let response = await gatewayJSON<ContentOptimizerCrawlResult>(
    apiBaseURL,
    `/analysis/projects/${encodePathSegment(input.projectId)}/content-optimizer/crawl/${encodePathSegment(input.jobId)}${query ? `?${query}` : ""}`,
    {
      method: "GET",
      organizationId: input.organizationId,
      signal,
      retry: { delayMs: 500 },
    },
  );

  if (shouldRetryWithResolvedProjectId(response)) {
    const resolvedProjectId = await resolveProjectPathToken(apiBaseURL, input, signal);
    if (resolvedProjectId !== input.projectId) {
      response = await gatewayJSON<ContentOptimizerCrawlResult>(
        apiBaseURL,
        `/analysis/projects/${encodePathSegment(resolvedProjectId)}/content-optimizer/crawl/${encodePathSegment(input.jobId)}${query ? `?${query}` : ""}`,
        {
          method: "GET",
          organizationId: input.organizationId,
          signal,
          retry: { delayMs: 500 },
        },
      );
    }
  }

  return unwrapGatewayData(response);
}

export async function analyzeSelectedContentOptimizerRecords(
  apiBaseURL: string,
  input: AnalyzeSelectedContentOptimizerRecordsInput,
  signal?: AbortSignal,
): Promise<ContentOptimizerCrawlResult> {
  const body = JSON.stringify({ records: input.records });
  let response = await gatewayJSON<ContentOptimizerCrawlResult>(
    apiBaseURL,
    `/analysis/projects/${encodePathSegment(input.projectId)}/content-optimizer/analyze`,
    {
      method: "POST",
      organizationId: input.organizationId,
      signal,
      body,
    },
  );

  if (shouldRetryWithResolvedProjectId(response)) {
    const resolvedProjectId = await resolveProjectPathToken(apiBaseURL, input, signal);
    if (resolvedProjectId !== input.projectId) {
      response = await gatewayJSON<ContentOptimizerCrawlResult>(
        apiBaseURL,
        `/analysis/projects/${encodePathSegment(resolvedProjectId)}/content-optimizer/analyze`,
        {
          method: "POST",
          organizationId: input.organizationId,
          signal,
          body,
        },
      );
    }
  }

  return unwrapGatewayData(response);
}

export async function getLatestContentOptimizerCrawl(
  apiBaseURL: string,
  input: {
    projectId: string;
    organizationId?: string;
  },
  signal?: AbortSignal,
): Promise<ContentOptimizerCrawlSnapshot | null> {
  let response = await gatewayJSON<ContentOptimizerCrawlSnapshot>(
    apiBaseURL,
    `/analysis/projects/${encodePathSegment(input.projectId)}/content-optimizer/crawl`,
    {
      method: "GET",
      organizationId: input.organizationId,
      signal,
      retry: { attempts: 0 },
    },
  );

  if (shouldRetryWithResolvedProjectId(response)) {
    const resolvedProjectId = await resolveProjectPathToken(apiBaseURL, input, signal);
    if (resolvedProjectId !== input.projectId) {
      response = await gatewayJSON<ContentOptimizerCrawlSnapshot>(
        apiBaseURL,
        `/analysis/projects/${encodePathSegment(resolvedProjectId)}/content-optimizer/crawl`,
        {
          method: "GET",
          organizationId: input.organizationId,
          signal,
          retry: { attempts: 0 },
        },
      );
    }
  }

  if (!response.ok && response.status === 404) {
    return null;
  }
  return unwrapGatewayData(response);
}
