import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON } from "@/shared/api/gateway";
import { resolveProjectTokenToId } from "@/shared/project-token-resolution";

import type {
  AuditQueuedResponse,
  AuditScanInput,
  AuditScanResult,
} from "../shared/types";

type PollOptions = {
  delayMs?: number;
  maxAttempts?: number;
  signal?: AbortSignal;
};

const DEFAULT_POLL_DELAY_MS = 800;
const DEFAULT_MAX_ATTEMPTS = 20;

type ProjectSummary = {
  name: string;
  websiteUrl: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
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

export function isValidScanURL(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      parsed.hostname.trim() !== ""
    );
  } catch {
    return false;
  }
}

export async function getAgentReadyProjectSummary(
  apiBaseURL: string,
  input: {
    projectId: string;
    organizationId?: string;
  },
  signal?: AbortSignal,
): Promise<ProjectSummary> {
  let response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.projects.get(encodeURIComponent(input.projectId.trim())),
    {
      method: "GET",
      organizationId: input.organizationId,
      signal,
    },
  );

  if (!response.ok && [401, 403, 404].includes(response.status)) {
    const resolvedProjectId = await resolveProjectTokenToId(apiBaseURL, {
      projectToken: input.projectId,
      organizationId: input.organizationId,
      signal,
    });
    if (resolvedProjectId && resolvedProjectId !== input.projectId) {
      response = await gatewayJSON<unknown>(
        apiBaseURL,
        apiRoutes.projects.get(encodeURIComponent(resolvedProjectId)),
        {
          method: "GET",
          organizationId: input.organizationId,
          signal,
        },
      );
    }
  }

  if (!response.ok) {
    throw new Error(response.error);
  }

  const payload =
    response.data && typeof response.data === "object" && "data" in response.data
      ? (response.data as { data: unknown }).data
      : response.data;

  return {
    name: readProjectName(payload),
    websiteUrl: readProjectWebsiteURL(payload),
  };
}

export async function startAgentReadyScan(
  apiBaseURL: string,
  input: AuditScanInput,
): Promise<AuditQueuedResponse> {
  const response = await gatewayJSON<AuditQueuedResponse>(apiBaseURL, apiRoutes.agentReady.scans(), {
    method: "POST",
    body: JSON.stringify(input),
    retry: { attempts: 0 },
  });

  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.data;
}

export async function getAgentReadyScan(
  apiBaseURL: string,
  scanID: string,
  signal?: AbortSignal,
): Promise<AuditScanResult> {
  const response = await gatewayJSON<AuditScanResult>(
    apiBaseURL,
    apiRoutes.agentReady.scan(scanID),
    { method: "GET", retry: { delayMs: 200 }, signal },
  );

  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.data;
}

export async function pollAgentReadyScan(
  apiBaseURL: string,
  scanID: string,
  options: PollOptions = {},
): Promise<AuditScanResult> {
  const delayMs = options.delayMs ?? DEFAULT_POLL_DELAY_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await getAgentReadyScan(apiBaseURL, scanID, options.signal);
    if (result.status === "done" || result.status === "failed") {
      return result;
    }
    await wait(delayMs, options.signal);
  }

  throw new Error("scan timed out");
}

function wait(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs <= 0) return Promise.resolve();
  if (signal?.aborted) return Promise.reject(signal.reason);

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, delayMs);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
