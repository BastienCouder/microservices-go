import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./use-perception-view-model.ts", import.meta.url)).text();

describe("usePerceptionViewModel", () => {
  test("does not derive frontend-only error cards", () => {
    expect(source.includes("derivePerceptionOptimizationErrors")).toBe(false);
    expect(source.includes("OptimizationErrorsPanel")).toBe(false);
    expect(source.includes("handleFix")).toBe(false);
    expect(source.includes("handleRemoveAction")).toBe(false);
  });

  test("filters responses by source before applying model and period slices", () => {
    expect(source.includes("selectedSourceFilter")).toBe(true);
    expect(source.includes("sourceFilter: selectedSourceFilter")).toBe(true);
    expect(source.includes("getLatestRunIdForResponses")).toBe(true);
    expect(source.includes("setSelectedSourceFilter")).toBe(true);
  });
});
