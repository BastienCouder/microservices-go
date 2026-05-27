import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./index.tsx", import.meta.url)).text();
const normalizedSource = source.replace(/\s+/g, " ");
const resultsViewSource = await Bun.file(
  new URL("./_components/crawler-results-view.tsx", import.meta.url),
).text();
const initialSetupSource = await Bun.file(
  new URL("./_components/initial-setup-card.tsx", import.meta.url),
).text();
const headerSource = await Bun.file(
  new URL("./_components/crawler-page-header.tsx", import.meta.url),
).text();
const utilsSource = await Bun.file(
  new URL("./_lib/crawl-panel-utils.ts", import.meta.url),
).text();
describe("crawl panel", () => {
  test("extracts crawl panel constants into dedicated files", () => {
    expect(source.includes('from "./_lib/crawl-panel-utils"')).toBe(true);
    expect(utilsSource.includes("export const columns")).toBe(true);
    expect(source.includes("reanalyze-dialog")).toBe(false);
  });

  test("moves filter controls into the results view component", () => {
    expect(source.includes("<CrawlerResultsView")).toBe(true);
    expect(resultsViewSource.includes("PeriodFilterPicker")).toBe(true);
    expect(resultsViewSource.includes("STATUS_FILTER_OPTIONS")).toBe(true);
    expect(resultsViewSource.includes("SEVERITY_FILTER_OPTIONS")).toBe(true);
    expect(resultsViewSource.includes('label="Statut"')).toBe(true);
    expect(resultsViewSource.includes('label="Sévérité"')).toBe(true);
    expect(resultsViewSource.includes("SelectTrigger")).toBe(false);
  });

  test("keeps the initial discovery flow but delegates the setup card", () => {
    expect(
      source.includes("const hasAnalysis = viewModel.crawlRecords.length > 0"),
    ).toBe(true);
    expect(source.includes("function handleAnalyzeSiteClick()")).toBe(true);
    expect(source.includes("<InitialSetupCard")).toBe(true);
    expect(initialSetupSource.includes("Découvrir les URLs du site")).toBe(
      true,
    );
    expect(initialSetupSource.includes('placeholder="https://example.com"')).toBe(
      true,
    );
    expect(initialSetupSource.includes("readOnly")).toBe(true);
    expect(source.includes("viewModel.discover()")).toBe(true);
  });

  test("separates header actions without a scoped reanalysis dialog", () => {
    expect(source.includes("<CrawlerPageHeader")).toBe(true);
    expect(headerSource.includes("Mettre à jour la liste des pages")).toBe(true);
    expect(headerSource.includes("Analyser les pages sélectionnées")).toBe(true);
    expect(headerSource.includes("Réanalyser toutes les pages")).toBe(false);
    expect(headerSource.includes("Réanalyser certaines pages")).toBe(false);
    expect(headerSource.includes("Choisir les pages")).toBe(false);
    expect(
      source.includes("Mise à jour de la liste des pages en cours."),
    ).toBe(true);
    expect(source.includes("viewModel.discover()")).toBe(true);
    expect(source.includes("viewModel.crawlSelected()")).toBe(true);
    expect(source.includes("function handleReanalyzeAllClick()")).toBe(false);
  });

  test("shows crawler URLs as selectable rows for analysis", () => {
    expect(
      normalizedSource.includes(
        "const records = reviewingDiscoveredPages ? viewModel.discoveredPages : viewModel.crawlRecords",
      ),
    ).toBe(true);
    expect(resultsViewSource.includes("Sélectionner toutes les pages")).toBe(
      true,
    );
    expect(resultsViewSource.includes("selectedCount")).toBe(true);
    expect(source.includes("onTogglePage={viewModel.togglePage}")).toBe(true);
    expect(source.includes("selectable={canUsePageSelection}")).toBe(true);
  });

  test("shows dedicated subcomponents for setup and results states", () => {
    expect(source.includes("const showInitialSetup =")).toBe(true);
    expect(source.includes("{showInitialSetup ? null : (")).toBe(true);
    expect(source.includes("<InitialSetupCard")).toBe(true);
    expect(source.includes("<CrawlerResultsView")).toBe(true);
    expect(initialSetupSource.includes("<AnimatedWave />")).toBe(true);
    expect(initialSetupSource.includes("<OnboardingStep")).toBe(true);
  });
});
