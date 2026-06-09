import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./index.tsx", import.meta.url)).text();
const kanbanSource = await Bun.file(
  new URL("./_components/error-hub-kanban.tsx", import.meta.url),
).text();
const detailsSource = await Bun.file(
  new URL("./_components/error-hub-details-panel.tsx", import.meta.url),
).text();
const columnSource = await Bun.file(
  new URL("./_components/error-hub-column.tsx", import.meta.url),
).text();
const contentBriefsSource = await Bun.file(
  new URL("./_components/error-hub-content-briefs-tab.tsx", import.meta.url),
).text();
const utilsSource = await Bun.file(
  new URL("./_lib/error-hub-utils.ts", import.meta.url),
).text();
const typesSource = await Bun.file(
  new URL("./_lib/error-hub-types.ts", import.meta.url),
).text();
const normalizedSource = source.replace(/\s+/g, " ");
const normalizedDetailsSource = detailsSource.replace(/\s+/g, " ");

describe("error hub", () => {
  test("opens perception-style detail sheets from kanban cards", () => {
    expect(detailsSource.includes("ErrorDetailsContent")).toBe(true);
    expect(kanbanSource.includes("const [selectedError, setSelectedError]")).toBe(
      true,
    );
    expect(kanbanSource.includes('const [boardView, setBoardView]')).toBe(true);
    expect(kanbanSource.includes('value={boardView}')).toBe(true);
    expect(kanbanSource.includes('value="severity"')).toBe(true);
    expect(kanbanSource.includes('value="status"')).toBe(true);
    expect(kanbanSource.includes('value="content"')).toBe(true);
    expect(kanbanSource.includes("ErrorHubContentBriefsTab")).toBe(true);
    expect(typesSource.includes('"status" | "content"')).toBe(true);
    expect(contentBriefsSource.includes("Opportunites")).toBe(true);
    expect(contentBriefsSource.includes("Brief IA")).toBe(true);
    expect(contentBriefsSource.includes("Suggestion initiale")).toBe(true);
    expect(source.includes("generatedContentByErrorId")).toBe(true);
    expect(kanbanSource.includes("generatedContentByErrorId")).toBe(true);
    expect(source.includes("canGenerateAiBrief")).toBe(true);
    expect(kanbanSource.includes("canGenerateAiBrief")).toBe(true);
    expect(contentBriefsSource.includes("canGenerateAiBrief ?")).toBe(true);
    expect(
      kanbanSource.includes("onOpenDetails={setSelectedError}"),
    ).toBe(true);
    expect(
      normalizedDetailsSource.includes("<Sheet open={selectedError !== null}"),
    ).toBe(true);
    expect(
      normalizedDetailsSource.includes("<Drawer open={selectedError !== null}"),
    ).toBe(true);
    expect(
      detailsSource.includes(
        "actionStatus={actionStatusesByErrorId.get(selectedError.id)}",
      ),
    ).toBe(true);
    expect(
      detailsSource.includes(
        "onMarkActionDone={() => void onMarkDone(selectedError)}",
      ),
    ).toBe(true);
    expect(kanbanSource.includes("setActionStatusFilter")).toBe(true);
    expect(typesSource.includes("ACTION_STATUS_OPTIONS")).toBe(true);
    expect(utilsSource.includes("filterErrorsByActionStatus")).toBe(true);
    expect(utilsSource.includes("sortErrorsByActionStatus")).toBe(true);
    expect(utilsSource.includes("groupErrorsByActionStatus")).toBe(true);
    expect(typesSource.includes("STATUS_COLUMNS")).toBe(true);
    expect(typesSource.includes('title: "À faire"')).toBe(true);
    expect(typesSource.includes('title: "En cours"')).toBe(true);
    expect(typesSource.includes('title: "Terminé"')).toBe(true);
    expect(utilsSource.includes('if (status === "processing") return 0;')).toBe(
      true,
    );
    expect(utilsSource.includes('if (status === "done") return 2;')).toBe(true);
    expect(typesSource.includes("SOURCE_OPTIONS")).toBe(true);
    expect(typesSource.includes('value: "crawler"')).toBe(true);
    expect(utilsSource.includes("filterErrorsBySource")).toBe(true);
    expect(kanbanSource.includes("setSourceFilter")).toBe(true);
    expect(source.includes("readSourceFilterFromSearch")).toBe(true);
    expect(
      normalizedSource.includes(
        "initialSourceFilter={readSourceFilterFromSearch(routeSearch)}",
      ),
    ).toBe(true);
  });

  test("keeps error cards free from page grouping headers and context badges", () => {
    expect(columnSource.includes("Problèmes détectés sur cette page")).toBe(
      false,
    );
    expect(columnSource.includes("Issues detected on this page")).toBe(false);
    expect(columnSource.includes("getCrawlerGroupLabel")).toBe(false);
    expect(columnSource.includes("contextBadge=")).toBe(false);
    expect(columnSource.includes("contextMeta=")).toBe(false);
    expect(columnSource.includes("footerMeta={error.resource}")).toBe(true);
  });

  test("uses alertes monitoring copy instead of monitoring alerte", () => {
    expect(utilsSource.includes("Monitoring alerte")).toBe(false);
    expect(utilsSource.includes("Alerte monitoring")).toBe(true);
  });

  test("keeps calculated monitoring diagnostics out of the error hub", () => {
    expect(source.includes("isErrorHubError")).toBe(true);
    expect(
      normalizedSource.includes(
        'error.source !== "monitoring" || error.origin !== "derived"',
      ),
    ).toBe(true);
    expect(
      normalizedSource.includes("errors={(data?.errors ?? []).filter(isErrorHubError)}"),
    ).toBe(true);
  });
});
