import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./index.tsx", import.meta.url)).text();

describe("traffic report panel", () => {
  test("adds a client-facing Excel export action to the report controls", () => {
    expect(source.includes("Export Excel")).toBe(true);
    expect(source.includes("Download")).toBe(true);
    expect(source.includes("vm.canExport")).toBe(true);
    expect(source.includes("vm.exportDisabled")).toBe(true);
    expect(source.includes("vm.exportTrafficData")).toBe(true);
  });
});
