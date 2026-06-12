import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON, requireGatewayResult } from "@/shared/api/gateway";
import { translateI18nText } from "@/shared/hooks/use-i18n";
import i18n from "@/shared/i18n";

import type {
  CatalogModelPayload,
  CatalogModelUpdatePayload,
  LLMProviderCredentialStatus,
  ModelCatalogItem,
  OpenRouterModelSyncInput,
  OpenRouterModelSyncResult,
  ModelsProjectSummary,
} from "../model-access";
import {
  normalizeCatalog,
  normalizeCatalogMutationItem,
  normalizeProjects,
  normalizeSelectedModelIds,
} from "./catalog-normalizers";
import { getField, isRecord, unwrapSuccessEnvelope } from "./catalog-utils";
import {
  buildProviderLabel,
  normalizeLLMProviderCredentials,
} from "./provider-credentials";
import { normalizeProviderId } from "./catalog-utils";

function currentLocale(): string {
  return i18n.resolvedLanguage || i18n.language || "fr";
}

export async function loadModelCatalog(
  apiBaseURL: string,
  organizationId: string,
  options?: { activeOnly?: boolean; signal?: AbortSignal },
): Promise<ModelCatalogItem[]> {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.aiModels.list(options?.activeOnly ?? true),
    { method: "GET", organizationId, signal: options?.signal },
  );

  return normalizeCatalog(
    requireGatewayResult(
      response,
      translateI18nText("models", "loadModelCatalogError", currentLocale()),
    ),
  );
}

export async function loadOnboardingModelCatalog(
  apiBaseURL: string,
  options?: { activeOnly?: boolean; signal?: AbortSignal },
): Promise<ModelCatalogItem[]> {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.aiModels.onboardingList(options?.activeOnly ?? true),
    { method: "GET", signal: options?.signal },
  );

  return normalizeCatalog(
    requireGatewayResult(
      response,
      translateI18nText("models", "loadModelCatalogError", currentLocale()),
    ),
  );
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

  return {
    projects: normalizeProjects(
      requireGatewayResult(
        projectsResponse,
        translateI18nText("models", "loadProjectsError", currentLocale()),
      ),
    ),
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
    { method: "GET", organizationId, signal },
  );

  return normalizeSelectedModelIds(
    requireGatewayResult(
      response,
      translateI18nText("models", "loadProjectModelsError", currentLocale()),
    ),
  );
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
    { method: "GET", organizationId, signal },
  );

  return normalizeLLMProviderCredentials(
    requireGatewayResult(
      response,
      translateI18nText("models", "loadProviderCredentialsError", currentLocale()),
    ),
  );
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
    { method: "PUT", organizationId, body: JSON.stringify({ apiKey }) },
  );

  const [credential] = normalizeLLMProviderCredentials(
    requireGatewayResult(
      response,
      translateI18nText("models", "saveProviderCredentialError", currentLocale()),
    ),
  );
  if (!credential) {
    throw new Error(
      translateI18nText("models", "invalidProviderCredentialResponse", currentLocale()),
    );
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
    { method: "DELETE", organizationId },
  );

  const [credential] = normalizeLLMProviderCredentials(
    requireGatewayResult(
      response,
      translateI18nText("models", "deleteProviderCredentialError", currentLocale()),
    ),
  );
  return (
    credential ?? {
      provider: normalizeProviderId(provider),
      label: buildProviderLabel(provider),
      hasApiKey: false,
      updatedAt: "",
    }
  );
}

export async function createCatalogModel(
  apiBaseURL: string,
  organizationId: string,
  payload: CatalogModelPayload,
): Promise<ModelCatalogItem> {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.aiModels.create(),
    { method: "POST", organizationId, body: JSON.stringify(payload) },
  );

  const model = normalizeCatalogMutationItem(
    requireGatewayResult(
      response,
      translateI18nText("models", "createModelError", currentLocale()),
    ),
  );
  if (!model) {
    throw new Error(
      translateI18nText("models", "invalidCatalogResponse", currentLocale()),
    );
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
    { method: "PATCH", organizationId, body: JSON.stringify(payload) },
  );

  const model = normalizeCatalogMutationItem(
    requireGatewayResult(
      response,
      translateI18nText("models", "updateModelError", currentLocale()),
    ),
  );
  if (!model) {
    throw new Error(
      translateI18nText("models", "invalidCatalogResponse", currentLocale()),
    );
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
    { method: "POST", organizationId, body: JSON.stringify(input) },
  );

  const data = requireGatewayResult(
    response,
    translateI18nText("models", "syncOpenRouterModelsError", currentLocale()),
  );

  const payload = unwrapSuccessEnvelope(data);
  if (!isRecord(payload)) {
    throw new Error(
      translateI18nText("models", "invalidOpenRouterResponse", currentLocale()),
    );
  }

  return {
    imported: Number.isFinite(payload.imported) ? Number(payload.imported) : 0,
    created: Number.isFinite(payload.created) ? Number(payload.created) : 0,
    updated: Number.isFinite(payload.updated) ? Number(payload.updated) : 0,
    purged: Number.isFinite(payload.purged) ? Number(payload.purged) : 0,
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
