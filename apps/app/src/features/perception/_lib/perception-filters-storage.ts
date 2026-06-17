import type {
  PerceptionSourceFilter,
  PerceptionTrendPeriodKey,
} from "./shared/perception-data";

export const PERCEPTION_FILTERS_STORAGE_KEY = "perception-filters:v1";

export type PersistedPerceptionFilters = {
  selectedModels: string[];
  selectedSourceFilter: PerceptionSourceFilter;
  selectedPeriod: PerceptionTrendPeriodKey;
  showUniqueModelFilters: boolean;
};

export function getDefaultPerceptionFilters(): PersistedPerceptionFilters {
  return {
    selectedModels: [],
    selectedSourceFilter: "perception",
    selectedPeriod: "all",
    showUniqueModelFilters: false,
  };
}

function isPerceptionSourceFilter(value: unknown): value is PerceptionSourceFilter {
  return value === "perception" || value === "monitoring" || value === "all";
}

function isPerceptionTrendPeriodKey(value: unknown): value is PerceptionTrendPeriodKey {
  return (
    value === "all" ||
    value === "7d" ||
    value === "30d" ||
    value === "90d" ||
    value === "last-run"
  );
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function readPersistedPerceptionFilters(
  availableModelIds: readonly string[] = [],
): Partial<PersistedPerceptionFilters> {
  const defaultFilters = getDefaultPerceptionFilters();

  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(PERCEPTION_FILTERS_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue) as Record<string, unknown>;
    const allowedModelIds = new Set(availableModelIds);
    const selectedModels = toStringArray(parsed.selectedModels).filter(
      (modelId) =>
        allowedModelIds.size === 0 || allowedModelIds.has(modelId),
    );

    return {
      selectedModels,
      selectedSourceFilter: isPerceptionSourceFilter(parsed.selectedSourceFilter)
        ? parsed.selectedSourceFilter
        : defaultFilters.selectedSourceFilter,
      selectedPeriod: isPerceptionTrendPeriodKey(parsed.selectedPeriod)
        ? parsed.selectedPeriod
        : defaultFilters.selectedPeriod,
      showUniqueModelFilters:
        typeof parsed.showUniqueModelFilters === "boolean"
          ? parsed.showUniqueModelFilters
          : defaultFilters.showUniqueModelFilters,
    };
  } catch {
    return {};
  }
}

export function writePersistedPerceptionFilters(
  state: PersistedPerceptionFilters,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    PERCEPTION_FILTERS_STORAGE_KEY,
    JSON.stringify(state),
  );
}
