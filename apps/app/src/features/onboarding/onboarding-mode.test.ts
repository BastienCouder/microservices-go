import { describe, expect, test } from "bun:test";

import {
  createFreshOnboardingInitialState,
  getOnboardingSetupMode,
  shouldStartFreshOnboarding,
} from "./onboarding-mode";

describe("onboarding mode", () => {
  test("treats account and project setup routes as fresh onboarding starts", () => {
    expect(shouldStartFreshOnboarding("?setup=account")).toBe(true);
    expect(shouldStartFreshOnboarding("?setup=project")).toBe(true);
    expect(shouldStartFreshOnboarding("")).toBe(false);
  });

  test("clears persisted model selections for fresh onboarding starts", () => {
    expect(createFreshOnboardingInitialState()).toEqual({
      step: 1,
      organizationName: "",
      websiteUrl: "",
      attributionSource: "",
      brandName: "",
      brandShortDescription: "",
      brandDescription: "",
      industry: "",
      keyFeatures: [],
      brandPersonas: [],
      competitors: [],
      selectedPrompts: [],
      selectedModels: [],
      brandPreparationCompleted: false,
    });
  });

  test("normalizes unknown setup modes to resume", () => {
    expect(getOnboardingSetupMode("?setup=account")).toBe("account");
    expect(getOnboardingSetupMode("?setup=project")).toBe("project");
    expect(getOnboardingSetupMode("?setup=other")).toBe("resume");
  });
});
