import { describe, expect, test } from "bun:test";

import { normalizeSchedule } from "./prompt-schedule";

describe("normalizeSchedule", () => {
  test("drops per-model overrides that match the global cadence", () => {
    expect(
      normalizeSchedule(
        {
          mode: "per_model",
          cron: "0 */6 * * *",
          timezone: "UTC",
          modelCrons: {
            "anthropic-claude-opus-4-6": "0 */6 * * *",
            "deepseek-deepseek-chat": "0 9 * * *",
          },
        },
        ["anthropic-claude-opus-4-6", "deepseek-deepseek-chat"],
      ).modelCrons,
    ).toEqual({
      "deepseek-deepseek-chat": "0 9 * * *",
    });
  });
});
