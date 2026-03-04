import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { DateRange } from "react-day-picker";

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

  resetFilters: () => void;
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

  const resetFilters = useCallback(() => {
    setPeriod("7d");
    setDateRange(undefined);
    setSelectedModels([]);
    setSelectedPersonas([]);
    setSelectedCompetitors([]);
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
