import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./App.tsx", import.meta.url)).text();

describe("app onboarding guard", () => {
  test("checks project availability for account onboarding without waiting for billing entitlements", () => {
    expect(source.includes("shouldCheckAccountOnboardingProjectGuard")).toBe(true);
    expect(source.includes('onboardingSetupMode === "account"')).toBe(true);
    expect(source.includes("shouldCheckAccountOnboardingProjectGuard ||")).toBe(true);
    expect(
      source.includes("user !== null &&\n      billingAccess === \"paid\" &&"),
    ).toBe(false);
  });

  test("uses a dedicated admin layout and bypasses admin project context resolution", () => {
    expect(source.includes("const isAdminRoute = isAnyAdminRoutePath(location.pathname);")).toBe(true);
    expect(source.includes("isOnboardingRoute || isInvitationRoute || isBillingRoute || isAdminRoute")).toBe(true);
    expect(source.includes("<AdminLayout busy={busy} onLogout={logout}>")).toBe(true);
  });

  test("clears stale route project context after a user or organization switch", () => {
    expect(source.includes("const hasUnresolvedRouteProjectContext =")).toBe(true);
    expect(source.includes("return clearProjectContextSearch(baseRouteSearch);")).toBe(true);
    expect(source.includes("!routeProjectContextQuery.isFetching")).toBe(true);
    expect(source.includes("if (!useCompactProjectContext && !hasUnresolvedRouteProjectContext) return;")).toBe(true);
    expect(source.includes("clearSelectedProjectContext();")).toBe(true);
  });

  test("keeps the brand canon route on slug-only project context", () => {
    expect(source.includes('location.pathname === "/brand-canon"')).toBe(true);
  });

  test("stores only canonical project ids in the persisted project context", () => {
    expect(source.includes("const routeProjectId = useMemo(")).toBe(true);
    expect(source.includes("storeSelectedProjectID(routeProjectId);")).toBe(true);
    expect(source.includes("storeLastSelectedProjectToken(")).toBe(false);
  });
});
