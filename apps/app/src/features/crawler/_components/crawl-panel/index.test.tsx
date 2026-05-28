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
const selectionViewSource = await Bun.file(
  new URL("./_components/discovered-pages-selection-view.tsx", import.meta.url),
).text();
const utilsSource = await Bun.file(
  new URL("./_lib/crawl-panel-utils.ts", import.meta.url),
).text();
const viewModelSource = await Bun.file(
  new URL("../../_lib/crawl/use-content-optimizer-view-model.ts", import.meta.url),
).text();
const layoutSource = await Bun.file(
  new URL("../../layout.tsx", import.meta.url),
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
    expect(resultsViewSource.includes("Diagnostic GEO")).toBe(true);
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
    expect(headerSource.includes("Actualiser les URLs")).toBe(true);
    expect(headerSource.includes("Analyser la sélection")).toBe(true);
    expect(headerSource.includes("Modifier la sélection")).toBe(true);
    expect(headerSource.includes("Réanalyser toutes les pages")).toBe(false);
    expect(headerSource.includes("Réanalyser certaines pages")).toBe(false);
    expect(headerSource.includes("Choisir les pages")).toBe(false);
    expect(
      source.includes("Découverte des pages en cours."),
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
    expect(source.includes("<DiscoveredPagesSelectionView")).toBe(true);
    expect(selectionViewSource.includes("Pages découvertes")).toBe(true);
    expect(selectionViewSource.includes("Tout sélectionner")).toBe(
      true,
    );
    expect(selectionViewSource.includes("Contenu extrait")).toBe(false);
    expect(resultsViewSource.includes("selectedCount")).toBe(true);
    expect(source.includes("onTogglePage={viewModel.togglePage}")).toBe(true);
  });

  test("shows dedicated subcomponents for setup and results states", () => {
    expect(source.includes("const showInitialSetup =")).toBe(true);
    expect(source.includes("const showProjectTransition =")).toBe(true);
    expect(source.includes("{showProjectTransition ? <CrawlPanelTemplate /> : null}")).toBe(true);
    expect(source.includes("{showProjectTransition || showInitialSetup ? null : (")).toBe(true);
    expect(source.includes("<InitialSetupCard")).toBe(true);
    expect(source.includes("<CrawlerResultsView")).toBe(true);
    expect(initialSetupSource.includes("<AnimatedWave />")).toBe(true);
    expect(initialSetupSource.includes("<OnboardingStep")).toBe(true);
  });

  test("keeps discovery state separate from latest analyzed crawl snapshots", () => {
    expect(viewModelSource.includes("getLatestContentOptimizerCrawl")).toBe(
      false,
    );
    expect(viewModelSource.includes("setDiscoveryResult(null);")).toBe(true);
  });

  test("keeps Cloudflare discovery limit within provider maximum", () => {
    expect(viewModelSource.includes("const DISCOVERY_LIMIT = 100;")).toBe(true);
  });

  test("persists discovered pages locally per project and organization", () => {
    expect(viewModelSource.includes("const DISCOVERY_STORAGE_KEY")).toBe(true);
    expect(viewModelSource.includes("const projectScopeKey = useMemo(")).toBe(
      true,
    );
    expect(viewModelSource.includes("readStoredDiscovery(")).toBe(true);
    expect(viewModelSource.includes("writeStoredDiscovery(")).toBe(true);
    expect(
      viewModelSource.includes("window.localStorage.setItem"),
    ).toBe(true);
    expect(viewModelSource.includes("setDiscoveryLoadedKey(\"\");")).toBe(true);
  });

  test("resets crawler state and local filters when the project scope changes", () => {
    expect(viewModelSource.includes("useLayoutEffect")).toBe(true);
    expect(viewModelSource.includes("setProjectWebsiteURL(\"\");")).toBe(true);
    expect(viewModelSource.includes("setCrawlResult(null);")).toBe(true);
    expect(viewModelSource.includes("setHydratingProjectScope(true);")).toBe(true);
    expect(layoutSource.includes("key={routeSearch}")).toBe(true);
    expect(source.includes("setStatusFilter(\"all\");")).toBe(true);
    expect(source.includes("setSortKey(\"priority\");")).toBe(true);
  });

  test("keeps the transition loading state until project review cache is resolved", () => {
    expect(viewModelSource.includes("const [hydratingProjectScope, setHydratingProjectScope] = useState(true);")).toBe(true);
    expect(viewModelSource.includes("const [projectSummaryResolved, setProjectSummaryResolved] = useState(false);")).toBe(true);
    expect(viewModelSource.includes("!projectSummaryResolved ||")).toBe(true);
    expect(viewModelSource.includes("setHydratingProjectScope(false);")).toBe(true);
    expect(source.includes("!showProjectTransition &&")).toBe(true);
  });

  test("analyzes selected discovered records without a second Cloudflare crawl when content exists", () => {
    expect(
      viewModelSource.includes("analyzeSelectedContentOptimizerRecords"),
    ).toBe(true);
    expect(viewModelSource.includes("hasExtractedContent")).toBe(true);
    expect(
      viewModelSource.includes("selectedContentRecords.every(hasExtractedContent)"),
    ).toBe(true);
  });

  test("keeps the saved review visible when refreshing discovery fails", () => {
    expect(viewModelSource.includes("previousDiscovery")).toBe(true);
    expect(viewModelSource.includes("previousPhase")).toBe(true);
    expect(viewModelSource.includes("reviewSelection")).toBe(true);
    expect(
      normalizedSource.includes(
        'viewModel.phase === "discovering" && viewModel.discoveredPages.length > 0',
      ),
    ).toBe(true);
  });

  test("keeps discovered pages on the project domain only", () => {
    expect(
      viewModelSource.includes("filterDiscoveryResultToProjectDomain"),
    ).toBe(true);
    expect(
      viewModelSource.includes("matchesProjectDiscoveryDomain"),
    ).toBe(true);
    expect(
      viewModelSource.includes('normalized.startsWith("www.")'),
    ).toBe(true);
  });

  test("groups analyzed content into GEO insight dimensions", () => {
    expect(utilsSource.includes("geoInsightGroups")).toBe(true);
    expect(utilsSource.includes("Compréhension IA")).toBe(true);
    expect(utilsSource.includes("Réponse générative")).toBe(true);
    expect(utilsSource.includes("Crédibilité")).toBe(true);
  });

  test("adds compact GEO KPIs for analyzed content", () => {
    expect(utilsSource.includes("computeGeoKpiSummaries")).toBe(true);
    expect(resultsViewSource.includes("CrawlerKpiStrip")).toBe(true);
    expect(utilsSource.includes("Score GEO moyen")).toBe(true);
    expect(utilsSource.includes("Pages à risque")).toBe(true);
    expect(utilsSource.includes("Compréhension OK")).toBe(true);
    expect(utilsSource.includes("Réponses prêtes")).toBe(true);
    expect(utilsSource.includes("Crédibilité OK")).toBe(true);
  });
});
