import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./optimize-actions.tsx", import.meta.url)).text();

describe("optimization actions page", () => {
  test("renders a focused kanban board grouped by severity", () => {
    expect(source.includes("OptimizationErrorsKanban")).toBe(true);
    expect(source.includes("PageHeader")).toBe(true);
    expect(source.includes("OptimizationFiltersToolbar")).toBe(true);
    expect(source.includes("PeriodFilterPicker")).toBe(true);
    expect(source.includes("ModelsFilterPopover")).toBe(true);
    expect(source.includes("SEVERITY_COLUMNS")).toBe(true);
    expect(source.includes("useOptimizationErrors")).toBe(true);
    expect(source.includes("PerceptionTopErrorCard")).toBe(true);
    expect(source.includes("buildPerceptionModelLookup")).toBe(true);
    expect(source.includes("modelLookup={modelLookup}")).toBe(true);
    expect(source.includes("EmptyStateCard")).toBe(true);
    expect(source.includes("OptimizationColumnLoading")).toBe(true);
    expect(source.includes("OptimizationErrorCardSkeleton")).toBe(true);
    expect(source.includes("OptimizationErrorsLoading")).toBe(false);
    expect(source.includes("lg:grid-cols-3")).toBe(true);
    expect(source.includes("lg:-mx-1")).toBe(true);
    expect(source.includes("lg:overflow-y-auto")).toBe(true);
    expect(source.includes("loading={loading && !data}")).toBe(true);
    expect(source.includes("Faible")).toBe(true);
    expect(source.includes("Moyenne")).toBe(true);
    expect(source.includes("Critique")).toBe(true);
    expect(source.includes("usePerceptionData")).toBe(false);
    expect(source.includes("usePerceptionViewModel")).toBe(false);
    expect(source.includes("HubSpot")).toBe(false);
    expect(source.includes("ACTION_PLAYBOOKS")).toBe(false);
    expect(source.includes("INTEGRATION_CARDS")).toBe(false);
  });
});
