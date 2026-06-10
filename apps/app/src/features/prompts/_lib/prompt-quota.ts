import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON, unwrapGatewayPayload } from "@/shared/api/gateway";

export type PromptQuotaUsageData = {
  hasQuota: boolean;
  usedPrompts: number;
  usedCredits: number;
  monthlyQuota: number;
  monthlyCredits: number;
  remainingPrompts: number;
  remainingCredits: number;
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

function normalizePromptQuotaUsage(value: unknown): PromptQuotaUsageData {
  const payload = asObject(value);

  const usedCredits = Math.max(
    0,
    Math.floor(asNumber(payload.usedCredits) || asNumber(payload.usedPrompts)),
  );
  const monthlyCredits = Math.max(
    0,
    Math.floor(asNumber(payload.monthlyCredits) || asNumber(payload.monthlyQuota)),
  );
  const remainingCredits = Math.max(
    0,
    Math.floor(
      asNumber(payload.remainingCredits) || asNumber(payload.remainingPrompts),
    ),
  );

  return {
    hasQuota: asBool(payload.hasQuota),
    usedPrompts: usedCredits,
    usedCredits,
    monthlyQuota: monthlyCredits,
    monthlyCredits,
    remainingPrompts: remainingCredits,
    remainingCredits,
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

  return normalizePromptQuotaUsage(unwrapGatewayPayload(result.data));
}
