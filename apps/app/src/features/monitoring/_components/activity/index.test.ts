import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./index.tsx", import.meta.url)).text();
const viewModelSource = await Bun.file(
  new URL("../../_lib/activity/use-activity-panel-view-model.ts", import.meta.url),
).text();

describe("monitoring activity panel", () => {
  test("keeps the monitoring export available in the activity panel on mobile", () => {
    expect(source.indexOf("Export monitoring") < source.indexOf("<ActivityAlerts")).toBe(true);
    expect(source.includes('t("exportExcel")')).toBe(true);
    expect(source.includes("Download")).toBe(true);
    expect(source.includes("viewModel.canExport")).toBe(true);
    expect(source.includes("viewModel.handleExportMonitoringData")).toBe(true);
    expect(source.includes("viewModel.exportDisabled")).toBe(true);
    expect(source.includes("lg:hidden")).toBe(true);
  });

  test("navigates to prompts responses through the SPA router", () => {
    expect(source.includes("useNavigate")).toBe(true);
    expect(source.includes("navigate(`/prompts?${params.toString()}`)")).toBe(true);
    expect(source.includes("window.location.assign(`/prompts?${params.toString()}`)")).toBe(false);
  });

  test("shows calculated monitoring alerts instead of raw monitoring errors", () => {
    expect(viewModelSource.includes("buildAutomaticInsights")).toBe(true);
    expect(viewModelSource.includes("buildTopCitedPagesFromPrompts")).toBe(true);
    expect(viewModelSource.includes("filterMonitoringAlerts")).toBe(false);
    expect(viewModelSource.includes("const { models, recent_prompts }")).toBe(true);
    expect(viewModelSource.includes("const { alerts, recent_prompts }")).toBe(false);
  });
});
