import { afterEach, describe, expect, test } from "bun:test";

import {
  claimGA4OAuthCallbackState,
  clearGA4OAuthCallbackStateClaims,
  releaseGA4OAuthCallbackState,
} from "./ga4-oauth-callback-state";

afterEach(() => {
  clearGA4OAuthCallbackStateClaims();
});

describe("GA4 OAuth callback state claims", () => {
  test("prevents the same callback state from being claimed twice while in flight", () => {
    expect(claimGA4OAuthCallbackState(" state-1 ")).toBe(true);
    expect(claimGA4OAuthCallbackState("state-1")).toBe(false);

    releaseGA4OAuthCallbackState("state-1");

    expect(claimGA4OAuthCallbackState("state-1")).toBe(true);
  });
});
