import { describe, expect, test } from "bun:test";

import { comparePromptRunsByRecency } from "./utils";

describe("comparePromptRunsByRecency", () => {
  test("sorts by exact createdAt before falling back to relative minutes", () => {
    const rows = [
      {
        id: "older",
        createdAt: "2026-05-24T10:00:00Z",
        minutesAgo: 60,
      },
      {
        id: "newer",
        createdAt: "2026-05-24T10:45:00Z",
        minutesAgo: 60,
      },
      {
        id: "fallback",
        createdAt: undefined,
        minutesAgo: 30,
      },
    ];

    const sorted = [...rows].sort(comparePromptRunsByRecency);

    expect(sorted.map((row) => row.id)).toEqual(["fallback", "newer", "older"]);
  });
});
