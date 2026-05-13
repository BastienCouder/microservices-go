import { gatewayJSON, type GatewayResult } from "@/shared/api/gateway";

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
};

function encodePathSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

function unwrapGatewayData<T>(response: GatewayResult<unknown>): T {
  if (!response.ok) {
    throw new Error(response.error);
  }
  const payload = response.data;
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
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
    ...(includePatterns.length > 0
      ? { options: { includePatterns } }
      : {}),
  };

  const response = await gatewayJSON<ContentOptimizerCrawlJob>(
    apiBaseURL,
    `/analysis/projects/${encodePathSegment(input.projectId)}/content-optimizer/crawl`,
    {
      method: "POST",
      organizationId: input.organizationId,
      signal,
      body: JSON.stringify(body),
    },
  );

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

  const query = params.toString();
  const response = await gatewayJSON<ContentOptimizerCrawlResult>(
    apiBaseURL,
    `/analysis/projects/${encodePathSegment(input.projectId)}/content-optimizer/crawl/${encodePathSegment(input.jobId)}${query ? `?${query}` : ""}`,
    {
      method: "GET",
      organizationId: input.organizationId,
      signal,
      retry: { delayMs: 500 },
    },
  );

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
  const response = await gatewayJSON<ContentOptimizerCrawlSnapshot>(
    apiBaseURL,
    `/analysis/projects/${encodePathSegment(input.projectId)}/content-optimizer/crawl`,
    {
      method: "GET",
      organizationId: input.organizationId,
      signal,
      retry: { attempts: 0 },
    },
  );

  if (!response.ok && response.status === 404) {
    return null;
  }
  return unwrapGatewayData(response);
}
