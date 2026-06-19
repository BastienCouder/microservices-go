import { describe, expect, test } from "bun:test";

import { sanitizePersistedOnboardingState } from "./use-onboarding";

describe("sanitizePersistedOnboardingState", () => {
  test("keeps a persisted models step and selected models", () => {
    expect(
      sanitizePersistedOnboardingState({
        step: 5,
        selectedModels: ["openai-gpt-5", "anthropic-claude-4"],
        brandPreparationCompleted: true,
      }),
    ).toEqual({
      step: 5,
      organizationName: undefined,
      websiteUrl: undefined,
      attributionSource: undefined,
      brandName: undefined,
      brandDescription: undefined,
      industry: undefined,
      keyFeatures: undefined,
      brandPersonas: undefined,
      competitors: undefined,
      selectedPrompts: undefined,
      selectedModels: ["openai-gpt-5", "anthropic-claude-4"],
      brandPreparationCompleted: true,
    });
  });

  test("drops invalid persisted onboarding values", () => {
    expect(
      sanitizePersistedOnboardingState({
        step: "5",
        selectedModels: ["openai-gpt-5", 42],
        selectedPrompts: [{ text: "Prompt ok" }],
        competitors: [{ name: "Acme" }],
      }),
    ).toEqual({
      step: undefined,
      organizationName: undefined,
      websiteUrl: undefined,
      attributionSource: undefined,
      brandName: undefined,
      brandDescription: undefined,
      industry: undefined,
      keyFeatures: undefined,
      brandPersonas: undefined,
      competitors: [],
      selectedPrompts: [],
      selectedModels: undefined,
      brandPreparationCompleted: undefined,
    });
  });
});
