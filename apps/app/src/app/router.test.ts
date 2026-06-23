import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./router.tsx", import.meta.url)).text();

describe("app router", () => {
  test("keeps only the error hub route for optimization issues", () => {
    expect(source.includes('path="/error-hub"')).toBe(true);
    expect(source.includes('path="/optimize/actions"')).toBe(false);
    expect(source.includes("PerceptionOptimizeActionsPage")).toBe(false);
  });

  test("passes project scope props to the content optimizer route", () => {
    expect(source.includes('path="/content-optimizer"')).toBe(true);
    expect(source.includes("<ContentOptimizerPage")).toBe(true);
    expect(source.includes("apiBaseURL={apiBaseURL}")).toBe(true);
    expect(source.includes("routeSearch={routeSearch}")).toBe(true);
  });

  test("removes the legacy crawler and AI agent ready routes", () => {
    expect(source.includes('path="/crawler"')).toBe(false);
    expect(source.includes('path="/ai-agent-ready"')).toBe(false);
    expect(source.includes("const CrawlerPage")).toBe(false);
    expect(source.includes("const AgentReadyPage")).toBe(false);
  });

  test("mounts admin routes through obfuscated paths and keeps legacy redirects", () => {
    expect(source.includes("ADMIN_ROUTE_ROOT")).toBe(true);
    expect(source.includes("adminRoutePaths.models")).toBe(true);
    expect(source.includes("adminRoutePaths.organizations")).toBe(true);
    expect(source.includes("adminRoutePaths.pricing")).toBe(true);
    expect(source.includes("legacyAdminRoutePaths.models")).toBe(true);
    expect(source.includes('path="/admin/models"')).toBe(false);
  });
});
