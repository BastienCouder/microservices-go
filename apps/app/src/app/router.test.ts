import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./router.tsx", import.meta.url)).text();

describe("app router", () => {
  test("exposes the optimization actions page route", () => {
    expect(source.includes('path="/optimize/actions"')).toBe(true);
    expect(source.includes("PerceptionOptimizeActionsPage")).toBe(true);
  });
});
