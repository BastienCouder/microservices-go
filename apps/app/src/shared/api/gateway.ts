import i18n from "@/shared/i18n";
import { translateI18nText } from "@/shared/hooks/use-i18n";

export type GatewayFailure = {
  ok: false;
  status: number;
  error: string;
  code?: string;
  details?: unknown;
  rawError?: string;
  kind: GatewayErrorKind;
};

export type GatewayResult<T> =
  | { ok: true; status: number; data: T }
  | GatewayFailure;

export type GatewayErrorKind =
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "quota_exceeded"
  | "dependency_unavailable"
  | "internal"
  | "timeout"
  | "cancelled"
  | "network"
  | "unknown";

export class GatewayError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly rawError?: string;
  readonly kind: GatewayErrorKind;

  constructor(result: GatewayFailure, fallback: string) {
    super(buildGatewayErrorMessage(result, fallback));
    this.name = "GatewayError";
    this.status = result.status;
    this.code = result.code;
    this.details = result.details;
    this.rawError = result.rawError;
    this.kind = result.kind;
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
const GENERIC_BACKEND_MESSAGES = new Set([
  "",
  "request failed",
  "request timed out",
  "request cancelled",
  "validation error",
  "resource not found",
  "forbidden",
  "unauthorized",
  "conflict",
  "dependency unavailable",
  "internal server error",
  "rate limit exceeded",
  "quota exceeded",
]);

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

function normalizeGatewayMessage(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isGenericBackendMessage(message: string | undefined): boolean {
  return GENERIC_BACKEND_MESSAGES.has(normalizeGatewayMessage(message));
}

function classifyGatewayFailure(input: {
  status: number;
  code?: string;
  rawError?: string;
}): GatewayErrorKind {
  const code = normalizeGatewayMessage(input.code);
  const message = normalizeGatewayMessage(input.rawError);

  if (code === "invalid_request" || message === "validation error") {
    return "validation";
  }
  if (code === "quota_exceeded" || message === "quota exceeded") {
    return "quota_exceeded";
  }
  if (code === "rate_limited" || input.status === 429) {
    return "rate_limited";
  }
  if (code === "not_found" || input.status === 404 || message === "resource not found") {
    return "not_found";
  }
  if (code === "forbidden" || input.status === 403 || message === "forbidden") {
    return "forbidden";
  }
  if (input.status === 401 || message === "unauthorized") {
    return "unauthorized";
  }
  if (code === "conflict" || input.status === 409 || message === "conflict") {
    return "conflict";
  }
  if (
    code === "dependency_unavailable" ||
    input.status === 502 ||
    input.status === 503 ||
    input.status === 504 ||
    message === "dependency unavailable"
  ) {
    return "dependency_unavailable";
  }
  if (input.status === 500 || message === "internal server error") {
    return "internal";
  }
  if (message === "request timed out") {
    return "timeout";
  }
  if (message === "request cancelled") {
    return "cancelled";
  }
  if (message === "request failed" || input.status === 0) {
    return "network";
  }
  return "unknown";
}

function defaultGatewayErrorMessage(kind: GatewayErrorKind): string {
  const locale = i18n.resolvedLanguage || i18n.language || "en";

  switch (kind) {
    case "validation":
      return translateI18nText("shared-api", "validationError", locale);
    case "unauthorized":
      return translateI18nText("shared-api", "unauthorizedError", locale);
    case "forbidden":
      return translateI18nText("shared-api", "forbiddenError", locale);
    case "not_found":
      return translateI18nText("shared-api", "notFoundError", locale);
    case "conflict":
      return translateI18nText("shared-api", "conflictError", locale);
    case "rate_limited":
      return translateI18nText("shared-api", "rateLimitedError", locale);
    case "quota_exceeded":
      return translateI18nText("shared-api", "quotaExceededError", locale);
    case "dependency_unavailable":
      return translateI18nText("shared-api", "dependencyUnavailableError", locale);
    case "internal":
      return translateI18nText("shared-api", "internalError", locale);
    case "timeout":
      return translateI18nText("shared-api", "timeoutError", locale);
    case "cancelled":
      return translateI18nText("shared-api", "cancelledError", locale);
    case "network":
      return translateI18nText("shared-api", "networkError", locale);
    case "unknown":
      return translateI18nText("shared-api", "unknownError", locale);
  }
}

function normalizeGatewayFailure(
  status: number,
  parsedError: { message: string; code?: string },
  details: unknown,
): GatewayFailure {
  const rawError = parsedError.message.trim();
  const kind = classifyGatewayFailure({
    status,
    code: parsedError.code,
    rawError,
  });
  const error =
    !isGenericBackendMessage(rawError) && kind === "unknown"
      ? rawError
      : defaultGatewayErrorMessage(kind);

  return {
    ok: false,
    status,
    error,
    details,
    kind,
    ...(rawError ? { rawError } : {}),
    ...(parsedError.code ? { code: parsedError.code } : {}),
  };
}

function buildGatewayErrorMessage(result: GatewayFailure, fallback: string): string {
  switch (result.kind) {
    case "validation":
    case "unauthorized":
    case "forbidden":
    case "not_found":
    case "conflict":
    case "rate_limited":
    case "quota_exceeded":
      return result.error;
    case "dependency_unavailable":
    case "internal":
    case "timeout":
    case "cancelled":
    case "network":
      return fallback || result.error;
    case "unknown":
      if (result.rawError && !isGenericBackendMessage(result.rawError)) {
        return result.rawError;
      }
      return fallback || result.error;
  }
}

function unwrapSuccessPayload<T>(payload: unknown): T {
  if (
    payload &&
    typeof payload === "object" &&
    "success" in payload &&
    "data" in payload &&
    (payload as { success?: unknown }).success === true
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export function unwrapGatewayPayload<T>(payload: T): T {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  if (!("data" in record)) {
    return payload;
  }

  if (record.success === true) {
    return record.data as T;
  }

  const keys = Object.keys(record);
  if (keys.length === 1 || (keys.length === 2 && keys.includes("message"))) {
    return record.data as T;
  }

  return payload;
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

function resolveGatewayOrganizationId(rawOrganizationId: string): string {
  return rawOrganizationId.trim();
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
  const organizationId = resolveGatewayOrganizationId(rawOrganizationId?.trim() ?? "");
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
        return normalizeGatewayFailure(0, { message: "request timed out" }, null);
      }
      if (fetchInit.signal?.aborted) {
        return normalizeGatewayFailure(0, { message: "request cancelled" }, null);
      }
      if (attempt < retryAttempts && isIdempotentMethod(method)) {
        await waitForRetry(retryDelayMs * 2 ** attempt, fetchInit.signal ?? undefined);
        continue;
      }
      return normalizeGatewayFailure(0, { message: "request failed" }, null);
    }

    requestSignal.cleanup();

    const payload = await parseJSON(response);
    if (response.ok) {
      return { ok: true, status: response.status, data: unwrapSuccessPayload<T>(payload) };
    }

    const parsedError = parseErrorPayload(payload);
    const result = normalizeGatewayFailure(response.status, parsedError, payload);

    if (attempt < retryAttempts && shouldRetryResponse(response.status, method)) {
      await waitForRetry(retryDelayMs * 2 ** attempt, fetchInit.signal ?? undefined);
      continue;
    }

    return result;
  }

  return normalizeGatewayFailure(0, { message: "request failed" }, null);
}

export function toGatewayError(result: GatewayFailure, fallback: string): GatewayError {
  return new GatewayError(result, fallback);
}

export function isGatewayError(error: unknown): error is GatewayError {
  return error instanceof GatewayError;
}

export function requireGatewayResult<T>(
  result: GatewayResult<T>,
  fallback: string,
): T {
  if (!result.ok) {
    throw toGatewayError(result, fallback);
  }
  return result.data;
}

export async function requireGatewayData<T>(
  promise: Promise<GatewayResult<T>>,
  fallback: string,
): Promise<T> {
  const result = await promise;
  return requireGatewayResult(result, fallback);
}

export async function optionalGatewayData<T>(
  promise: Promise<GatewayResult<T>>,
  fallback: T,
): Promise<T> {
  const result = await promise;
  if (!result.ok) {
    return fallback;
  }
  return result.data;
}
