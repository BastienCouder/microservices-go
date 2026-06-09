import type {
  LLMProviderCredentialStatus,
  ModelCatalogItem,
} from "../model-access";
import {
  DEFAULT_LLM_PROVIDER_ID_SET,
  DEFAULT_LLM_PROVIDER_IDS,
  DIRECT_LLM_PROVIDER_IDS,
  getField,
  getOptionalBool,
  getString,
  isRecord,
  normalizeProviderId,
  OPENROUTER_PROVIDER_ID,
  unwrapSuccessEnvelope,
} from "./catalog-utils";

export type ProviderCredentialLookup = Map<string, LLMProviderCredentialStatus>;

export function buildProviderLabel(provider: string): string {
  const normalized = normalizeProviderId(provider);
  if (normalized === "openai") return "OpenAI";
  if (normalized === "anthropic") return "Anthropic";
  if (normalized === "google" || normalized === "gemini") return "Google Gemini";
  if (normalized === "mistral" || normalized === "mistralai") return "Mistral AI";
  if (normalized === "perplexity") return "Perplexity";
  if (normalized === "openrouter") return "OpenRouter";
  if (normalized === "deepseek") return "DeepSeek";
  if (normalized === "groq") return "Groq";
  if (normalized === "xai") return "xAI";
  if (normalized === "qwen") return "Qwen";
  if (normalized === "zai") return "Z.ai";
  if (normalized === "copilot") return "Microsoft Copilot";
  if (normalized === "meta") return "Meta";
  if (!normalized) return "Fournisseur LLM";

  return normalized
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeLLMProviderCredentials(
  value: unknown,
): LLMProviderCredentialStatus[] {
  const payload = unwrapSuccessEnvelope(value);
  const entries = Array.isArray(payload)
    ? payload
    : isRecord(payload)
      ? [payload]
      : [];

  return entries
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => {
      const provider = normalizeProviderId(
        getString(getField(entry, ["provider", "Provider"])),
      );
      const hasApiKey =
        getOptionalBool(
          getField(entry, [
            "hasApiKey",
            "HasAPIKey",
            "hasAPIKey",
            "HasApiKey",
            "has_api_key",
          ]),
        ) ?? false;
      const label =
        getString(getField(entry, ["label", "Label", "displayName", "DisplayName"])) ||
        buildProviderLabel(provider);

      return {
        provider,
        label,
        hasApiKey,
        updatedAt: getString(getField(entry, ["updatedAt", "UpdatedAt", "updated_at"])),
      };
    })
    .filter((entry) => entry.provider !== "");
}

export function createProviderCredentialLookup(
  credentials: LLMProviderCredentialStatus[],
): ProviderCredentialLookup {
  return new Map(
    credentials.map((credential) => [
      normalizeProviderId(credential.provider),
      { ...credential, provider: normalizeProviderId(credential.provider) },
    ]),
  );
}

function resolveCredentialLookup(
  credentials: LLMProviderCredentialStatus[],
  credentialLookup?: ProviderCredentialLookup,
): ProviderCredentialLookup {
  return credentialLookup ?? createProviderCredentialLookup(credentials);
}

export function getProviderCredentialOptions(
  catalog: ModelCatalogItem[],
  credentials: LLMProviderCredentialStatus[] = [],
  credentialLookup?: ProviderCredentialLookup,
): LLMProviderCredentialStatus[] {
  const credentialByProvider = resolveCredentialLookup(credentials, credentialLookup);
  const activeProviderIds = new Set<string>();

  for (const model of catalog) {
    if (!model.isActive) continue;
    const provider = normalizeProviderId(model.provider);
    if (provider) activeProviderIds.add(provider);
  }

  if (activeProviderIds.size === 0) return [];

  const orderedProviderIds = [
    OPENROUTER_PROVIDER_ID,
    ...DEFAULT_LLM_PROVIDER_IDS.filter(
      (provider) =>
        provider !== OPENROUTER_PROVIDER_ID && activeProviderIds.has(provider),
    ),
    ...Array.from(activeProviderIds)
      .filter((provider) => !DEFAULT_LLM_PROVIDER_ID_SET.has(provider))
      .sort((left, right) => left.localeCompare(right)),
  ];

  return orderedProviderIds.map((provider) => {
    const credential = credentialByProvider.get(provider);
    return {
      provider,
      label: credential?.label || buildProviderLabel(provider),
      hasApiKey: credential?.hasApiKey ?? false,
      updatedAt: credential?.updatedAt ?? "",
    };
  });
}

export function isProviderUsableWithCredentials(
  provider: string,
  credentials: LLMProviderCredentialStatus[],
  credentialLookup?: ProviderCredentialLookup,
): boolean {
  const credentialByProvider = resolveCredentialLookup(credentials, credentialLookup);
  const normalizedProvider = normalizeProviderId(provider);
  const directCredential = credentialByProvider.get(normalizedProvider);
  const openRouterCredential = credentialByProvider.get(OPENROUTER_PROVIDER_ID);

  return Boolean(
    openRouterCredential?.hasApiKey ||
      (DIRECT_LLM_PROVIDER_IDS.has(normalizedProvider) &&
        directCredential?.hasApiKey),
  );
}

export function getProviderKeyRequirements(
  catalog: ModelCatalogItem[],
  selectedModelIds: string[],
  credentials: LLMProviderCredentialStatus[] = [],
  credentialLookup?: ProviderCredentialLookup,
): LLMProviderCredentialStatus[] {
  const selectedIds = new Set(selectedModelIds);
  if (selectedIds.size === 0) return [];

  const credentialByProvider = resolveCredentialLookup(credentials, credentialLookup);
  const providers = new Map<string, LLMProviderCredentialStatus>();
  const openRouterCredential = credentialByProvider.get(OPENROUTER_PROVIDER_ID);

  for (const model of catalog) {
    if (!model.isActive || !selectedIds.has(model.id)) continue;

    const provider = normalizeProviderId(model.provider);
    if (!provider || providers.has(provider)) continue;

    const credential = credentialByProvider.get(provider);
    providers.set(provider, {
      provider,
      label: credential?.label || buildProviderLabel(provider),
      hasApiKey: Boolean(
        openRouterCredential?.hasApiKey ||
          (DIRECT_LLM_PROVIDER_IDS.has(provider) && credential?.hasApiKey),
      ),
      updatedAt:
        credential?.updatedAt ||
        (openRouterCredential?.hasApiKey ? openRouterCredential.updatedAt : ""),
    });
  }

  return Array.from(providers.values());
}
