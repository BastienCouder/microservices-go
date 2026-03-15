import { useCallback, useMemo, useState } from "react";

import { useMonitoringData } from "@/hooks/use-monitoring-data";
import { filterMonitoringAlerts, type MonitoringData, type MonitoringPrompt } from "@/lib/monitoring-data";

import { filterPromptsByScope } from "../shared/prompt-filters";
import { useMonitoringFilters } from "../shared/use-monitoring-filters";

type MonitoringAlert = MonitoringData["alerts"][number];

type ActivityPanelViewModel = {
  loading: boolean;
  filteredAlerts: MonitoringAlert[];
  filteredPrompts: MonitoringPrompt[];
  selectedAlert: MonitoringAlert | null;
  selectedPrompt: MonitoringPrompt | null;
  selectAlert: (alert: MonitoringAlert) => void;
  closeAlert: () => void;
  selectPrompt: (prompt: MonitoringPrompt) => void;
  closePrompt: () => void;
};

export function useActivityPanelViewModel(): ActivityPanelViewModel {
  const filters = useMonitoringFilters();
  const { data: monitoringData, loading } = useMonitoringData();
  const { alerts, recent_prompts } = monitoringData;
  const [selectedPrompt, setSelectedPrompt] = useState<MonitoringPrompt | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<MonitoringAlert | null>(null);

  const filteredPrompts = useMemo(
    () => filterPromptsByScope(recent_prompts, filters),
    [filters, recent_prompts],
  );
  const filteredAlerts = useMemo(
    () =>
      filterMonitoringAlerts(alerts, {
        period: filters.period,
        dateRange: filters.dateRange,
        selectedModels: filters.selectedModels,
        selectedPersonas: filters.selectedPersonas,
        selectedCompetitors: filters.selectedCompetitors,
      }),
    [
      alerts,
      filters.dateRange,
      filters.period,
      filters.selectedCompetitors,
      filters.selectedModels,
      filters.selectedPersonas,
    ],
  );

  const selectAlert = useCallback((alert: MonitoringAlert) => setSelectedAlert(alert), []);
  const closeAlert = useCallback(() => setSelectedAlert(null), []);
  const selectPrompt = useCallback((prompt: MonitoringPrompt) => setSelectedPrompt(prompt), []);
  const closePrompt = useCallback(() => setSelectedPrompt(null), []);

  return {
    loading,
    filteredAlerts,
    filteredPrompts,
    selectedAlert,
    selectedPrompt,
    selectAlert,
    closeAlert,
    selectPrompt,
    closePrompt,
  };
}
