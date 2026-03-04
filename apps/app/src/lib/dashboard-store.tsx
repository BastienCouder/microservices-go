import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { DateRange } from "react-day-picker";

import type { ExportDataset, ExportFormat } from "@/lib/export-client";

type SectionFilterScope = {
  criticalUpdates: boolean;
  promptsStream: boolean;
  kpiCards: boolean;
  visibilityAnalytics: boolean;
  brandVisibility: boolean;
  aiSentiment: boolean;
  topCitedPages: boolean;
  autoInsights: boolean;
};

type DashboardStoreState = {
  period: string;
  setPeriod: (period: string) => void;
  dateRange: DateRange | undefined;
  setDateRange: (value: DateRange | undefined) => void;

  selectedModels: string[];
  showUniqueModelFilters: boolean;
  setShowUniqueModelFilters: (value: boolean) => void;
  toggleModel: (id: string) => void;

  selectedPersonas: string[];
  togglePersona: (persona: string) => void;
  clearPersonas: () => void;

  selectedCompetitors: string[];
  toggleCompetitor: (competitor: string) => void;
  clearCompetitors: () => void;

  applyFiltersToGraphs: boolean;
  applyFiltersToLivePrompts: boolean;

  kpiCardsPeriod: string | null;
  setKpiCardsPeriod: (value: string | null) => void;
  visibilityAnalyticsPeriod: string | null;
  setVisibilityAnalyticsPeriod: (value: string | null) => void;
  competitorAnalyticsPeriod: string | null;
  setCompetitorAnalyticsPeriod: (value: string | null) => void;

  sectionFilterScope: SectionFilterScope;
  toggleSectionFilterScope: (key: keyof SectionFilterScope) => void;
  resetSectionFilterScope: () => void;

  isFiltersPanelOpen: boolean;
  toggleFiltersPanel: () => void;

  showAdvancedExport: boolean;
  setShowAdvancedExport: (value: boolean) => void;
  exportFormat: ExportFormat;
  setExportFormat: (value: ExportFormat) => void;
  exportUnreadOnly: boolean;
  toggleExportUnreadOnly: () => void;
  exportRunsLimit: string;
  setExportRunsLimit: (value: string) => void;
  selectedExportPreset: "essentials" | "executive" | "raw";
  setSelectedExportPreset: (value: "essentials" | "executive" | "raw") => void;
  exportSelection: Record<ExportDataset, boolean>;
  toggleExportDataset: (dataset: ExportDataset) => void;
  setExportSelection: (value: Record<ExportDataset, boolean>) => void;
  selectAllExportDatasets: () => void;
  clearExportDatasets: () => void;

  resetFilters: () => void;
};

const defaultSectionScope: SectionFilterScope = {
  criticalUpdates: true,
  promptsStream: true,
  kpiCards: true,
  visibilityAnalytics: true,
  brandVisibility: true,
  aiSentiment: true,
  topCitedPages: true,
  autoInsights: true,
};

const allDatasets: ExportDataset[] = [
  "kpis",
  "prompt-runs",
  "alerts",
  "competitors",
  "visibility",
  "runs",
  "prompts",
  "dashboard",
];

const defaultExportSelection: Record<ExportDataset, boolean> = {
  "kpis": true,
  "prompt-runs": true,
  "alerts": true,
  "competitors": true,
  "visibility": false,
  "runs": false,
  "prompts": false,
  "dashboard": false,
};

const DashboardStoreContext = createContext<DashboardStoreState | null>(null);

function toggleInArray(source: string[], value: string): string[] {
  return source.includes(value)
    ? source.filter((item) => item !== value)
    : [...source, value];
}

