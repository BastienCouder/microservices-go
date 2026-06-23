import { describe, expect, test } from "bun:test";

const indexSource = await Bun.file(new URL("./index.tsx", import.meta.url)).text();
const layoutSource = await Bun.file(new URL("./layout.tsx", import.meta.url)).text();
const crawlPanelSource = await Bun.file(
  new URL("./_components/crawl-panel/index.tsx", import.meta.url),
).text();

describe("content optimizer page", () => {
  test("uses the crawl workflow instead of a placeholder", () => {
    expect(indexSource.includes("apiBaseURL")).toBe(true);
    expect(indexSource.includes("routeSearch")).toBe(true);
    expect(layoutSource.includes("CrawlPanel")).toBe(true);
    expect(layoutSource.includes('variant="contentOptimizer"')).toBe(true);
    expect(layoutSource.includes("OnboardingStep")).toBe(false);
    expect(layoutSource.includes("AnimatedWave")).toBe(false);
  });

  test("sets content optimization copy on the shared crawl panel", () => {
    expect(crawlPanelSource.includes('useScopedI18n("content-optimizer")')).toBe(true);
    expect(crawlPanelSource.includes('title: t("headerTitle")')).toBe(true);
    expect(crawlPanelSource.includes('discoverLabel: t("discoverPages")')).toBe(true);
    expect(crawlPanelSource.includes('analyzeSelectionLabel: t("analyzeSelection")')).toBe(true);
    expect(crawlPanelSource.includes('reviewAnalyzedPagesLabel: t("newSelection")')).toBe(true);
    expect(crawlPanelSource.includes("Relancer la découverte")).toBe(false);
  });
});
