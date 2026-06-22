import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./optimization-errors-data.ts", import.meta.url)).text();

describe("optimization errors data loader", () => {
  test("uses the backend optimization errors response as the only error source", () => {
    expect(source.includes("loadPerceptionData")).toBe(false);
    expect(source.includes("derivePerceptionOptimizationErrors")).toBe(false);
    expect(source.includes("mergePerceptionOptimizationErrorsIntoOptimizationBoard")).toBe(false);
    expect(source.includes('"crawler"')).toBe(true);
    expect(source.includes('"alert"')).toBe(true);
    expect(source.includes('"derived"')).toBe(true);
    expect(source.includes("crawlerErrors")).toBe(true);
  });
});
