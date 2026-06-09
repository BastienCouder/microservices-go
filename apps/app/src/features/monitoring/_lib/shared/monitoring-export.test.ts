import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./monitoring-export.ts", import.meta.url)).text();

describe("monitoring export", () => {
  test("exports client-facing worksheets only", () => {
    expect(source.includes("Resume client")).toBe(true);
    expect(source.includes("Scores cles")).toBe(true);
    expect(source.includes("Visibilite modeles")).toBe(true);
    expect(source.includes("Visibilite marques")).toBe(true);
    expect(source.includes("Pages citees")).toBe(true);
  });

  test("does not export raw monitoring prompts, alerts, or internal ids", () => {
    expect(source.includes("promptId")).toBe(false);
    expect(source.includes("responseId")).toBe(false);
    expect(source.includes("response")).toBe(false);
    expect(source.includes("alerts")).toBe(false);
    expect(source.includes("Erreur")).toBe(false);
  });
});
