import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./index.tsx", import.meta.url)).text();
const normalizedSource = source.replace(/\s+/g, " ");
const resultsViewSource = await Bun.file(
  new URL("./_components/crawler-results-view.tsx", import.meta.url),
).text();
const dialogSource = await Bun.file(
  new URL("./_components/reanalyze-dialog.tsx", import.meta.url),
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
const normalizedDialogSource = dialogSource.replace(/\s+/g, " ");

describe("crawl panel", () => {
  test("extracts crawl panel constants and dialog copy into dedicated files", () => {
    expect(source.includes('from "./_lib/crawl-panel-utils"')).toBe(true);
    expect(utilsSource.includes("export const DEFAULT_REANALYZE_LIMIT = 100")).toBe(
      true,
    );
    expect(
      normalizedDialogSource.includes("La limite est de 100 pages par défaut."),
    ).toBe(true);
    expect(
      normalizedDialogSource.includes(
        "Les erreurs des pages non sélectionnées sont conservées.",
      ),
    ).toBe(true);
    expect(dialogSource.includes("Limite de pages")).toBe(false);
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

  test("keeps the initial analysis flow but delegates the setup card", () => {
    expect(
      source.includes("const hasAnalysis = viewModel.crawlRecords.length > 0"),
    ).toBe(true);
    expect(source.includes("function handleAnalyzeSiteClick()")).toBe(true);
    expect(source.includes("<InitialSetupCard")).toBe(true);
    expect(initialSetupSource.includes("Analyser un site pour ce projet")).toBe(
      true,
    );
    expect(initialSetupSource.includes("URL du projet")).toBe(true);
    expect(initialSetupSource.includes('placeholder="https://example.com"')).toBe(
      true,
    );
    expect(initialSetupSource.includes("readOnly")).toBe(true);
    expect(
      normalizedSource.includes(
        "viewModel.reanalyze({ limit: DEFAULT_REANALYZE_LIMIT, includePatterns: [], })",
      ),
    ).toBe(true);
  });

  test("separates header actions and scoped reanalysis dialog", () => {
    expect(source.includes("<CrawlerPageHeader")).toBe(true);
    expect(headerSource.includes("Mettre à jour la liste des pages")).toBe(true);
    expect(headerSource.includes("Réanalyser des pages")).toBe(true);
    expect(dialogSource.includes("Choisir les pages à analyser")).toBe(true);
    expect(
      source.includes("Mise à jour de la liste des pages en cours."),
    ).toBe(true);
    expect(source.includes("viewModel.discover()")).toBe(true);
    expect(source.includes("viewModel.crawlSelected()")).toBe(true);
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
