import { describe, expect, test } from "bun:test";

import { buildFallbackSovPercentages } from "./brand-visibility-utils";

describe("buildFallbackSovPercentages", () => {
  test("never returns a negative project share when competitor fallback SOV exceeds 100", () => {
    const shares = buildFallbackSovPercentages(
      [
        { name: "My Brand", isCompetitor: false },
        { name: "Competitor A", isCompetitor: true },
        { name: "Competitor B", isCompetitor: true },
      ],
      new Map([
        ["Competitor A", 70],
        ["Competitor B", 128],
      ]),
    );

    expect(shares.get("My Brand")).toBe(0);
    expect((shares.get("Competitor A") ?? -1) >= 0).toBe(true);
    expect((shares.get("Competitor B") ?? -1) >= 0).toBe(true);
    expect((shares.get("Competitor A") ?? 0) + (shares.get("Competitor B") ?? 0) + (shares.get("My Brand") ?? 0)).toBe(100);
  });

  test("keeps the project share when competitor fallback SOV stays below 100", () => {
    const shares = buildFallbackSovPercentages(
      [
        { name: "My Brand", isCompetitor: false },
        { name: "Competitor A", isCompetitor: true },
        { name: "Competitor B", isCompetitor: true },
      ],
      new Map([
        ["Competitor A", 20],
        ["Competitor B", 15],
      ]),
    );

    expect(shares).toEqual(new Map([
      ["Competitor A", 20],
      ["Competitor B", 15],
      ["My Brand", 65],
    ]));
  });
});
