import type { DateRange } from "react-day-picker";
import { shallow } from "zustand/shallow";

import { useMonitoringStore } from "@/lib/monitoring-store";

export type MonitoringFiltersSnapshot = {
  period: string;
  dateRange: DateRange | undefined;
  selectedModels: string[];
  showUniqueModelFilters: boolean;
  selectedPersonas: string[];
  selectedCompetitors: string[];
};

export type MonitoringFilterActions = {
  setPeriod: (period: string) => void;
  setDateRange: (value: DateRange | undefined) => void;
  setShowUniqueModelFilters: (value: boolean) => void;
  toggleModel: (id: string) => void;
  togglePersona: (persona: string) => void;
  clearPersonas: () => void;
  toggleCompetitor: (competitor: string) => void;
  clearCompetitors: () => void;
  resetFilters: () => void;
};

const selectMonitoringFilters = (state: {
  period: string;
  dateRange: DateRange | undefined;
  selectedModels: string[];
  showUniqueModelFilters: boolean;
  selectedPersonas: string[];
  selectedCompetitors: string[];
}): MonitoringFiltersSnapshot => ({
  period: state.period,
  dateRange: state.dateRange,
  selectedModels: state.selectedModels,
  showUniqueModelFilters: state.showUniqueModelFilters,
  selectedPersonas: state.selectedPersonas,
  selectedCompetitors: state.selectedCompetitors,
});

const selectMonitoringActions = (state: MonitoringFilterActions): MonitoringFilterActions => ({
  setPeriod: state.setPeriod,
  setDateRange: state.setDateRange,
  setShowUniqueModelFilters: state.setShowUniqueModelFilters,
  toggleModel: state.toggleModel,
  togglePersona: state.togglePersona,
  clearPersonas: state.clearPersonas,
  toggleCompetitor: state.toggleCompetitor,
  clearCompetitors: state.clearCompetitors,
  resetFilters: state.resetFilters,
});

export function useMonitoringFilters(): MonitoringFiltersSnapshot {
  return useMonitoringStore(selectMonitoringFilters, shallow);
}

export function useMonitoringFilterActions(): MonitoringFilterActions {
  return useMonitoringStore(selectMonitoringActions, shallow);
}

export function getActiveMonitoringFilterCount(filters: MonitoringFiltersSnapshot): number {
  let count =
    filters.selectedModels.length +
    filters.selectedCompetitors.length;

  if (filters.period !== "7d" || filters.dateRange !== undefined) {
    count += 1;
  }

  if (filters.showUniqueModelFilters) {
    count += 1;
  }

  return count;
}

export function hasActiveMonitoringFilters(filters: MonitoringFiltersSnapshot): boolean {
  return getActiveMonitoringFilterCount(filters) > 0;
}
