import { describe, expect, test } from "bun:test";

import {
  createFreshOnboardingInitialState,
  getOnboardingSetupMode,
  resolveOnboardingOrganizationId,
  shouldStartFreshOnboarding,
} from "./onboarding-mode";

describe("onboarding mode", () => {
  test("treats account and project setup routes as fresh onboarding starts", () => {
    expect(shouldStartFreshOnboarding("?setup-account")).toBe(true);
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
    expect(getOnboardingSetupMode("?setup-account")).toBe("account");
    expect(getOnboardingSetupMode("?setup=account")).toBe("account");
    expect(getOnboardingSetupMode("?setup=project")).toBe("project");
    expect(getOnboardingSetupMode("?setup=other")).toBe("resume");
  });

  test("reuses the selected organization during account onboarding when checkout already created it", () => {
    const storage = new Map<string, string>([
      ["selected-organization-id", "5"],
    ]);
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: () => {},
          removeItem: () => {},
        },
      },
    });

    expect(resolveOnboardingOrganizationId("?setup=account")).toBe("5");

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });

  test("uses the internal organization id for onboarding API calls", () => {
    const storage = new Map<string, string>([
      ["selected-organization-id", "42"],
      ["selected-organization-public-id", "org_public_42"],
    ]);
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: () => {},
          removeItem: () => {},
        },
      },
    });

    expect(resolveOnboardingOrganizationId("?setup=project")).toBe("42");

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });

  test("prefers the organization from the route when onboarding is explicitly scoped", () => {
    expect(resolveOnboardingOrganizationId("?setup=account&organizationId=42")).toBe("42");
  });
});
