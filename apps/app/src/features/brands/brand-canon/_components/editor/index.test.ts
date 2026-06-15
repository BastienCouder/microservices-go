import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./index.tsx", import.meta.url)).text();

describe("brand canon editor", () => {
  test("patches the perception cache with the saved canon before navigating back", () => {
    expect(source.includes("queryClient.setQueryData<PerceptionLoadResult | undefined>")).toBe(true);
    expect(source.includes("brandCanon: {")).toBe(true);
    expect(source.includes("competitors: nextCompetitors.map")).toBe(true);
  });

  test("updates both slug and canonical project perception caches after save", () => {
    expect(source.includes("routeProjectToken !== initialData.metadata.projectId")).toBe(true);
    expect(source.includes("for (const queryKey of perceptionKeys)")).toBe(true);
    expect(source.includes("await invalidateQueryKeys(queryClient, perceptionKeys)")).toBe(true);
  });
});
