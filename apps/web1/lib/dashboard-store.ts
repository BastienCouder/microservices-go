import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DateRange } from "react-day-picker";
import type { ExportDataset, ExportFormat } from "@/lib/export-client";

type DashboardSection =
  | "criticalUpdates"
  | "promptsStream"
  | "kpiCards"
  | "visibilityAnalytics"
  | "brandVisibility"
  | "aiSentiment"
  | "topCitedPages"
  | "autoInsights";

type ExportPreset = "essentials" | "executive" | "raw";

interface DashboardState {
  period: string;
  dateRange: DateRange | undefined;
  selectedModels: string[];
  selectedPersonas: string[];
  selectedCompetitors: string[];
  showUniqueModelFilters: boolean;
  applyFiltersToLivePrompts: boolean;
  applyFiltersToGraphs: boolean;
  kpiCardsPeriod: string | null;
  visibilityAnalyticsPeriod: string | null;
  competitorAnalyticsPeriod: string | null;
  sectionFilterScope: Record<DashboardSection, boolean>;
  isLeftPanelOpen: boolean;

  showAdvancedExport: boolean;
  exportFormat: ExportFormat;
  exportUnreadOnly: boolean;
  exportRunsLimit: string;
  selectedExportPreset: ExportPreset;
  exportSelection: Record<ExportDataset, boolean>;

  setPeriod: (period: string) => void;
  setDateRange: (range: DateRange | undefined) => void;
  toggleModel: (model: string) => void;
  toggleLeftPanel: () => void;
  togglePersona: (persona: string) => void;
  toggleCompetitor: (competitor: string) => void;
  setShowUniqueModelFilters: (value: boolean) => void;
  toggleApplyFiltersToLivePrompts: () => void;
  toggleApplyFiltersToGraphs: () => void;
  setKpiCardsPeriod: (period: string | null) => void;
  setVisibilityAnalyticsPeriod: (period: string | null) => void;
  setCompetitorAnalyticsPeriod: (period: string | null) => void;
  toggleSectionFilterScope: (section: DashboardSection) => void;
  resetSectionFilterScope: () => void;
  clearPersonas: () => void;
  clearCompetitors: () => void;
  resetFilters: () => void;

  setShowAdvancedExport: (value: boolean) => void;
  setExportFormat: (format: ExportFormat) => void;
  toggleExportUnreadOnly: () => void;
  setExportRunsLimit: (value: string) => void;
  setSelectedExportPreset: (preset: ExportPreset) => void;
  toggleExportDataset: (dataset: ExportDataset) => void;
  setExportSelection: (selection: Record<ExportDataset, boolean>) => void;
  selectAllExportDatasets: () => void;
  clearExportDatasets: () => void;
}

const DEFAULT_SECTION_FILTER_SCOPE: Record<DashboardSection, boolean> = {
  criticalUpdates: true,
  promptsStream: true,
  kpiCards: true,
  visibilityAnalytics: true,
  brandVisibility: true,
  aiSentiment: true,
  topCitedPages: true,
  autoInsights: true,
};

