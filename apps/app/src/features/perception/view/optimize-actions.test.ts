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
    expect(source.includes("Basse")).toBe(true);
    expect(source.includes("Moyenne")).toBe(true);
    expect(source.includes("Haute")).toBe(true);
    expect(source.includes("usePerceptionData")).toBe(false);
    expect(source.includes("usePerceptionViewModel")).toBe(false);
    expect(source.includes("HubSpot")).toBe(false);
    expect(source.includes("ACTION_PLAYBOOKS")).toBe(false);
    expect(source.includes("INTEGRATION_CARDS")).toBe(false);
  });
});
