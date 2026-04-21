import { describe, expect, test } from "bun:test";

import {
  getInitialVisiblePromptsCount,
  getNextVisiblePromptsCount,
  PROMPTS_STREAM_BATCH_SIZE,
} from "./activity-prompts-stream-state";

describe("activity prompts stream state", () => {
  test("starts from the preview count and caps to the available prompts", () => {
    expect(getInitialVisiblePromptsCount(5, 12)).toBe(5);
    expect(getInitialVisiblePromptsCount(5, 3)).toBe(3);
    expect(getInitialVisiblePromptsCount(5, 0)).toBe(0);
  });

  test("loads the next batch without exceeding the available prompts", () => {
    expect(
      getNextVisiblePromptsCount({
        currentCount: 5,
        totalCount: 40,
      }),
    ).toBe(5 + PROMPTS_STREAM_BATCH_SIZE);

    expect(
      getNextVisiblePromptsCount({
        currentCount: 18,
        totalCount: 22,
      }),
    ).toBe(22);
  });

  test("keeps the current count when every prompt is already visible", () => {
    expect(
      getNextVisiblePromptsCount({
        currentCount: 12,
        totalCount: 12,
      }),
    ).toBe(12);
  });
});
