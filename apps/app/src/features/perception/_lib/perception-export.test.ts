import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./perception-export.ts", import.meta.url)).text();

describe("perception export", () => {
  test("keeps the workbook client-facing instead of exposing internal ids", () => {
    expect(source.includes('"Run"')).toBe(false);
    expect(source.includes('"Prompt run"')).toBe(false);
    expect(source.includes("response.runId")).toBe(false);
    expect(source.includes("response.promptRunId")).toBe(false);
  });

  test("exports readable client worksheets", () => {
    expect(source.includes("Resume client")).toBe(true);
    expect(source.includes("Profil de marque")).toBe(true);
    expect(source.includes("Scores cles")).toBe(true);
    expect(source.includes("Axes de perception")).toBe(true);
    expect(source.includes("Scores par modele")).toBe(true);
    expect(source.includes("Evolution")).toBe(true);
  });

  test("does not export low-value detail sheets or removed client fields", () => {
    expect(source.includes("Signaux IA")).toBe(false);
    expect(source.includes("Priorites")).toBe(false);
    expect(source.includes("Plan d'action")).toBe(false);
    expect(source.includes("Reponses analysees")).toBe(false);
    expect(source.includes("Source")).toBe(false);
    expect(source.includes("Audience cible")).toBe(false);
    expect(source.includes("Prix / offre")).toBe(false);
    expect(source.includes("Concurrents suivis")).toBe(false);
  });
});
