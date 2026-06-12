import { useCallback, useMemo, useState } from "react";

import { useMonitoringData } from "../shared/use-monitoring-data";
import { exportMonitoringWorkbook } from "../shared/monitoring-export";
import { filterPromptsByScope } from "../shared/prompt-filters";
import { useClientExportAccess } from "@/shared/export-entitlements";
import { buildSelectedProjectModelFilterIds } from "@/lib/project-models";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

import { buildFilterHeroInsight, type FilterHeroInsight } from "./filter-hero-insight";
import {
  buildPersonaOptions,
  buildProjectWithDynamicCompetitors,
  buildVisibleModelFilterItems,
} from "./filter-helpers";
import type { FilterModelCard } from "./types";
import {
  hasActiveMonitoringFilters,
  useMonitoringFilterActions,
  useMonitoringFilters,
} from "../shared/use-monitoring-filters";
import type { MonitoringPrompt } from "../shared/monitoring-data";

function getPromptSortValue(prompt: MonitoringPrompt): number {
  if (prompt.createdAt) {
    const createdAt = new Date(prompt.createdAt);
    if (!Number.isNaN(createdAt.getTime())) {
      return createdAt.getTime();
    }
  }

  const normalizedTime = prompt.time.trim().toLowerCase();
  const match = normalizedTime.match(/^(\d+)\s*(m|h|d)$/);
  if (!match) {
    return 0;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier =
    unit === "m" ? 60 * 1000 : unit === "h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  return Date.now() - amount * multiplier;
}

type FiltersPanelViewModel = {
  loading: boolean;
  project: ReturnType<typeof buildProjectWithDynamicCompetitors>;
  period: string;
  setPeriod: (value: string) => void;
  dateRange: ReturnType<typeof useMonitoringFilters>["dateRange"];
  setDateRange: (value: ReturnType<typeof useMonitoringFilters>["dateRange"]) => void;
  personaOptions: ReturnType<typeof buildPersonaOptions>;
  selectedPersonas: string[];
  togglePersona: (id: string) => void;
  clearPersonas: () => void;
  models: FilterModelCard[];
  selectedModels: string[];
  toggleModel: (id: string) => void;
  clearModels: () => void;
  selectedCompetitors: string[];
  toggleCompetitor: (name: string) => void;
  clearCompetitors: () => void;
  showAllModels: boolean;
  setShowAllModels: (value: boolean) => void;
  showAllPersonas: boolean;
  setShowAllPersonas: (value: boolean) => void;
  showAllCompetitors: boolean;
  setShowAllCompetitors: (value: boolean) => void;
  onResetFilters: () => void;
  showResetFilters: boolean;
  showUniqueModelFilters: boolean;
  onModelFilterModeChange: (value: boolean) => void;
  heroInsight: FilterHeroInsight;
  canExport: boolean;
  exportDisabled: boolean;
  handleExportMonitoringData: () => void;
};

export function useFiltersPanelViewModel(): FiltersPanelViewModel {
  const { locale } = useScopedI18n("monitoring-filters-panel");
  const { data: monitoringData, loading } = useMonitoringData();
  const filters = useMonitoringFilters();
  const actions = useMonitoringFilterActions();
  const exportAccess = useClientExportAccess();
  const { project, models, recent_prompts } = monitoringData;
  const [showAllModels, setShowAllModels] = useState(false);
  const [showAllPersonas, setShowAllPersonas] = useState(false);
  const [showAllCompetitors, setShowAllCompetitors] = useState(false);

  const personaOptions = useMemo(
    () => buildPersonaOptions(project.personas, recent_prompts),
    [project.personas, recent_prompts],
  );
  const visibleModelFilterItems = useMemo(
    () =>
      buildVisibleModelFilterItems(models, filters.showUniqueModelFilters),
    [filters.showUniqueModelFilters, models],
  );
  const selectedModelFilterIds = useMemo(
    () =>
      buildSelectedProjectModelFilterIds(
        filters.selectedModels,
        visibleModelFilterItems,
        filters.showUniqueModelFilters,
      ),
    [
      filters.selectedModels,
      filters.showUniqueModelFilters,
      visibleModelFilterItems,
    ],
  );
  const projectWithDynamicCompetitors = useMemo(
    () =>
      buildProjectWithDynamicCompetitors(project, recent_prompts, {
        selectedModels: filters.selectedModels,
        selectedPersonas: filters.selectedPersonas,
        period: filters.period,
        dateRange: filters.dateRange,
      }),
    [
      filters.dateRange,
      filters.period,
      filters.selectedModels,
      filters.selectedPersonas,
      project,
      recent_prompts,
    ],
  );
  const heroInsight = useMemo(
    () =>
      buildFilterHeroInsight({
        project: projectWithDynamicCompetitors,
        prompts: recent_prompts,
        filters,
        locale,
      }),
    [filters, locale, projectWithDynamicCompetitors, recent_prompts],
  );
  const filteredPrompts = useMemo(
    () =>
      [...filterPromptsByScope(recent_prompts, filters)].sort(
        (left, right) => getPromptSortValue(right) - getPromptSortValue(left),
      ),
    [filters, recent_prompts],
  );

  const toggleModelFilter = useCallback(
    (filterId: string) => {
      const item = visibleModelFilterItems.find((model) => model.id === filterId);
      if (!item) return;

      const allSelected = item.memberIds.every((id) =>
        filters.selectedModels.includes(id),
      );

      if (allSelected) {
        item.memberIds
          .filter((id) => filters.selectedModels.includes(id))
          .forEach((id) => actions.toggleModel(id));
        return;
      }

      item.memberIds
        .filter((id) => !filters.selectedModels.includes(id))
        .forEach((id) => actions.toggleModel(id));
    },
    [actions, filters.selectedModels, visibleModelFilterItems],
  );

  const clearModels = useCallback(() => {
    filters.selectedModels.forEach((id) => actions.toggleModel(id));
  }, [actions, filters.selectedModels]);
  const handleExportMonitoringData = useCallback(() => {
    exportMonitoringWorkbook({
      data: monitoringData,
      filteredPrompts,
      filters,
    });
  }, [filteredPrompts, filters, monitoringData]);

  return {
    loading,
    project: projectWithDynamicCompetitors,
    period: filters.period,
    setPeriod: actions.setPeriod,
    dateRange: filters.dateRange,
    setDateRange: actions.setDateRange,
    personaOptions,
    selectedPersonas: filters.selectedPersonas,
    togglePersona: actions.togglePersona,
    clearPersonas: actions.clearPersonas,
    models: visibleModelFilterItems.map((model) => ({
      id: model.id,
      name: filters.showUniqueModelFilters ? model.displayName : "",
      description: model.description,
      icon: model.iconPath,
      live: model.live,
      modelGroup: model.groupName,
    })),
    selectedModels: selectedModelFilterIds,
    toggleModel: toggleModelFilter,
    clearModels,
    selectedCompetitors: filters.selectedCompetitors,
    toggleCompetitor: actions.toggleCompetitor,
    clearCompetitors: actions.clearCompetitors,
    showAllModels,
    setShowAllModels,
    showAllPersonas,
    setShowAllPersonas,
    showAllCompetitors,
    setShowAllCompetitors,
    onResetFilters: actions.resetFilters,
    showResetFilters: hasActiveMonitoringFilters(filters),
    showUniqueModelFilters: filters.showUniqueModelFilters,
    onModelFilterModeChange: actions.setShowUniqueModelFilters,
    heroInsight,
    canExport: exportAccess.canExport,
    exportDisabled: filteredPrompts.length === 0,
    handleExportMonitoringData,
  };
}
