import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./sidebar.tsx", import.meta.url)).text();

describe("sidebar navigation", () => {
  test("exposes optimization actions in the desktop sidebar", () => {
    expect(source.includes("optimizeActions")).toBe(true);
    expect(source.includes('"/optimize/actions"')).toBe(true);
  });
});
