import { describe, expect, test } from "bun:test";

const billingGateSource = await Bun.file(
  new URL("../features/billing-gate/_lib/pricing/use-billing-gate-view-model.ts", import.meta.url),
).text();
const trafficSource = await Bun.file(
  new URL("../features/traffic/_lib/report/use-traffic-report-panel-view-model.ts", import.meta.url),
).text();
const webAuthSource = await Bun.file(
  new URL("../shared/auth/web-auth.ts", import.meta.url),
).text();
const monitoringActivitySource = await Bun.file(
  new URL("../features/monitoring/_components/activity/index.tsx", import.meta.url),
).text();

describe("navigation policy", () => {
  test("keeps imperative browser redirects only for external flows", () => {
    expect(billingGateSource.includes("window.location.assign(checkoutURL)")).toBe(true);
    expect(trafficSource.includes("window.location.assign(response.authorizationUrl)")).toBe(true);
    expect(webAuthSource.includes("window.location.replace(getWebAuthURL())")).toBe(true);
    expect(webAuthSource.includes("window.location.replace(destination)")).toBe(true);
  });

  test("uses SPA navigation for internal app routes", () => {
    expect(monitoringActivitySource.includes("window.location.assign(`/prompts?${params.toString()}`)")).toBe(false);
    expect(monitoringActivitySource.includes("navigate(`/prompts?${params.toString()}`)")).toBe(true);
  });
});
