export type GatewayResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; details?: unknown };

type GatewayRetryOptions = {
  attempts?: number;
  delayMs?: number;
};

const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 150;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

function parseErrorPayload(payload: unknown): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }
  return "request failed";
}

async function parseJSON(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  return (await response.json()) as unknown;
}

function getRequestMethod(method: string | undefined): string {
  return (method || "GET").trim().toUpperCase();
}

function isIdempotentMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

function shouldRetryResponse(status: number, method: string): boolean {
  return isIdempotentMethod(method) && RETRYABLE_STATUSES.has(status);
}

function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
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

export async function gatewayJSON<T>(
  baseURL: string,
  path: string,
  init?: RequestInit & { organizationId?: string; retry?: GatewayRetryOptions },
): Promise<GatewayResult<T>> {
  const url = `${baseURL.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
  const { organizationId: rawOrganizationId, retry, ...fetchInit } = init ?? {};
  const organizationId = rawOrganizationId?.trim() ?? "";
  const method = getRequestMethod(fetchInit.method);
  const retryAttempts = Math.max(0, retry?.attempts ?? DEFAULT_RETRY_ATTEMPTS);
  const retryDelayMs = Math.max(0, retry?.delayMs ?? DEFAULT_RETRY_DELAY_MS);

  const headers = new Headers(fetchInit.headers ?? undefined);
  if (!headers.has("Content-Type") && fetchInit.body) {
    headers.set("Content-Type", "application/json");
  }
  if (organizationId !== "") {
    headers.set("X-Organization-ID", organizationId);
  }

  for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
    const response = await fetch(url, {
      ...fetchInit,
      headers,
      credentials: "include",
    });

    const payload = await parseJSON(response);
    if (response.ok) {
      return { ok: true, status: response.status, data: payload as T };
    }

    const result: GatewayResult<T> = {
      ok: false,
      status: response.status,
      error: parseErrorPayload(payload),
      details: payload,
    };

    if (attempt < retryAttempts && shouldRetryResponse(response.status, method)) {
      await waitForRetry(retryDelayMs * 2 ** attempt, fetchInit.signal ?? undefined);
      continue;
    }

    return result;
  }

  return { ok: false, status: 0, error: "request failed" };
}
