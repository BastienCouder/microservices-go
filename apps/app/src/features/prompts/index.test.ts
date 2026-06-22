import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./index.tsx", import.meta.url)).text();

describe("PromptsPage", () => {
  test("uses the live router search as the prompts route source of truth", () => {
    expect(source.includes("useLocation")).toBe(true);
    expect(source.includes("const effectiveRouteSearch = location.search || routeSearch")).toBe(true);
    expect(source.includes("routeSearch={effectiveRouteSearch}")).toBe(true);
  });
});
