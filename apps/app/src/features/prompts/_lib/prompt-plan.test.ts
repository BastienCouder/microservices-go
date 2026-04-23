import { describe, expect, test } from "bun:test";

import {
  buildPromptPlanUsageSummary,
  buildSimulatedPromptPlanUsageSummary,
  getPromptPlanLimit,
} from "./prompt-plan";

describe("prompt plan usage", () => {
  test("returns the expected prompt limit for each simulated plan", () => {
    expect(getPromptPlanLimit("starter")).toBe(100);
    expect(getPromptPlanLimit("developer")).toBe(500);
    expect(getPromptPlanLimit("growth")).toBe(250);
    expect(getPromptPlanLimit("pro")).toBe(500);
    expect(getPromptPlanLimit("agency-enterprise")).toBe(5000);
  });

  test("builds a capped usage summary for the progress UI from a real server quota", () => {
    expect(buildPromptPlanUsageSummary({ limit: 500, usedPrompts: 120 })).toEqual({
      usedPrompts: 120,
      limit: 500,
      remainingPrompts: 380,
      progress: 24,
      isLimitReached: false,
    });
  });

  test("caps progress and remaining prompts when the quota is exceeded", () => {
    expect(buildPromptPlanUsageSummary({ limit: 250, usedPrompts: 320 })).toEqual({
      usedPrompts: 320,
      limit: 250,
      remainingPrompts: 0,
      progress: 100,
      isLimitReached: true,
    });
  });

  test("can still build a fallback summary from the simulated plan", () => {
    expect(buildSimulatedPromptPlanUsageSummary({ plan: "growth", usedPrompts: 120 })).toEqual({
      usedPrompts: 120,
      limit: 250,
      remainingPrompts: 130,
      progress: 48,
      isLimitReached: false,
    });
  });
});
