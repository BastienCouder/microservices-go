import { describe, expect, test } from "bun:test";

import {
  getOptimizationActionMatchIds,
  toCanonicalPerceptionSourceErrorId,
} from "./optimization-action-ids";

describe("optimization action ids", () => {
  test("stores perception source error ids with the same canonical id as error hub", () => {
    expect(toCanonicalPerceptionSourceErrorId("positioning_gap")).toBe("perception:positioning_gap");
    expect(toCanonicalPerceptionSourceErrorId("perception:positioning_gap")).toBe("perception:positioning_gap");
    expect(toCanonicalPerceptionSourceErrorId("monitoring:alert-1")).toBe("monitoring:alert-1");
  });

  test("matches persisted perception actions from both perception and error hub ids", () => {
    expect(getOptimizationActionMatchIds("positioning_gap")).toEqual([
      "positioning_gap",
      "perception:positioning_gap",
    ]);
    expect(getOptimizationActionMatchIds("perception:positioning_gap")).toEqual([
      "perception:positioning_gap",
      "positioning_gap",
    ]);
  });
});
