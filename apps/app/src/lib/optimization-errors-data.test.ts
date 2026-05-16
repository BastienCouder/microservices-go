import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./optimization-errors-data.ts", import.meta.url)).text();

describe("optimization errors data loader", () => {
  test("uses the backend optimization errors response as the only error source", () => {
    expect(source.includes("loadPerceptionData")).toBe(false);
    expect(source.includes("derivePerceptionTopErrorsFromResponses")).toBe(false);
    expect(source.includes("mergePerceptionTopErrorsIntoOptimizationBoard")).toBe(false);
  });
});
