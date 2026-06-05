import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./traffic-export.ts", import.meta.url)).text();

describe("traffic export", () => {
  test("exports readable client worksheets", () => {
    expect(source.includes("Resume client")).toBe(true);
    expect(source.includes("Scores cles")).toBe(true);
    expect(source.includes("Sources IA")).toBe(true);
    expect(source.includes("Pages d'entree")).toBe(true);
    expect(source.includes("Evolution")).toBe(true);
  });

  test("does not export internal identifiers or GA4 integration secrets", () => {
    expect(source.includes("projectId")).toBe(false);
    expect(source.includes("propertyId")).toBe(false);
    expect(source.includes("serviceAccountJSON")).toBe(false);
    expect(source.includes("organizationId")).toBe(false);
  });
});
