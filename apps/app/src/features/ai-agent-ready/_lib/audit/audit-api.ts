import { gatewayJSON } from "@/shared/api/gateway";

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

export async function startAgentReadyScan(
  apiBaseURL: string,
  input: AuditScanInput,
): Promise<AuditQueuedResponse> {
  const response = await gatewayJSON<AuditQueuedResponse>(apiBaseURL, "/api/scan", {
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
    `/api/scan/${encodeURIComponent(scanID)}`,
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
