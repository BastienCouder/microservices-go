import { describe, expect, test } from "bun:test";

import { promptCadenceLabel } from "./utils";
import type { PromptItem } from "./types";

const basePrompt: PromptItem = {
  id: "prompt-1",
  sourcePromptId: "prompt-1",
  rowMode: "global",
  prompt: "How visible is the brand?",
  language: "en",
  kind: "monitoring",
  stage: "Awareness",
  models: ["anthropic-claude-opus-4-6", "deepseek-deepseek-chat"],
  schedule: {
    mode: "per_model",
    cron: "0 9 * * 1,4",
    timezone: "UTC",
    modelCrons: {
      "anthropic-claude-opus-4-6": "0 */6 * * *",
      "deepseek-deepseek-chat": "0 9 * * *",
    },
  },
  effectiveCron: "0 9 * * 1,4",
  effectiveScheduleLabel: "",
  effectiveScheduleSource: "global",
  mentionRate: 0,
  rank: null,
  sov: 0,
  lastRunMinutes: 999999,
  trend30d: [],
  runs: [],
  status: "active",
};

describe("promptCadenceLabel", () => {
  test("shows custom cadence count for global prompt rows with per-AI cadences", () => {
    expect(promptCadenceLabel(basePrompt, "en")).toBe("2 AI with a custom cadence");
  });

  test("shows the effective cadence for model prompt rows", () => {
    expect(
      promptCadenceLabel(
        {
          ...basePrompt,
          rowMode: "model",
          models: ["deepseek-deepseek-chat"],
          effectiveCron: "0 9 * * *",
          effectiveScheduleSource: "override",
        },
        "en",
      ),
    ).toBe("Every day at 09:00");
  });

  test("recognizes every-two-days cadences with padded time fields", () => {
    expect(
      promptCadenceLabel(
        {
          ...basePrompt,
          schedule: {
            ...basePrompt.schedule,
            mode: "global",
            cron: "00 09 */2 * *",
            modelCrons: {},
          },
          effectiveCron: "00 09 */2 * *",
        },
        "en",
      ),
    ).toBe("Every two days at 09:00");
  });
});