export function DashboardStoreProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<string>("7d");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [showUniqueModelFilters, setShowUniqueModelFilters] = useState<boolean>(false);

  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);

  const [kpiCardsPeriod, setKpiCardsPeriod] = useState<string | null>(null);
  const [visibilityAnalyticsPeriod, setVisibilityAnalyticsPeriod] = useState<string | null>(null);
  const [competitorAnalyticsPeriod, setCompetitorAnalyticsPeriod] = useState<string | null>(null);

  const [sectionFilterScope, setSectionFilterScope] =
    useState<SectionFilterScope>(defaultSectionScope);

  const [isFiltersPanelOpen, setIsFiltersPanelOpen] = useState<boolean>(true);

  const [showAdvancedExport, setShowAdvancedExport] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [exportUnreadOnly, setExportUnreadOnly] = useState<boolean>(false);
  const [exportRunsLimit, setExportRunsLimit] = useState<string>("100");
  const [selectedExportPreset, setSelectedExportPreset] =
    useState<"essentials" | "executive" | "raw">("essentials");
  const [exportSelection, setExportSelection] =
    useState<Record<ExportDataset, boolean>>(defaultExportSelection);

  const toggleModel = useCallback((id: string) => {
    setSelectedModels((prev) => toggleInArray(prev, id));
  }, []);

  const togglePersona = useCallback((persona: string) => {
    setSelectedPersonas((prev) => toggleInArray(prev, persona));
  }, []);

  const clearPersonas = useCallback(() => {
    setSelectedPersonas([]);
  }, []);

  const toggleCompetitor = useCallback((competitor: string) => {
    setSelectedCompetitors((prev) => toggleInArray(prev, competitor));
  }, []);

  const clearCompetitors = useCallback(() => {
    setSelectedCompetitors([]);
  }, []);

  const toggleSectionFilterScope = useCallback((key: keyof SectionFilterScope) => {
    setSectionFilterScope((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const resetSectionFilterScope = useCallback(() => {
    setSectionFilterScope(defaultSectionScope);
  }, []);

  const toggleFiltersPanel = useCallback(() => {
    setIsFiltersPanelOpen((prev) => !prev);
  }, []);

  const toggleExportUnreadOnly = useCallback(() => {
    setExportUnreadOnly((prev) => !prev);
  }, []);

  const toggleExportDataset = useCallback((dataset: ExportDataset) => {
    setExportSelection((prev) => ({
      ...prev,
      [dataset]: !prev[dataset],
    }));
  }, []);

  const selectAllExportDatasets = useCallback(() => {
    setExportSelection(
      allDatasets.reduce((acc, dataset) => {
        acc[dataset] = true;
        return acc;
      }, {} as Record<ExportDataset, boolean>),
    );
  }, []);

  const clearExportDatasets = useCallback(() => {
    setExportSelection(
      allDatasets.reduce((acc, dataset) => {
        acc[dataset] = false;
        return acc;
      }, {} as Record<ExportDataset, boolean>),
    );
  }, []);

  const resetFilters = useCallback(() => {
    setPeriod("7d");
    setDateRange(undefined);
    setSelectedModels([]);
    setSelectedPersonas([]);
    setSelectedCompetitors([]);
    setKpiCardsPeriod(null);
    setVisibilityAnalyticsPeriod(null);
    setCompetitorAnalyticsPeriod(null);
    setSectionFilterScope(defaultSectionScope);
  }, []);

  const value = useMemo<DashboardStoreState>(
    () => ({
      period,
      setPeriod,
      dateRange,
      setDateRange,

      selectedModels,
      showUniqueModelFilters,
      setShowUniqueModelFilters,
      toggleModel,

      selectedPersonas,
      togglePersona,
      clearPersonas,

      selectedCompetitors,
      toggleCompetitor,
      clearCompetitors,

      applyFiltersToGraphs: true,
      applyFiltersToLivePrompts: true,

      kpiCardsPeriod,
      setKpiCardsPeriod,
      visibilityAnalyticsPeriod,
      setVisibilityAnalyticsPeriod,
      competitorAnalyticsPeriod,
      setCompetitorAnalyticsPeriod,

      sectionFilterScope,
      toggleSectionFilterScope,
      resetSectionFilterScope,

      isFiltersPanelOpen,
      toggleFiltersPanel,

      showAdvancedExport,
      setShowAdvancedExport,
      exportFormat,
      setExportFormat,
      exportUnreadOnly,
      toggleExportUnreadOnly,
      exportRunsLimit,
      setExportRunsLimit,
      selectedExportPreset,
      setSelectedExportPreset,
      exportSelection,
      toggleExportDataset,
      setExportSelection,
      selectAllExportDatasets,
      clearExportDatasets,

      resetFilters,
    }),
    [
      period,
      dateRange,
      selectedModels,
      showUniqueModelFilters,
      toggleModel,
      selectedPersonas,
      togglePersona,
      clearPersonas,
      selectedCompetitors,
      toggleCompetitor,
      clearCompetitors,
      kpiCardsPeriod,
      visibilityAnalyticsPeriod,
      competitorAnalyticsPeriod,
      sectionFilterScope,
      toggleSectionFilterScope,
      resetSectionFilterScope,
      isFiltersPanelOpen,
      toggleFiltersPanel,
      showAdvancedExport,
      exportFormat,
      exportUnreadOnly,
      exportRunsLimit,
      selectedExportPreset,
      exportSelection,
      toggleExportDataset,
      selectAllExportDatasets,
      clearExportDatasets,
      resetFilters,
    ],
  );

  return (
    <DashboardStoreContext.Provider value={value}>
      {children}
    </DashboardStoreContext.Provider>
  );
}

export function useDashboardStore<T>(selector: (state: DashboardStoreState) => T): T {
  const state = useContext(DashboardStoreContext);
  if (!state) {
    throw new Error("useDashboardStore must be used inside DashboardStoreProvider");
  }
  return selector(state);
}
