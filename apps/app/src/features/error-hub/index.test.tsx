import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./index.tsx", import.meta.url)).text();
const columnSource = await Bun.file(
  new URL("./_components/error-hub-column.tsx", import.meta.url),
).text();
const utilsSource = await Bun.file(
  new URL("./_lib/error-hub-utils.ts", import.meta.url),
).text();
const normalizedSource = source.replace(/\s+/g, " ");

describe("error hub", () => {
  test("opens perception-style detail sheets from kanban cards", () => {
    expect(source.includes("ErrorDetailsContent")).toBe(true);
    expect(source.includes("const [selectedError, setSelectedError]")).toBe(
      true,
    );
    expect(
      source.includes("onOpenDetails={() => setSelectedError(error)}"),
    ).toBe(true);
    expect(
      normalizedSource.includes("<Sheet open={selectedError !== null}"),
    ).toBe(true);
    expect(
      normalizedSource.includes("<Drawer open={selectedError !== null}"),
    ).toBe(true);
    expect(
      source.includes(
        "actionStatus={actionStatusesByErrorId.get(selectedError.id)}",
      ),
    ).toBe(true);
    expect(
      source.includes(
        "onMarkActionDone={() => void onMarkDone(selectedError)}",
      ),
    ).toBe(true);
    expect(source.includes("ACTION_STATUS_OPTIONS")).toBe(true);
    expect(source.includes("filterErrorsByActionStatus")).toBe(true);
    expect(source.includes("setActionStatusFilter")).toBe(true);
    expect(source.includes("sortErrorsByActionStatus")).toBe(true);
    expect(source.includes('if (status === "processing") return 0;')).toBe(
      true,
    );
    expect(source.includes('if (status === "done") return 2;')).toBe(true);
    expect(source.includes("SOURCE_OPTIONS")).toBe(true);
    expect(source.includes('value: "crawler"')).toBe(true);
    expect(source.includes("filterErrorsBySource")).toBe(true);
    expect(source.includes("setSourceFilter")).toBe(true);
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
});
