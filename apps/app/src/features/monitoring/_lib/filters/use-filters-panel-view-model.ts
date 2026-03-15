import { useCallback, useMemo, useState } from "react";

import { useMonitoringData } from "@/hooks/use-monitoring-data";

import {
  buildModelCards,
  buildPersonaOptions,
  buildProjectWithDynamicCompetitors,
  buildSelectedModelFilterIds,
  buildVisibleModelFilterItems,
} from "./filter-helpers";
import { useMonitoringFilterActions, useMonitoringFilters, hasActiveMonitoringFilters } from "../shared/use-monitoring-filters";

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
  models: ReturnType<typeof buildModelCards>;
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
};

export function useFiltersPanelViewModel(): FiltersPanelViewModel {
  const { data: monitoringData, loading } = useMonitoringData();
  const filters = useMonitoringFilters();
  const actions = useMonitoringFilterActions();
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
      buildSelectedModelFilterIds(
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
    models: buildModelCards(visibleModelFilterItems, filters.showUniqueModelFilters),
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
  };
}
