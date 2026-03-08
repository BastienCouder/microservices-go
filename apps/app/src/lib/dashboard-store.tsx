import { createContext, useContext, useRef, type ReactNode } from "react";
import type { DateRange } from "react-day-picker";
import { createStore } from "zustand/vanilla";
import { useStoreWithEqualityFn } from "zustand/traditional";

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

type DashboardStoreApi = ReturnType<typeof createDashboardStore>;

const DashboardStoreContext = createContext<DashboardStoreApi | null>(null);

function toggleInArray(source: string[], value: string): string[] {
  return source.includes(value)
    ? source.filter((item) => item !== value)
    : [...source, value];
}

function createDashboardStore() {
  return createStore<DashboardStoreState>((set) => ({
    period: "7d",
    setPeriod: (period) => set({ period }),
    dateRange: undefined,
    setDateRange: (dateRange) => set({ dateRange }),

    selectedModels: [],
    showUniqueModelFilters: false,
    setShowUniqueModelFilters: (showUniqueModelFilters) => set({ showUniqueModelFilters }),
    toggleModel: (id) =>
      set((state) => ({
        selectedModels: toggleInArray(state.selectedModels, id),
      })),

    selectedPersonas: [],
    togglePersona: (persona) =>
      set((state) => ({
        selectedPersonas: toggleInArray(state.selectedPersonas, persona),
      })),
    clearPersonas: () => set({ selectedPersonas: [] }),

    selectedCompetitors: [],
    toggleCompetitor: (competitor) =>
      set((state) => ({
        selectedCompetitors: toggleInArray(state.selectedCompetitors, competitor),
      })),
    clearCompetitors: () => set({ selectedCompetitors: [] }),

    resetFilters: () =>
      set({
        period: "7d",
        dateRange: undefined,
        selectedModels: [],
        showUniqueModelFilters: false,
        selectedPersonas: [],
        selectedCompetitors: [],
      }),
  }));
}

export function DashboardStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<DashboardStoreApi | null>(null);
  if (!storeRef.current) {
    storeRef.current = createDashboardStore();
  }

  return (
    <DashboardStoreContext.Provider value={storeRef.current}>
      {children}
    </DashboardStoreContext.Provider>
  );
}

export function useDashboardStore<T>(
  selector: (state: DashboardStoreState) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  const store = useContext(DashboardStoreContext);
  if (!store) {
    throw new Error("useDashboardStore must be used inside DashboardStoreProvider");
  }

  return useStoreWithEqualityFn(store, selector, equalityFn);
}
