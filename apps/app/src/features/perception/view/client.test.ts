import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./client.tsx", import.meta.url)).text();

describe("perception client layout", () => {
  test("hides the generated actions section and keeps fix buttons wired", () => {
    expect(source.includes("PerceptionOptimizeActions")).toBe(false);
    expect(source.includes("drafts={viewModel.visibleOptimizeDrafts}")).toBe(false);
    expect(source.includes("persistError={viewModel.persistError}")).toBe(false);
    expect(source.includes("onCreateAction={permissions.canEdit ? viewModel.handleFix : undefined}")).toBe(true);
    expect(source.includes("generatedIds={viewModel.generatedIds}")).toBe(true);
    expect(source.includes("modelCatalog={viewModel.modelCatalog}")).toBe(true);
    expect(source.includes("savingErrorIds={viewModel.savingErrorIds}")).toBe(true);
  });

  test("passes the perception analysis and export actions into the hero insight card", () => {
    expect(source.includes('t("exportExcel")')).toBe(true);
    expect(source.includes("Download")).toBe(true);
    expect(source.includes("heroActions={heroActions}")).toBe(true);
    expect(source.includes("viewModel.canExport")).toBe(true);
    expect(source.includes("viewModel.exportDisabled")).toBe(true);
    expect(source.includes("viewModel.handleExportPerceptionData(periodLabel)")).toBe(true);
  });

  test("removes the data source summary card and wires the source filter through the view model", () => {
    expect(source.includes('t("sourceSummaryTitle")')).toBe(false);
    expect(source.includes("selectedSourceFilter={viewModel.selectedSourceFilter}")).toBe(true);
    expect(source.includes("onSourceFilterChange={viewModel.setSelectedSourceFilter}")).toBe(true);
    expect(source.includes("totalErrorCount={viewModel.filteredTopErrorsTotalCount}")).toBe(true);
  });
});