const DEFAULT_EXPORT_SELECTION: Record<ExportDataset, boolean> = {
  dashboard: false,
  kpis: true,
  visibility: false,
  "prompt-runs": true,
  runs: false,
  alerts: true,
  prompts: false,
  competitors: true,
};

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      period: "7d",
      dateRange: undefined,
      selectedModels: [],
      selectedPersonas: [],
      selectedCompetitors: [],
      showUniqueModelFilters: false,
      applyFiltersToLivePrompts: true,
      applyFiltersToGraphs: true,
      kpiCardsPeriod: null,
      visibilityAnalyticsPeriod: null,
      competitorAnalyticsPeriod: null,
      sectionFilterScope: { ...DEFAULT_SECTION_FILTER_SCOPE },
      isLeftPanelOpen: true,

      showAdvancedExport: false,
      exportFormat: "csv",
      exportUnreadOnly: false,
      exportRunsLimit: "100",
      selectedExportPreset: "essentials",
      exportSelection: { ...DEFAULT_EXPORT_SELECTION },

      setPeriod: (period) => set({ period, dateRange: undefined }),
      setDateRange: (dateRange) => set({ dateRange, period: "custom" }),

      toggleModel: (model) =>
        set((state) => {
          const isSelected = state.selectedModels.includes(model);
          if (isSelected) {
            return { selectedModels: state.selectedModels.filter((m) => m !== model) };
          }
          return { selectedModels: [...state.selectedModels, model] };
        }),

      toggleLeftPanel: () => set((state) => ({ isLeftPanelOpen: !state.isLeftPanelOpen })),

      togglePersona: (persona) =>
        set((state) => {
          const isSelected = state.selectedPersonas.includes(persona);
          return {
            selectedPersonas: isSelected
              ? state.selectedPersonas.filter((p) => p !== persona)
              : [...state.selectedPersonas, persona],
          };
        }),

      toggleCompetitor: (competitor) =>
        set((state) => {
          const isSelected = state.selectedCompetitors.includes(competitor);
          return {
            selectedCompetitors: isSelected
              ? state.selectedCompetitors.filter((c) => c !== competitor)
              : [...state.selectedCompetitors, competitor],
          };
        }),

      setShowUniqueModelFilters: (showUniqueModelFilters) => set({ showUniqueModelFilters }),

      toggleApplyFiltersToLivePrompts: () =>
        set((state) => ({
          applyFiltersToLivePrompts: !state.applyFiltersToLivePrompts,
        })),

      toggleApplyFiltersToGraphs: () =>
        set((state) => ({
          applyFiltersToGraphs: !state.applyFiltersToGraphs,
        })),

      setKpiCardsPeriod: (kpiCardsPeriod) => set({ kpiCardsPeriod }),
      setVisibilityAnalyticsPeriod: (visibilityAnalyticsPeriod) => set({ visibilityAnalyticsPeriod }),
      setCompetitorAnalyticsPeriod: (competitorAnalyticsPeriod) => set({ competitorAnalyticsPeriod }),

      toggleSectionFilterScope: (section) =>
        set((state) => ({
          sectionFilterScope: {
            ...state.sectionFilterScope,
            [section]: !state.sectionFilterScope[section],
          },
        })),

      resetSectionFilterScope: () =>
        set({
          sectionFilterScope: { ...DEFAULT_SECTION_FILTER_SCOPE },
        }),

      clearPersonas: () => set({ selectedPersonas: [] }),
      clearCompetitors: () => set({ selectedCompetitors: [] }),

      resetFilters: () =>
        set({
          period: "7d",
          dateRange: undefined,
          selectedModels: [],
          selectedPersonas: [],
          selectedCompetitors: [],
          showUniqueModelFilters: false,
          applyFiltersToLivePrompts: true,
          applyFiltersToGraphs: true,
          kpiCardsPeriod: null,
          visibilityAnalyticsPeriod: null,
          competitorAnalyticsPeriod: null,
          sectionFilterScope: { ...DEFAULT_SECTION_FILTER_SCOPE },
        }),

      setShowAdvancedExport: (showAdvancedExport) => set({ showAdvancedExport }),
      setExportFormat: (exportFormat) => set({ exportFormat }),
      toggleExportUnreadOnly: () => set((state) => ({ exportUnreadOnly: !state.exportUnreadOnly })),
      setExportRunsLimit: (exportRunsLimit) => set({ exportRunsLimit }),
      setSelectedExportPreset: (selectedExportPreset) => set({ selectedExportPreset }),
      toggleExportDataset: (dataset) =>
        set((state) => ({
          exportSelection: {
            ...state.exportSelection,
            [dataset]: !state.exportSelection[dataset],
          },
        })),
      setExportSelection: (exportSelection) => set({ exportSelection }),
      selectAllExportDatasets: () =>
        set({
          exportSelection: {
            dashboard: true,
            kpis: true,
            visibility: true,
            "prompt-runs": true,
            runs: true,
            alerts: true,
            prompts: true,
            competitors: true,
          },
        }),
      clearExportDatasets: () =>
        set({
          exportSelection: {
            dashboard: false,
            kpis: false,
            visibility: false,
            "prompt-runs": false,
            runs: false,
            alerts: false,
            prompts: false,
            competitors: false,
          },
        }),
    }),
    {
      name: "dashboard-ui-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        period: state.period,
        dateRange: state.dateRange,
        isLeftPanelOpen: state.isLeftPanelOpen,
        selectedModels: state.selectedModels,
        selectedPersonas: state.selectedPersonas,
        selectedCompetitors: state.selectedCompetitors,
        showUniqueModelFilters: state.showUniqueModelFilters,
        applyFiltersToLivePrompts: state.applyFiltersToLivePrompts,
        applyFiltersToGraphs: state.applyFiltersToGraphs,
        kpiCardsPeriod: state.kpiCardsPeriod,
        visibilityAnalyticsPeriod: state.visibilityAnalyticsPeriod,
        competitorAnalyticsPeriod: state.competitorAnalyticsPeriod,
        sectionFilterScope: state.sectionFilterScope,
        showAdvancedExport: state.showAdvancedExport,
        exportFormat: state.exportFormat,
        exportUnreadOnly: state.exportUnreadOnly,
        exportRunsLimit: state.exportRunsLimit,
        selectedExportPreset: state.selectedExportPreset,
        exportSelection: state.exportSelection,
      }),
      merge: (persistedState, currentState) => {
        const typedPersisted = persistedState as Partial<DashboardState>;
        const merged = {
          ...currentState,
          ...typedPersisted,
        } as DashboardState;

        if (typedPersisted.dateRange) {
          const from = typedPersisted.dateRange.from
            ? new Date(typedPersisted.dateRange.from)
            : undefined;
          const to = typedPersisted.dateRange.to
            ? new Date(typedPersisted.dateRange.to)
            : undefined;
          merged.dateRange = { from, to };
        }

        return merged;
      },
    },
  ),
);
