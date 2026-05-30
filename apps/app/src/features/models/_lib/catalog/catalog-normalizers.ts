import {
  buildModelDescription,
  normalizeModelPayload,
} from "@/lib/project-models";
import { attachStableSlugs } from "@/shared/public-slugs";

import type {
  CatalogModelUpdatePayload,
  ModelCatalogItem,
  ModelsProjectSummary,
} from "../model-access";
import {
  getBool,
  getField,
  getIDString,
  getString,
  isRecord,
  normalizeProviderId,
  sortCatalogItemsByProvider,
  unwrapSuccessEnvelope,
} from "./catalog-utils";

export type ModelCatalogAdminFilters = {
  provider?: string;
  search?: string;
  status?: "all" | "active" | "inactive";
  supportsLiveSearch?: boolean;
  freeOnly?: boolean;
};

export function normalizeProjects(value: unknown): ModelsProjectSummary[] {
  const payload = unwrapSuccessEnvelope(value);
  if (!Array.isArray(payload)) return [];

  return attachStableSlugs(
    payload
      .filter((entry): entry is Record<string, unknown> => isRecord(entry))
      .map((entry) => ({
        id: getIDString(getField(entry, ["id", "ID"])),
        name: getString(getField(entry, ["name", "Name"])) || "Projet",
        brandName: getString(getField(entry, ["brandName", "BrandName"])),
        status: getString(getField(entry, ["status", "Status"])),
      }))
      .filter((project) => project.id !== ""),
    "project",
  );
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
    creditCost: model.creditCost,
    inputPricePerMillion: model.inputPricePerMillion,
    outputPricePerMillion: model.outputPricePerMillion,
    openRouterPricing: model.openRouterPricing,
  };
}

export function normalizeCatalogMutationItem(
  value: unknown,
): ModelCatalogItem | null {
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

export function filterModelCatalogForAdmin(
  catalog: ModelCatalogItem[],
  filters: ModelCatalogAdminFilters,
): ModelCatalogItem[] {
  const provider = normalizeProviderId(filters.provider ?? "");
  const search = filters.search?.trim().toLowerCase() ?? "";
  const status = filters.status ?? "all";
  const freeOnly = filters.freeOnly === true;

  return sortCatalogItemsByProvider(
    catalog.filter((model) => {
      if (status === "active" && !model.isActive) return false;
      if (status === "inactive" && model.isActive) return false;
      if (provider && normalizeProviderId(model.provider) !== provider) {
        return false;
      }
      if (filters.supportsLiveSearch === true && !model.supportsLiveSearch) {
        return false;
      }
      if (freeOnly && !looksLikeFreeModel(model)) {
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

function looksLikeFreeModel(model: ModelCatalogItem): boolean {
  const haystack = [
    model.id,
    model.name,
    model.providerModelId,
    model.description,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(":free") || haystack.includes("(free)");
}

export type { CatalogModelUpdatePayload };
