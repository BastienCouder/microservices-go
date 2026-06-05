import { describe, expect, test } from "bun:test";

const indexSource = await Bun.file(new URL("./index.tsx", import.meta.url)).text();
const layoutSource = await Bun.file(new URL("./layout.tsx", import.meta.url)).text();
const crawlPanelSource = await Bun.file(
  new URL("../crawler/_components/crawl-panel/index.tsx", import.meta.url),
).text();

describe("content optimizer page", () => {
  test("uses the crawler workflow instead of a placeholder", () => {
    expect(indexSource.includes("apiBaseURL")).toBe(true);
    expect(indexSource.includes("routeSearch")).toBe(true);
    expect(layoutSource.includes("CrawlPanel")).toBe(true);
    expect(layoutSource.includes('variant="contentOptimizer"')).toBe(true);
    expect(layoutSource.includes("OnboardingStep")).toBe(false);
    expect(layoutSource.includes("AnimatedWave")).toBe(false);
  });

  test("sets content optimization copy on the shared crawl panel", () => {
    expect(crawlPanelSource.includes("CONTENT_OPTIMIZER_COPY")).toBe(true);
    expect(crawlPanelSource.includes("Optimisation de contenu")).toBe(true);
    expect(crawlPanelSource.includes("Découvrir les pages")).toBe(true);
    expect(crawlPanelSource.includes("Analyser la sélection")).toBe(true);
    expect(crawlPanelSource.includes("Nouvelle sélection")).toBe(true);
    expect(crawlPanelSource.includes("Relancer la découverte")).toBe(false);
  });
});
