import { describe, expect, test } from "bun:test";

import {
  buildCreateProjectOnboardingHref,
  prepareCreateProjectOnboardingContext,
} from "./organization-page-links";

describe("organization page links", () => {
  test("starts project onboarding without exposing the organization id in the URL", () => {
    expect(buildCreateProjectOnboardingHref()).toBe("/onboarding?setup=project");
  });

  test("stores the organization context before project onboarding navigation", () => {
    const storage = new Map<string, string>();
    const previousWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
          removeItem: (key: string) => storage.delete(key),
        },
        dispatchEvent: () => undefined,
      },
    });

    try {
      prepareCreateProjectOnboardingContext("org 42");
      expect(storage.get("selected-organization-id")).toBe("org 42");
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
    }
  });
});
