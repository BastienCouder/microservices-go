export type GatewayFailure = {
  ok: false;
  status: number;
  error: string;
  code?: string;
  details?: unknown;
};

export type GatewayResult<T> =
  | { ok: true; status: number; data: T }
  | GatewayFailure;

export class GatewayError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(result: GatewayFailure, fallback: string) {
    super(result.error || fallback);
    this.name = "GatewayError";
    this.status = result.status;
    this.code = result.code;
    this.details = result.details;
  }
}

type GatewayRetryOptions = {
  attempts?: number;
  delayMs?: number;
};

const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 150;
const DEFAULT_TIMEOUT_MS = 30_000;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

function parseErrorPayload(payload: unknown): { message: string; code?: string } {
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string" && value.trim() !== "") {
      return { message: value };
    }
    if (value && typeof value === "object") {
      const error = value as { code?: unknown; message?: unknown };
      const message =
        typeof error.message === "string" && error.message.trim() !== ""
          ? error.message
          : "request failed";
      const code =
        typeof error.code === "string" && error.code.trim() !== ""
          ? error.code
          : undefined;
      return { message, code };
    }
  }
  return { message: "request failed" };
}

async function parseJSON(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
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
    const timeout = globalThis.setTimeout(resolve, delayMs);
    signal?.addEventListener(
      "abort",
      () => {
        globalThis.clearTimeout(timeout);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

function createRequestSignal(
  sourceSignal: AbortSignal | undefined,
  timeoutMs: number,
): { signal?: AbortSignal; cleanup: () => void; timedOut: () => boolean } {
  if (!sourceSignal && timeoutMs <= 0) {
    return { cleanup: () => undefined, timedOut: () => false };
  }

  const controller = new AbortController();
  let didTimeout = false;
  let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;

  const abortFromSource = () => {
    controller.abort(sourceSignal?.reason ?? new Error("request cancelled"));
  };

  if (sourceSignal?.aborted) {
    abortFromSource();
  } else {
    sourceSignal?.addEventListener("abort", abortFromSource, { once: true });
  }

  if (timeoutMs > 0) {
    timeout = globalThis.setTimeout(() => {
      didTimeout = true;
      controller.abort(new Error("request timed out"));
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timeout) globalThis.clearTimeout(timeout);
      sourceSignal?.removeEventListener("abort", abortFromSource);
    },
    timedOut: () => didTimeout,
  };
}

export async function gatewayJSON<T>(
  baseURL: string,
  path: string,
  init?: RequestInit & {
    organizationId?: string;
    retry?: GatewayRetryOptions;
    timeoutMs?: number;
  },
): Promise<GatewayResult<T>> {
  const url = `${baseURL.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
  const {
    organizationId: rawOrganizationId,
    retry,
    timeoutMs,
    ...fetchInit
  } = init ?? {};
  const organizationId = rawOrganizationId?.trim() ?? "";
  const method = getRequestMethod(fetchInit.method);
  const retryAttempts = Math.max(0, retry?.attempts ?? DEFAULT_RETRY_ATTEMPTS);
  const retryDelayMs = Math.max(0, retry?.delayMs ?? DEFAULT_RETRY_DELAY_MS);
  const requestTimeoutMs = Math.max(0, timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const headers = new Headers(fetchInit.headers ?? undefined);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (!headers.has("Content-Type") && fetchInit.body) {
    headers.set("Content-Type", "application/json");
  }
  if (organizationId !== "") {
    headers.set("X-Organization-ID", organizationId);
  }

  for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
    const requestSignal = createRequestSignal(
      fetchInit.signal ?? undefined,
      requestTimeoutMs,
    );

    let response: Response;
    try {
      response = await fetch(url, {
        ...fetchInit,
        headers,
        credentials: "include",
        signal: requestSignal.signal,
      });
    } catch {
      const timedOut = requestSignal.timedOut();
      requestSignal.cleanup();
      if (timedOut) {
        return { ok: false, status: 0, error: "request timed out" };
      }
      if (fetchInit.signal?.aborted) {
        return { ok: false, status: 0, error: "request cancelled" };
      }
      if (attempt < retryAttempts && isIdempotentMethod(method)) {
        await waitForRetry(retryDelayMs * 2 ** attempt, fetchInit.signal ?? undefined);
        continue;
      }
      return { ok: false, status: 0, error: "request failed" };
    }

    requestSignal.cleanup();

    const payload = await parseJSON(response);
    if (response.ok) {
      return { ok: true, status: response.status, data: payload as T };
    }

    const parsedError = parseErrorPayload(payload);
    const result: GatewayFailure = {
      ok: false,
      status: response.status,
      error: parsedError.message,
      details: payload,
    };
    if (parsedError.code) {
      result.code = parsedError.code;
    }

    if (attempt < retryAttempts && shouldRetryResponse(response.status, method)) {
      await waitForRetry(retryDelayMs * 2 ** attempt, fetchInit.signal ?? undefined);
      continue;
    }

    return result;
  }

  return { ok: false, status: 0, error: "request failed" };
}

export function toGatewayError(result: GatewayFailure, fallback: string): GatewayError {
  return new GatewayError(result, fallback);
}
