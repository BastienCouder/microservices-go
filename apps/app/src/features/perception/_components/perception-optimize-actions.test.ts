import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./perception-optimize-actions.tsx", import.meta.url)).text();

describe("PerceptionOptimizeActions", () => {
  test("uses colored badges for generated brief priority and status", () => {
    expect(source.includes("getPerceptionPriorityTone(draft.priority)")).toBe(true);
    expect(source.includes("getPerceptionActionStatusTone(draft.status)")).toBe(true);
    expect(source.includes("function getPriorityTone")).toBe(false);
    expect(source.includes("function getActionStatusTone")).toBe(false);
  });
});
