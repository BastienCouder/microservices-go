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

  test("keeps the source filter commented out until monitoring is ready", () => {
    const activeSource = stripComments(source);

    expect(source.includes('t("filtersDataSource")')).toBe(true);
    expect(source.includes('value="perception"')).toBe(true);
    expect(source.includes('value="monitoring"')).toBe(true);
    expect(source.includes('value="all"')).toBe(true);
    expect(activeSource.includes('t("filtersDataSource")')).toBe(false);
  });
});
