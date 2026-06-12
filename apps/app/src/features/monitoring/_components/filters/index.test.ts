import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./index.tsx", import.meta.url)).text();

describe("monitoring filters panel", () => {
  test("passes the export action into the hero insight card", () => {
    expect(source.includes("FilterHeroInsightCard insight={heroInsight} actions={heroActions}")).toBe(true);
    expect(source.includes("handleExportMonitoringData")).toBe(true);
    expect(source.includes("exportDisabled")).toBe(true);
    expect(source.includes("exportExcel")).toBe(true);
  });
});
