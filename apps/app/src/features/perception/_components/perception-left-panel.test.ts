import { describe, expect, test } from "bun:test";

const source = await Bun.file(
  new URL("./perception-left-panel.tsx", import.meta.url),
).text();

function stripComments(value: string) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("perception left panel", () => {
  test("renders the perception hero insight in the left column", () => {
    const activeSource = stripComments(source);

    expect(activeSource.includes("PerceptionHeroInsightCard")).toBe(true);
    expect(activeSource.includes("buildPerceptionHeroInsight")).toBe(true);
    expect(activeSource.includes("<PerceptionHeroInsightCard insight={heroInsight}")).toBe(true);
  });

  test("includes a dedicated data source filter for perception, monitoring, and both", () => {
    const activeSource = stripComments(source);

    expect(activeSource.includes('t("filtersDataSource")')).toBe(true);
    expect(activeSource.includes('value="perception"')).toBe(true);
    expect(activeSource.includes('value="monitoring"')).toBe(true);
    expect(activeSource.includes('value="all"')).toBe(true);
  });
});
