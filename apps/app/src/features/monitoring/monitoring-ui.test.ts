import { describe, expect, test } from "bun:test";

const filtersPanelSource = await Bun.file(
  new URL("../components/filters-panel/filters-panel-expanded.tsx", import.meta.url),
).text();

describe("monitoring filters ui", () => {
  test("uses small tabs for grouped and unique model modes", () => {
    expect(filtersPanelSource.includes("ModelFilterModeTabs")).toBe(true);
    expect(filtersPanelSource.includes('value={props.showUniqueModelFilters ? "unique" : "grouped"}')).toBe(true);
  });
});
