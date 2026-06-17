import { afterEach, describe, expect, test } from "bun:test";
import {
  PERCEPTION_FILTERS_STORAGE_KEY,
  readPersistedPerceptionFilters,
  writePersistedPerceptionFilters,
} from "./perception-filters-storage";

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

function installMockWindow() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
          values.set(key, value);
        },
        removeItem: (key: string) => {
          values.delete(key);
        },
      },
    },
    writable: true,
  });
}

afterEach(() => {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, "window", originalWindowDescriptor);
    return;
  }
  Reflect.deleteProperty(globalThis, "window");
});

describe("perception filters storage", () => {
  test("restores persisted filters and ignores unknown models", () => {
    installMockWindow();
    window.localStorage.setItem(
      PERCEPTION_FILTERS_STORAGE_KEY,
      JSON.stringify({
        selectedModels: ["gpt-4o", "unknown-model"],
        selectedSourceFilter: "monitoring",
        selectedPeriod: "30d",
        showUniqueModelFilters: true,
      }),
    );

    expect(readPersistedPerceptionFilters(["gpt-4o", "claude-3.7"])).toEqual({
      selectedModels: ["gpt-4o"],
      selectedSourceFilter: "monitoring",
      selectedPeriod: "30d",
      showUniqueModelFilters: true,
    });
  });

  test("falls back to defaults when persisted values are invalid", () => {
    installMockWindow();
    window.localStorage.setItem(
      PERCEPTION_FILTERS_STORAGE_KEY,
      JSON.stringify({
        selectedModels: ["gpt-4o"],
        selectedSourceFilter: "invalid",
        selectedPeriod: "14d",
        showUniqueModelFilters: "yes",
      }),
    );

    expect(readPersistedPerceptionFilters(["gpt-4o"])).toEqual({
      selectedModels: ["gpt-4o"],
      selectedSourceFilter: "perception",
      selectedPeriod: "all",
      showUniqueModelFilters: false,
    });
  });

  test("writes the current perception filters to local storage", () => {
    installMockWindow();

    writePersistedPerceptionFilters({
      selectedModels: ["gpt-4o", "claude-3.7"],
      selectedSourceFilter: "all",
      selectedPeriod: "last-run",
      showUniqueModelFilters: true,
    });

    expect(window.localStorage.getItem(PERCEPTION_FILTERS_STORAGE_KEY)).toBe(
      JSON.stringify({
        selectedModels: ["gpt-4o", "claude-3.7"],
        selectedSourceFilter: "all",
        selectedPeriod: "last-run",
        showUniqueModelFilters: true,
      }),
    );
  });
});
