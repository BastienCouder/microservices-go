import { describe, expect, test } from "bun:test";

import { getTrafficTrendPresentation } from "./traffic-trend-presentation";
import type { TrafficDailyPoint } from "./types";

function buildPoints(count: number): TrafficDailyPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    date: `2026-05-${String(index + 1).padStart(2, "0")}`,
    sessions: index + 1,
    engagedSessions: index,
    conversions: 0,
  }));
}

describe("traffic trend presentation", () => {
  test("keeps desktop labels horizontal and reduces density when needed", () => {
    const presentation = getTrafficTrendPresentation(buildPoints(20), false);

    expect(presentation.points).toHaveLength(10);
    expect(presentation.points[0]?.date).toBe("2026-05-11");
    expect(presentation.showEveryLabel).toBe(2);
    expect(presentation.labelClassName.includes("text-center")).toBe(true);
    expect(presentation.chartClassName.includes("pb-5")).toBe(true);
  });

  test("reduces density on mobile and keeps every visible label readable", () => {
    const presentation = getTrafficTrendPresentation(buildPoints(20), true);

    expect(presentation.points).toHaveLength(5);
    expect(presentation.points[0]?.date).toBe("2026-05-16");
    expect(presentation.showEveryLabel).toBe(1);
    expect(presentation.labelClassName.includes("text-center")).toBe(true);
    expect(presentation.chartClassName.includes("h-44")).toBe(true);
  });
});
