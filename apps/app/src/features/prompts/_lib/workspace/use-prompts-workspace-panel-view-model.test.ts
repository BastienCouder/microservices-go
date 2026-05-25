import { describe, expect, test } from "bun:test";

import { findPromptEditorSource } from "./use-prompts-workspace-panel-view-model";
import type { PromptItem } from "../types";

function makePrompt(overrides?: Partial<PromptItem>): PromptItem {
  return {
    id: "prompt-1",
    sourcePromptId: "prompt-1",
    rowMode: "global",
    prompt: "How visible is the brand?",
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
    ...overrides,
  };
}

describe("findPromptEditorSource", () => {
  test("prefers the canonical global prompt over a model-scoped row", () => {
    const canonical = makePrompt();
    const modelRow = makePrompt({
      id: "prompt-1::deepseek-deepseek-chat",
      rowMode: "model",
      models: ["deepseek-deepseek-chat"],
      effectiveCron: "0 9 * * *",
      effectiveScheduleSource: "override",
    });

    expect(findPromptEditorSource("prompt-1", [canonical], [modelRow])).toEqual(
      canonical,
    );
  });
});
