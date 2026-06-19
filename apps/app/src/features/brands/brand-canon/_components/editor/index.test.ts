import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./index.tsx", import.meta.url)).text();

describe("brand canon editor", () => {
  test("keeps industry and full description as separate editable fields", () => {
    expect(source.includes('update("category", e.target.value)')).toBe(true);
    expect(source.includes('update("positioning", e.target.value)')).toBe(true);
  });

  test("patches the perception cache with the saved canon before navigating back", () => {
    expect(source.includes("queryClient.setQueryData<PerceptionLoadResult | undefined>")).toBe(true);
    expect(source.includes("brandCanon: {")).toBe(true);
    expect(source.includes("competitors: nextCompetitors.map")).toBe(true);
  });

  test("updates route and canonical project perception caches after save", () => {
    expect(source.includes("routeProjectToken ?? null")).toBe(true);
    expect(source.includes("routeProjectToken !== initialData.metadata.projectId")).toBe(true);
    expect(source.includes("for (const queryKey of perceptionKeys)")).toBe(true);
    expect(source.includes("...perceptionKeys")).toBe(true);
  });

  test("refreshes monitoring data after saving brand canon changes", () => {
    expect(source.includes('["perception", apiBaseURL]')).toBe(true);
    expect(source.includes('["monitoring", apiBaseURL]')).toBe(true);
  });
});
