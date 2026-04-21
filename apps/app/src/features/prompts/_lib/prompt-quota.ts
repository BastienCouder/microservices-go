import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON } from "@/shared/api/gateway";

export type PromptQuotaUsageData = {
  hasQuota: boolean;
  usedPrompts: number;
  monthlyQuota: number;
  remainingPrompts: number;
  currentMonth: string;
  isLimitReached: boolean;
};

type JsonObject = Record<string, unknown>;

export class PromptQuotaRequestError extends Error {
  status: number;

  constructor(status: number, message?: string) {
    super(message || "prompt quota request failed");
    this.name = "PromptQuotaRequestError";
    this.status = status;
  }
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" ? (value as JsonObject) : {};
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asBool(value: unknown): boolean {
  return value === true;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function unwrapSuccessEnvelope(value: unknown): unknown {
  const payload = asObject(value);
  if (payload.success === true && "data" in payload) {
    return payload.data;
  }
  return value;
}

function normalizePromptQuotaUsage(value: unknown): PromptQuotaUsageData {
  const payload = asObject(value);

  return {
    hasQuota: asBool(payload.hasQuota),
    usedPrompts: Math.max(0, Math.floor(asNumber(payload.usedPrompts))),
    monthlyQuota: Math.max(0, Math.floor(asNumber(payload.monthlyQuota))),
    remainingPrompts: Math.max(0, Math.floor(asNumber(payload.remainingPrompts))),
    currentMonth: asString(payload.currentMonth),
    isLimitReached: asBool(payload.isLimitReached),
  };
}

export async function loadPromptQuotaUsage(
  apiBaseURL: string,
  projectId: string,
  organizationId: string,
  options?: { signal?: AbortSignal },
): Promise<PromptQuotaUsageData> {
  const result = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.analysis.quota(projectId), {
    method: "GET",
    signal: options?.signal,
    organizationId,
  });

  if (!result.ok) {
    throw new PromptQuotaRequestError(result.status, result.error);
  }

  return normalizePromptQuotaUsage(unwrapSuccessEnvelope(result.data));
}
