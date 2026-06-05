import { describe, expect, test } from "bun:test";

import { canUseClientExports } from "./export-entitlements";

describe("export entitlements", () => {
  test("allows exports only on Growth and Agency plans", () => {
    expect(canUseClientExports("growth")).toBe(true);
    expect(canUseClientExports("pro")).toBe(true);
    expect(canUseClientExports("agency")).toBe(true);
    expect(canUseClientExports("agency-enterprise")).toBe(true);
    expect(canUseClientExports("starter")).toBe(false);
    expect(canUseClientExports("developer")).toBe(false);
    expect(canUseClientExports(null)).toBe(false);
  });
});
