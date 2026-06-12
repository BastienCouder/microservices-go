import { resolveAIIconPath } from "@/lib/ai-provider-assets";
import i18n from "@/shared/i18n";
import { translateI18nText } from "@/shared/hooks/use-i18n";

export type ProjectModelMeta = {
  id: string;
  displayName: string;
  provider: string;
  groupName: string;
  providerModelId: string;
  description: string;
  iconPath: string;
  live: boolean;
  creditCost: number;
};

export type ProjectModelVisual = {
  icon: string;
  description: string;
  label: string;
  provider: string;
  name: string;
};

export type ProjectModelFilterItem = {
  id: string;
  displayName: string;
  groupName: string;
  description: string;
  iconPath: string;
  live: boolean;
  memberIds: string[];
};

export type NormalizedModelPayload = {
  id: string;
  displayName: string;
  provider: string;
  groupName: string;
  providerModelId: string;
  description: string;
  iconPath: string;
  iconKey: string;
  isActive: boolean;
  isEnabledForProject: boolean;
  supportsLiveSearch: boolean;
  creditCost: number;
  inputPricePerMillion: number | null;
  outputPricePerMillion: number | null;
  openRouterPricing: Record<string, unknown> | null;
};

type JsonRecord = Record<string, unknown>;

const MODEL_FILTER_LABEL_COLLATOR = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function getField<T = unknown>(obj: JsonRecord, keys: string[]): T | undefined {
  for (const key of keys) {
    if (key in obj) return obj[key] as T;
  }
  return undefined;
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getBool(value: unknown): boolean {
  return value === true;
}

function getNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = getNumber(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function getIDString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function buildProviderLabel(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return translateI18nText("shared-ui", "aiProvider", i18n.language);
  }
  if (normalized.toLowerCase() === "xai" || normalized.toLowerCase() === "grok") {
    return "xAI";
  }
  return normalized
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildModelDescription(input: {
  provider: string;
  providerModelId: string;
  supportsLiveSearch: boolean;
}): string {
  if (input.supportsLiveSearch) {
    return `${input.provider} · recherche web`;
  }
  return (
    input.providerModelId ||
    input.provider ||
    translateI18nText("shared-ui", "aiModel", i18n.language)
  );
}

export function resolveProjectModelIconPath(
  model: Pick<
    ProjectModelMeta,
    "iconPath" | "provider" | "groupName" | "displayName" | "providerModelId" | "id"
  >,
): string {
  return resolveAIIconPath(
    model.iconPath,
    model.providerModelId,
    model.displayName,
    model.groupName,
    model.provider,
    model.id,
  );
}

export function normalizeModelPayload(value: unknown): NormalizedModelPayload | null {
  if (!isRecord(value)) return null;

  const id = getIDString(getField(value, ["id", "ID"]));
  if (!id) return null;

  const displayName =
    getString(getField(value, ["displayName", "DisplayName"])) || id;
  const groupName =
    getString(getField(value, ["groupName", "GroupName"])) || displayName;
  const provider = getString(getField(value, ["provider", "Provider"]));
  const providerModelId = getString(
    getField(value, ["providerModelId", "ProviderModelId"]),
  );
  const supportsLiveSearch = getBool(
    getField(value, ["supportsLiveSearch", "SupportsLiveSearch"]),
  );

  return {
    id,
    displayName,
    provider,
    groupName,
    providerModelId,
    description:
      getString(getField(value, ["description", "Description"])) ||
      buildModelDescription({
        provider,
        providerModelId,
        supportsLiveSearch,
      }),
    iconPath: resolveAIIconPath(
      getString(getField(value, ["iconPath", "IconPath"])),
      providerModelId,
      displayName,
      groupName,
      provider,
      id,
    ),
    iconKey: getString(getField(value, ["iconKey", "IconKey"])),
    isActive: getBool(getField(value, ["isActive", "IsActive"])),
    isEnabledForProject: getBool(
      getField(value, ["isEnabledForProject", "IsEnabledForProject"]),
    ),
    supportsLiveSearch,
    creditCost: Math.max(
      1,
      Math.floor(getNumber(getField(value, ["creditCost", "CreditCost"]))),
    ),
    inputPricePerMillion: getNullableNumber(
      getField(value, ["inputPricePerMillion", "InputPricePerMillion"]),
    ),
    outputPricePerMillion: getNullableNumber(
      getField(value, ["outputPricePerMillion", "OutputPricePerMillion"]),
    ),
    openRouterPricing: getRecord(
      getField(value, ["openRouterPricing", "OpenRouterPricing"]),
    ),
  };
}

export function normalizeModelPayloadList(value: unknown): NormalizedModelPayload[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => normalizeModelPayload(entry))
    .filter((entry): entry is NormalizedModelPayload => entry !== null);
}

export function toProjectModelMeta(
  value: NormalizedModelPayload,
  options?: {
    live?: boolean;
    description?: string;
  },
): ProjectModelMeta {
  return {
    id: value.id,
    displayName: value.displayName,
    provider: value.provider,
    groupName: value.groupName || value.displayName || value.id,
    providerModelId: value.providerModelId,
    description: options?.description ?? value.description,
    iconPath: value.iconPath,
    live: options?.live ?? value.isEnabledForProject,
    creditCost: value.creditCost,
  };
}

export function getProjectModelLookupKeys(
  model: Pick<ProjectModelMeta, "id" | "displayName" | "groupName" | "providerModelId">,
): string[] {
  return [
    model.id,
    model.providerModelId,
    model.displayName,
    model.groupName,
  ]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function buildProjectModelLookup<T extends Pick<ProjectModelMeta, "id" | "displayName" | "groupName" | "providerModelId">>(
  models: T[],
): Map<string, T> {
  const lookup = new Map<string, T>();

  for (const model of models) {
    for (const key of getProjectModelLookupKeys(model)) {
      lookup.set(key, model);
    }
  }

  return lookup;
}

export function toProjectModelVisual(
  model: Pick<ProjectModelMeta, "iconPath" | "description" | "groupName" | "displayName" | "providerModelId" | "provider" | "id">,
): ProjectModelVisual {
  return {
    icon: resolveProjectModelIconPath(model),
    description: model.description || model.displayName || model.providerModelId,
    label: model.groupName || model.displayName || model.providerModelId || model.id,
    provider: buildProviderLabel(model.provider),
    name: model.displayName || model.providerModelId || model.id,
  };
}

export function buildProjectModelFilterItems(
  models: ProjectModelMeta[],
  showUniqueModelFilters: boolean,
): ProjectModelFilterItem[] {
  const filteredModels = models
    .map((model) => ({
      ...model,
      description: model.description ?? "",
    }))
    .filter((model) => model.live);

  if (showUniqueModelFilters) {
    return filteredModels
      .map((model) => ({
        id: model.id,
        displayName: model.displayName,
        groupName: model.groupName || model.displayName || model.id,
        description: model.description,
        iconPath: resolveProjectModelIconPath(model),
        live: model.live,
        memberIds: [model.id],
      }))
      .sort((left, right) =>
        compareProjectModelFilterItems(left, right, (item) => item.groupName, [
          (item) => item.displayName,
        ]),
      );
  }

  const groups = new Map<string, ProjectModelFilterItem>();

  for (const model of filteredModels) {
    const groupKey = (model.groupName || model.displayName || model.id).trim();
    const current = groups.get(groupKey);

    if (!current) {
      groups.set(groupKey, {
        id: groupKey,
        displayName: model.displayName,
        groupName: groupKey,
        description: "",
        iconPath: resolveProjectModelIconPath(model),
        live: true,
        memberIds: [model.id],
      });
      continue;
    }

    current.memberIds.push(model.id);
  }

  return Array.from(groups.values()).sort((left, right) =>
    compareProjectModelFilterItems(left, right, (item) => item.groupName),
  );
}

function compareProjectModelFilterItems(
  left: ProjectModelFilterItem,
  right: ProjectModelFilterItem,
  getLabel: (item: ProjectModelFilterItem) => string,
  fallbackLabels: Array<(item: ProjectModelFilterItem) => string> = [],
): number {
  const leftLabel = getLabel(left) || left.displayName || left.groupName || left.id;
  const rightLabel = getLabel(right) || right.displayName || right.groupName || right.id;

  const compareByLabel = MODEL_FILTER_LABEL_COLLATOR.compare(
    leftLabel.trim(),
    rightLabel.trim(),
  );
  if (compareByLabel !== 0) return compareByLabel;

  for (const getFallbackLabel of fallbackLabels) {
    const compareByFallbackLabel = MODEL_FILTER_LABEL_COLLATOR.compare(
      getFallbackLabel(left).trim(),
      getFallbackLabel(right).trim(),
    );
    if (compareByFallbackLabel !== 0) return compareByFallbackLabel;
  }

  return MODEL_FILTER_LABEL_COLLATOR.compare(left.id, right.id);
}

export function buildSelectedProjectModelFilterIds(
  selectedModels: string[],
  visibleModelFilterItems: ProjectModelFilterItem[],
  showUniqueModelFilters: boolean,
): string[] {
  if (showUniqueModelFilters) {
    return selectedModels;
  }

  return visibleModelFilterItems
    .filter((item) => item.memberIds.every((id) => selectedModels.includes(id)))
    .map((item) => item.id);
}
