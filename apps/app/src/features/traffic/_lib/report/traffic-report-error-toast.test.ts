import { describe, expect, test } from "bun:test";

import { shouldToastTrafficReportError } from "./use-traffic-report-panel-view-model";

describe("shouldToastTrafficReportError", () => {
  test("does not show a toast while GA4 is not connected", () => {
    expect(
      shouldToastTrafficReportError({
        error: "Impossible de charger le rapport Traffic.",
        isConnected: false,
      }),
    ).toBe(false);
  });

  test("shows report errors once GA4 is connected", () => {
    expect(
      shouldToastTrafficReportError({
        error: "Connexion GA4 enregistrée. Le rapport est momentanément indisponible.",
        isConnected: true,
      }),
    ).toBe(true);
  });

  test("does not show a toast while the page is loading or saving", () => {
    expect(
      shouldToastTrafficReportError({
        error: "Connexion GA4 enregistrée. Le rapport est momentanément indisponible.",
        isConnected: true,
        isBusy: true,
      }),
    ).toBe(false);
  });
});
