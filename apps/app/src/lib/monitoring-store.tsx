import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import type { DateRange } from "react-day-picker";
import { createStore } from "zustand/vanilla";
import { useStoreWithEqualityFn } from "zustand/traditional";

type MonitoringStoreState = {
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

type MonitoringStoreApi = ReturnType<typeof createMonitoringStore>;

const MonitoringStoreContext = createContext<MonitoringStoreApi | null>(null);
const MONITORING_FILTERS_STORAGE_KEY = "monitoring-filters:v1";
function getDefaultMonitoringFilters() {
  return {
    period: "14d",
    dateRange: undefined as DateRange | undefined,
    selectedModels: [] as string[],
    showUniqueModelFilters: false,
    selectedPersonas: [] as string[],
    selectedCompetitors: [] as string[],
  };
}

type PersistedMonitoringFilters = ReturnType<typeof getDefaultMonitoringFilters>;

function toggleInArray(source: string[], value: string): string[] {
  return source.includes(value)
    ? source.filter((item) => item !== value)
    : [...source, value];
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toStoredDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function readPersistedMonitoringFilters(): Partial<PersistedMonitoringFilters> {
  const defaultFilters = getDefaultMonitoringFilters();

  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(MONITORING_FILTERS_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue) as Record<string, unknown>;
    const rawDateRange =
      parsed.dateRange && typeof parsed.dateRange === "object"
        ? (parsed.dateRange as Record<string, unknown>)
        : undefined;
    const dateRangeFrom = rawDateRange ? toStoredDate(rawDateRange.from) : undefined;
    const dateRangeTo = rawDateRange ? toStoredDate(rawDateRange.to) : undefined;

    return {
      period: typeof parsed.period === "string" ? parsed.period : defaultFilters.period,
      dateRange: dateRangeFrom
        ? {
            from: dateRangeFrom,
            to: dateRangeTo,
          }
        : undefined,
      selectedModels: toStringArray(parsed.selectedModels),
      showUniqueModelFilters:
        typeof parsed.showUniqueModelFilters === "boolean"
          ? parsed.showUniqueModelFilters
          : defaultFilters.showUniqueModelFilters,
      selectedPersonas: toStringArray(parsed.selectedPersonas),
      selectedCompetitors: toStringArray(parsed.selectedCompetitors),
    };
  } catch {
    return {};
  }
}

function writePersistedMonitoringFilters(state: MonitoringStoreState) {
  if (typeof window === "undefined") {
    return;
  }

  const serializableState = {
    period: state.period,
    dateRange: state.dateRange
      ? {
          from: state.dateRange.from?.toISOString(),
          to: state.dateRange.to?.toISOString(),
        }
      : undefined,
    selectedModels: state.selectedModels,
    showUniqueModelFilters: state.showUniqueModelFilters,
    selectedPersonas: state.selectedPersonas,
    selectedCompetitors: state.selectedCompetitors,
  };

  window.localStorage.setItem(
    MONITORING_FILTERS_STORAGE_KEY,
    JSON.stringify(serializableState),
  );
}

function createMonitoringStore() {
  const defaultFilters = getDefaultMonitoringFilters();
  const persistedFilters = readPersistedMonitoringFilters();

  return createStore<MonitoringStoreState>((set) => ({
    ...defaultFilters,
    ...persistedFilters,
    setPeriod: (period) => set({ period }),
    setDateRange: (dateRange) => set({ dateRange }),

    setShowUniqueModelFilters: (showUniqueModelFilters) => set({ showUniqueModelFilters }),
    toggleModel: (id) =>
      set((state) => ({
        selectedModels: toggleInArray(state.selectedModels, id),
      })),

    togglePersona: (persona) =>
      set((state) => ({
        selectedPersonas: toggleInArray(state.selectedPersonas, persona),
      })),
    clearPersonas: () => set({ selectedPersonas: [] }),

    toggleCompetitor: (competitor) =>
      set((state) => ({
        selectedCompetitors: toggleInArray(state.selectedCompetitors, competitor),
      })),
    clearCompetitors: () => set({ selectedCompetitors: [] }),

    resetFilters: () => set(getDefaultMonitoringFilters()),
  }));
}

export function MonitoringStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<MonitoringStoreApi | null>(null);
  if (!storeRef.current) {
    storeRef.current = createMonitoringStore();
  }

  useEffect(() => {
    const store = storeRef.current;
    if (!store) {
      return;
    }

    writePersistedMonitoringFilters(store.getState());
    const unsubscribe = store.subscribe((state) => {
      writePersistedMonitoringFilters(state);
    });

    return unsubscribe;
  }, []);

  return (
    <MonitoringStoreContext.Provider value={storeRef.current}>
      {children}
    </MonitoringStoreContext.Provider>
  );
}

export function useMonitoringStore<T>(
  selector: (state: MonitoringStoreState) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  const store = useContext(MonitoringStoreContext);
  if (!store) {
    throw new Error("useMonitoringStore must be used inside MonitoringStoreProvider");
  }

  return useStoreWithEqualityFn(store, selector, equalityFn);
}
