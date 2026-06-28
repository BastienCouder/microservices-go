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
    expect(source.includes("if (bypassResolvedContext) return;")).toBe(true);
    expect(source.includes("!resolvedProjectContext &&")).toBe(true);
    expect(source.includes("clearSelectedProjectContext();")).toBe(true);
  });

  test("keeps scoped organization and project context on every app page", () => {
    expect(source.includes("useCompactProjectContext")).toBe(false);
    expect(source.includes("keepProjectOnlyContextSearch")).toBe(false);
    expect(source.includes('location.pathname === "/organizations"')).toBe(false);
    expect(source.includes('location.pathname === "/account"')).toBe(false);
    expect(source.includes('location.pathname === "/brand-canon"')).toBe(false);
  });

  test("stores only canonical project ids in the persisted project context", () => {
    expect(source.includes("const routeProjectId = useMemo(")).toBe(true);
    expect(source.includes("storeSelectedProjectID(routeProjectId);")).toBe(true);
    expect(source.includes("storeLastSelectedProjectToken(")).toBe(false);
  });

  test("keeps slug-only project urls clean when the route is already readable", () => {
    expect(source.includes("applyResolvedProjectContextSearch(baseRouteSearch, resolvedProjectContext)")).toBe(true);
    expect(source.includes('routeProjectToken !== "" && routeProjectId === "" && routeOrganizationToken === ""')).toBe(false);
    expect(source.includes("buildScopedHref(location.pathname")).toBe(false);
  });

  test("waits for a newly created project context before running route guards", () => {
    expect(source.includes("const isRouteProjectContextPending =")).toBe(true);
    expect(source.includes("if (isRouteProjectContextPending) {")).toBe(true);
  });
});
