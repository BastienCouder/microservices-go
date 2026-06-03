import { unwrapGatewayPayload } from "@/shared/api/gateway";
import type { ModelCatalogItem } from "../model-access";

export const OPENROUTER_PROVIDER_ID = "openrouter";

export const DIRECT_LLM_PROVIDER_IDS = new Set([
  "openai",
  "google",
  "deepseek",
  "mistral",
  "perplexity",
  "qwen",
  "groq",
  "xai",
  "zai",
]);

export const DEFAULT_LLM_PROVIDER_IDS = [
  OPENROUTER_PROVIDER_ID,
  "openai",
  "google",
  "anthropic",
  "deepseek",
  "mistral",
  "perplexity",
  "qwen",
  "groq",
  "xai",
  "zai",
  "copilot",
  "meta",
] as const;

export const DEFAULT_LLM_PROVIDER_ID_SET = new Set<string>(
  DEFAULT_LLM_PROVIDER_IDS,
);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getField<T = unknown>(
  obj: Record<string, unknown>,
  keys: string[],
): T | undefined {
  for (const key of keys) {
    if (key in obj) return obj[key] as T;
  }
  return undefined;
}

export function unwrapSuccessEnvelope(value: unknown): unknown {
  return unwrapGatewayPayload(value);
}

export function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getBool(value: unknown): boolean {
  return value === true;
}

export function getOptionalBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

export function getIDString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function normalizeProviderId(provider: string): string {
  const normalized = provider.trim().toLowerCase();
  const compact = normalized.replace(/[\s._-]+/g, "");

  if (compact === "openai") return "openai";
  if (compact === "anthropic" || compact === "antropic") return "anthropic";
  if (normalized === "gemini" || compact === "gemini") return "google";
  if (compact === "mistralai") return "mistral";
  if (compact === "qwencolor") return "qwen";
  if (compact === "z" || compact === "zai") return "zai";
  if (compact === "x" || compact === "xai" || compact === "grok") {
    return "xai";
  }
  if (compact === "metallama") return "meta";
  return normalized;
}

function compareCatalogItemsByProvider(
  left: ModelCatalogItem,
  right: ModelCatalogItem,
): number {
  const providerOrder = normalizeProviderId(left.provider).localeCompare(
    normalizeProviderId(right.provider),
    "fr",
    { sensitivity: "base", numeric: true },
  );
  if (providerOrder !== 0) return providerOrder;

  const nameOrder = left.name.localeCompare(right.name, "fr", {
    sensitivity: "base",
    numeric: true,
  });
  if (nameOrder !== 0) return nameOrder;

  return left.id.localeCompare(right.id, "fr", {
    sensitivity: "base",
    numeric: true,
  });
}

export function sortCatalogItemsByProvider(
  items: ModelCatalogItem[],
): ModelCatalogItem[] {
  return [...items].sort(compareCatalogItemsByProvider);
}

export const sortCatalogItemsByName = sortCatalogItemsByProvider;
