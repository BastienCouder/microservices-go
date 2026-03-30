import { apiRoutes } from "@/lib/api-config";
import {
  buildModelDescription,
  normalizeModelPayload,
} from "@/lib/project-models";
import { gatewayJSON } from "@/shared/api/gateway";
import type {
  CatalogModelPayload,
  CatalogModelUpdatePayload,
  ModelCatalogItem,
  ModelsProjectSummary,
} from "./model-access";

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

function getIDString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

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

  const model = normalizeCatalogItem(response.data);
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
    throw new Error("Impossible de mettre a jour le modele.");
  }

  const model = normalizeCatalogItem(response.data);
  if (!model) {
    throw new Error("Reponse catalogue invalide.");
  }
  return model;
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
