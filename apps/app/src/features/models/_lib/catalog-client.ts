import { apiRoutes } from "@/lib/api-config";
import {
  buildModelDescription,
  normalizeModelPayload,
} from "@/lib/project-models";
import { gatewayJSON } from "@/shared/api/gateway";
import type {
  CatalogModelPayload,
  CatalogModelUpdatePayload,
  LLMProviderCredentialStatus,
  ModelCatalogItem,
  OpenRouterModelSyncInput,
  OpenRouterModelSyncResult,
  ModelsProjectSummary,
} from "./model-access";

const OPENROUTER_PROVIDER_ID = "openrouter";
const DIRECT_LLM_PROVIDER_IDS = new Set([
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
const DEFAULT_LLM_PROVIDER_IDS = [
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
const DEFAULT_LLM_PROVIDER_ID_SET = new Set<string>(DEFAULT_LLM_PROVIDER_IDS);

export type ModelCatalogAdminFilters = {
  provider?: string;
  search?: string;
  status?: "all" | "active" | "inactive";
  supportsLiveSearch?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getField<T = unknown>(
  obj: Record<string, unknown>,
  keys: string[],
): T | undefined {
  for (const key of keys) {
    if (key in obj) return obj[key] as T;
  }
  return undefined;
}

function unwrapSuccessEnvelope(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.success === true && "data" in value) {
    return value.data;
  }
  return value;
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getBool(value: unknown): boolean {
  return value === true;
}

function getOptionalBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function getIDString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
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

export function normalizeProjects(value: unknown): ModelsProjectSummary[] {
  const payload = unwrapSuccessEnvelope(value);
  if (!Array.isArray(payload)) return [];

  return payload
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => ({
      id: getIDString(getField(entry, ["id", "ID"])),
      name: getString(getField(entry, ["name", "Name"])) || "Projet",
      brandName: getString(getField(entry, ["brandName", "BrandName"])),
      status: getString(getField(entry, ["status", "Status"])),
    }))
    .filter((project) => project.id !== "");
}

export function normalizeCatalogItem(value: unknown): ModelCatalogItem | null {
  const model = normalizeModelPayload(value);
  if (!model) return null;

  return {
    id: model.id,
    modelGroup: model.groupName || model.displayName || "Modele IA",
    name: model.displayName || "Modele IA",
    provider: model.provider,
    providerModelId: model.providerModelId,
    iconKey: model.iconKey,
    description: buildModelDescription({
      provider: model.provider,
      providerModelId: model.providerModelId,
      supportsLiveSearch: model.supportsLiveSearch,
    }),
    icon: model.iconPath,
    isActive: model.isActive,
    supportsLiveSearch: model.supportsLiveSearch,
  };
}

export function normalizeCatalogMutationItem(value: unknown): ModelCatalogItem | null {
  return normalizeCatalogItem(unwrapSuccessEnvelope(value));
}

export function normalizeCatalog(value: unknown): ModelCatalogItem[] {
  const payload = unwrapSuccessEnvelope(value);
  if (!Array.isArray(payload)) return [];

  return payload
    .map((entry) => normalizeCatalogItem(entry))
    .filter((entry): entry is ModelCatalogItem => entry !== null);
}

export function normalizeSelectedModelIds(value: unknown): string[] {
  const payload = unwrapSuccessEnvelope(value);
  if (!Array.isArray(payload)) return [];

  return payload
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .filter((entry) => getBool(getField(entry, ["isEnabledForProject"])))
    .map((entry) => getIDString(getField(entry, ["id", "ID"])))
    .filter(Boolean);
}

export function buildProviderLabel(provider: string): string {
  const normalized = normalizeProviderId(provider);
  if (normalized === "openai") return "OpenAI";
  if (normalized === "anthropic") return "Anthropic";
  if (normalized === "google" || normalized === "gemini") {
    return "Google Gemini";
  }
  if (normalized === "mistral" || normalized === "mistralai") {
    return "Mistral AI";
  }
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

export function normalizeProviderId(provider: string): string {
  const normalized = provider.trim().toLowerCase();
  const compact = normalized.replace(/[\s._-]+/g, "");
  if (compact === "openai") return "openai";
  if (compact === "anthropic" || compact === "antropic") return "anthropic";
  if (normalized === "gemini") return "google";
  if (compact === "gemini") return "google";
  if (compact === "mistralai") return "mistral";
  if (compact === "qwencolor") return "qwen";
  if (compact === "z" || compact === "zai") return "zai";
  if (compact === "x" || compact === "xai" || compact === "grok") {
    return "xai";
  }
  if (compact === "metallama") return "meta";
  return normalized;
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

export type ProviderCredentialLookup = Map<string, LLMProviderCredentialStatus>;

export function createProviderCredentialLookup(
  credentials: LLMProviderCredentialStatus[],
): ProviderCredentialLookup {
  return new Map(
    credentials.map((credential) => [
      normalizeProviderId(credential.provider),
      {
        ...credential,
        provider: normalizeProviderId(credential.provider),
      },
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
  const credentialByProvider = resolveCredentialLookup(
    credentials,
    credentialLookup,
  );
  const activeProviderIds = new Set<string>();

  for (const model of catalog) {
    if (!model.isActive) continue;
    const provider = normalizeProviderId(model.provider);
    if (provider) {
      activeProviderIds.add(provider);
    }
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

export function filterModelCatalogForAdmin(
  catalog: ModelCatalogItem[],
  filters: ModelCatalogAdminFilters,
): ModelCatalogItem[] {
  const provider = normalizeProviderId(filters.provider ?? "");
  const search = filters.search?.trim().toLowerCase() ?? "";
  const status = filters.status ?? "all";

  return sortCatalogItemsByProvider(
    catalog.filter((model) => {
      if (status === "active" && !model.isActive) return false;
      if (status === "inactive" && model.isActive) return false;
      if (provider && normalizeProviderId(model.provider) !== provider) {
        return false;
      }
      if (
        filters.supportsLiveSearch === true &&
        !model.supportsLiveSearch
      ) {
        return false;
      }
      if (!search) return true;

      return [
        model.id,
        model.name,
        model.modelGroup,
        model.provider,
        model.providerModelId,
        model.description,
      ].some((value) => value.toLowerCase().includes(search));
    }),
  );
}

export function isProviderUsableWithCredentials(
  provider: string,
  credentials: LLMProviderCredentialStatus[],
  credentialLookup?: ProviderCredentialLookup,
): boolean {
  const credentialByProvider = resolveCredentialLookup(
    credentials,
    credentialLookup,
  );
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

  const credentialByProvider = resolveCredentialLookup(
    credentials,
    credentialLookup,
  );
  const providers = new Map<string, LLMProviderCredentialStatus>();
  const openRouterCredential = credentialByProvider.get(OPENROUTER_PROVIDER_ID);

  for (const model of catalog) {
    if (!model.isActive) continue;
    if (!selectedIds.has(model.id)) continue;

    const provider = normalizeProviderId(model.provider);
    if (!provider || providers.has(provider)) continue;

    const credential = credentialByProvider.get(provider);
    const directCredentialUsable = DIRECT_LLM_PROVIDER_IDS.has(provider);
    providers.set(provider, {
      provider,
      label: credential?.label || buildProviderLabel(provider),
      hasApiKey: Boolean(
        openRouterCredential?.hasApiKey ||
          (directCredentialUsable && credential?.hasApiKey),
      ),
      updatedAt:
        credential?.updatedAt ||
        (openRouterCredential?.hasApiKey ? openRouterCredential.updatedAt : ""),
    });
  }

  return Array.from(providers.values());
}

export async function loadModelCatalog(
  apiBaseURL: string,
  organizationId: string,
  options?: { activeOnly?: boolean; signal?: AbortSignal },
): Promise<ModelCatalogItem[]> {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.aiModels.list(options?.activeOnly ?? true),
    {
      method: "GET",
      organizationId,
      signal: options?.signal,
    },
  );

  if (!response.ok) {
    throw new Error("Impossible de charger le catalogue des modeles.");
  }

  return normalizeCatalog(response.data);
}

export async function loadProjectsAndCatalog(
  apiBaseURL: string,
  organizationId: string,
  options?: { activeOnly?: boolean; signal?: AbortSignal },
): Promise<{ projects: ModelsProjectSummary[]; catalog: ModelCatalogItem[] }> {
  const [projectsResponse, catalog] = await Promise.all([
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.list(), {
      method: "GET",
      organizationId,
      signal: options?.signal,
    }),
    loadModelCatalog(apiBaseURL, organizationId, options),
  ]);

  if (!projectsResponse.ok) {
    throw new Error(
      "Impossible de charger les projets pour cette organisation.",
    );
  }

  return {
    projects: normalizeProjects(projectsResponse.data),
    catalog,
  };
}

export async function loadProjectModels(
  apiBaseURL: string,
  organizationId: string,
  projectId: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.projects.models(projectId),
    {
      method: "GET",
      organizationId,
      signal,
    },
  );

  if (!response.ok) {
    throw new Error("Impossible de charger les modeles actifs du projet.");
  }

  return normalizeSelectedModelIds(response.data);
}

export async function loadLLMProviderCredentials(
  apiBaseURL: string,
  organizationId: string,
  projectId: string,
  signal?: AbortSignal,
): Promise<LLMProviderCredentialStatus[]> {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.llmProviderCredentials.list(projectId),
    {
      method: "GET",
      organizationId,
      signal,
    },
  );

  if (!response.ok) {
    throw new Error("Impossible de charger les cles API LLM.");
  }

  return normalizeLLMProviderCredentials(response.data);
}

export async function saveLLMProviderCredential(
  apiBaseURL: string,
  organizationId: string,
  projectId: string,
  provider: string,
  apiKey: string,
): Promise<LLMProviderCredentialStatus> {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.llmProviderCredentials.update(projectId, provider),
    {
      method: "PUT",
      organizationId,
      body: JSON.stringify({ apiKey }),
    },
  );

  if (!response.ok) {
    throw new Error(response.error || "Impossible d'enregistrer la cle API LLM.");
  }

  const [credential] = normalizeLLMProviderCredentials(response.data);
  if (!credential) {
    throw new Error("Reponse de cle API LLM invalide.");
  }
  return credential;
}

export async function deleteLLMProviderCredential(
  apiBaseURL: string,
  organizationId: string,
  projectId: string,
  provider: string,
): Promise<LLMProviderCredentialStatus> {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.llmProviderCredentials.delete(projectId, provider),
    {
      method: "DELETE",
      organizationId,
    },
  );

  if (!response.ok) {
    throw new Error(response.error || "Impossible de supprimer la cle API LLM.");
  }

  const [credential] = normalizeLLMProviderCredentials(response.data);
  if (!credential) {
    return {
      provider: normalizeProviderId(provider),
      label: buildProviderLabel(provider),
      hasApiKey: false,
      updatedAt: "",
    };
  }
  return credential;
}

export async function createCatalogModel(
  apiBaseURL: string,
  organizationId: string,
  payload: CatalogModelPayload,
): Promise<ModelCatalogItem> {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.aiModels.create(),
    {
      method: "POST",
      organizationId,
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error("Impossible de creer le modele.");
  }

  const model = normalizeCatalogMutationItem(response.data);
  if (!model) {
    throw new Error("Reponse catalogue invalide.");
  }
  return model;
}

export async function updateCatalogModel(
  apiBaseURL: string,
  organizationId: string,
  modelId: string,
  payload: CatalogModelUpdatePayload,
): Promise<ModelCatalogItem> {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.aiModels.update(modelId),
    {
      method: "PATCH",
      organizationId,
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(response.error || "Impossible de mettre a jour le modele.");
  }

  const model = normalizeCatalogMutationItem(response.data);
  if (!model) {
    throw new Error("Reponse catalogue invalide.");
  }
  return model;
}

export async function syncOpenRouterModelCatalog(
  apiBaseURL: string,
  organizationId: string,
  input: OpenRouterModelSyncInput,
): Promise<OpenRouterModelSyncResult> {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.aiModels.syncOpenRouter(),
    {
      method: "POST",
      organizationId,
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    throw new Error(
      response.error || "Impossible de synchroniser les modeles OpenRouter.",
    );
  }

  const payload = unwrapSuccessEnvelope(response.data);
  if (!isRecord(payload)) {
    throw new Error("Reponse OpenRouter invalide.");
  }

  return {
    imported:
      typeof payload.imported === "number" && Number.isFinite(payload.imported)
        ? payload.imported
        : 0,
    created:
      typeof payload.created === "number" && Number.isFinite(payload.created)
        ? payload.created
        : 0,
    updated:
      typeof payload.updated === "number" && Number.isFinite(payload.updated)
        ? payload.updated
        : 0,
    purged:
      typeof payload.purged === "number" && Number.isFinite(payload.purged)
        ? payload.purged
        : 0,
    models: normalizeCatalog(getField(payload, ["models", "Models"])),
  };
}

export function getCatalogDefaultSelection(
  catalog: ModelCatalogItem[],
  limit = 3,
): string[] {
  return catalog
    .filter((model) => model.isActive)
    .slice(0, Math.max(0, limit))
    .map((model) => model.id);
}
