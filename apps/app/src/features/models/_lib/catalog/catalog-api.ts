import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON } from "@/shared/api/gateway";

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
    throw new Error("Impossible de charger les projets pour cette organisation.");
  }

  return { projects: normalizeProjects(projectsResponse.data), catalog };
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
    { method: "GET", organizationId, signal },
  );

  if (!response.ok) throw new Error("Impossible de charger les cles API LLM.");
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
    { method: "PUT", organizationId, body: JSON.stringify({ apiKey }) },
  );

  if (!response.ok) {
    throw new Error(response.error || "Impossible d'enregistrer la cle API LLM.");
  }

  const [credential] = normalizeLLMProviderCredentials(response.data);
  if (!credential) throw new Error("Reponse de cle API LLM invalide.");
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

  if (!response.ok) {
    throw new Error(response.error || "Impossible de supprimer la cle API LLM.");
  }

  const [credential] = normalizeLLMProviderCredentials(response.data);
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

  if (!response.ok) throw new Error("Impossible de creer le modele.");

  const model = normalizeCatalogMutationItem(response.data);
  if (!model) throw new Error("Reponse catalogue invalide.");
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

  if (!response.ok) {
    throw new Error(response.error || "Impossible de mettre a jour le modele.");
  }

  const model = normalizeCatalogMutationItem(response.data);
  if (!model) throw new Error("Reponse catalogue invalide.");
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

  if (!response.ok) {
    throw new Error(
      response.error || "Impossible de synchroniser les modeles OpenRouter.",
    );
  }

  const payload = unwrapSuccessEnvelope(response.data);
  if (!isRecord(payload)) throw new Error("Reponse OpenRouter invalide.");

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
