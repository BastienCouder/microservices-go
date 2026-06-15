import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./use-perception-view-model.ts", import.meta.url)).text();

describe("usePerceptionViewModel", () => {
  test("uses backend top errors instead of deriving frontend-only error cards", () => {
    expect(source.includes("derivePerceptionTopErrorsFromResponses")).toBe(false);
    expect(source.includes('actionStatusesByErrorId.get(error.id) !== "done"')).toBe(true);
    expect(source.includes(".slice(0, 3)")).toBe(true);
    expect(source.includes("visibleOptimizeDrafts")).toBe(true);
    expect(source.includes('draft.status !== "done"')).toBe(true);
  });

  test("creates perception optimize actions in processing status for error hub consistency", () => {
    expect(source.includes('status: "processing"')).toBe(true);
    expect(source.includes('createdBy: "ai"')).toBe(true);
    expect(source.includes('workflow: "perception_fix"')).toBe(true);
    expect(source.includes('status: result.status || "processing"')).toBe(true);
    expect(source.includes("toCanonicalPerceptionSourceErrorId(error.id)")).toBe(true);
    expect(source.includes("getOptimizationActionMatchIds")).toBe(true);
    expect(source.includes("deletePerceptionClientJSON")).toBe(true);
    expect(source.includes("handleRemoveAction")).toBe(true);
  });

  test("filters responses by source before applying model and period slices", () => {
    expect(source.includes("selectedSourceFilter")).toBe(true);
    expect(source.includes("sourceFilter: selectedSourceFilter")).toBe(true);
    expect(source.includes("getLatestRunIdForResponses")).toBe(true);
    expect(source.includes("setSelectedSourceFilter")).toBe(true);
  });

  test("filters top errors by the selected source as well", () => {
    expect(source.includes("getPerceptionErrorSource")).toBe(true);
    expect(source.includes("getPerceptionErrorSource(error) === selectedSourceFilter")).toBe(true);
    expect(source.includes("filteredTopErrorsTotalCount")).toBe(true);
  });

  test("hides top errors when perception is selected but no perception responses exist", () => {
    expect(source.includes('selectedSourceFilter === "perception" && sourceScopedResponses.length === 0')).toBe(true);
    expect(source.includes("return [];")).toBe(true);
    expect(source.includes("return 0;")).toBe(true);
  });
});
