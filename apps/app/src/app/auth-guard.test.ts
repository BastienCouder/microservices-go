import { describe, expect, test } from "bun:test";

import type { UserProfile } from "@/shared/models";
import {
  shouldRedirectAccountOnboardingToBilling,
  shouldRedirectAwayFromAccountOnboarding,
  shouldRedirectToBillingGate,
  shouldRedirectToOnboarding,
  shouldRedirectUnauthenticated,
} from "./auth-guard";

const user: UserProfile = {
  ID: 1,
  AuthIdentityID: "identity_1",
  Email: "user@example.com",
  FirstName: "User",
  LastName: "Example",
  Banned: false,
  CreatedAt: "2026-01-01T00:00:00Z",
};

describe("auth route guards", () => {
  test("redirects unauthenticated users to web auth once the session is settled", () => {
    expect(
      shouldRedirectUnauthenticated({
        apiBaseURL: "https://api.local",
        busy: false,
        user: null,
      }),
    ).toBe(true);
  });

  test("sends authenticated users without a paid organization to billing", () => {
    expect(
      shouldRedirectToBillingGate({
        apiBaseURL: "https://api.local",
        busy: false,
        user,
        isBillingRoute: false,
        isInvitationRoute: false,
        billingAccess: "missing_organization",
      }),
    ).toBe(true);

    expect(
      shouldRedirectToBillingGate({
        apiBaseURL: "https://api.local",
        busy: false,
        user,
        isBillingRoute: false,
        isInvitationRoute: false,
        billingAccess: "unpaid",
      }),
    ).toBe(true);
  });

  test("does not redirect paid organizations to billing", () => {
    expect(
      shouldRedirectToBillingGate({
        apiBaseURL: "https://api.local",
        busy: false,
        user,
        isBillingRoute: false,
        isInvitationRoute: false,
        billingAccess: "paid",
      }),
    ).toBe(false);
  });

  test("keeps onboarding redirect based on project availability", () => {
    expect(
      shouldRedirectToOnboarding({
        apiBaseURL: "https://api.local",
        busy: false,
        user,
        isOnboardingRoute: false,
        projectCount: 0,
      }),
    ).toBe(true);
  });

  test("blocks account onboarding once an organization already exists", () => {
    expect(
      shouldRedirectAwayFromAccountOnboarding({
        apiBaseURL: "https://api.local",
        busy: false,
        user,
        isOnboardingRoute: true,
        onboardingSetupMode: "account",
        organizationCount: 1,
        projectCount: 0,
      }),
    ).toBe(true);

    expect(
      shouldRedirectAwayFromAccountOnboarding({
        apiBaseURL: "https://api.local",
        busy: false,
        user,
        isOnboardingRoute: true,
        onboardingSetupMode: "account",
        organizationCount: 0,
        projectCount: 1,
      }),
    ).toBe(true);

    expect(
      shouldRedirectAwayFromAccountOnboarding({
        apiBaseURL: "https://api.local",
        busy: false,
        user,
        isOnboardingRoute: true,
        onboardingSetupMode: "project",
        organizationCount: 1,
        projectCount: 1,
      }),
    ).toBe(false);
  });

  test("allows account onboarding only after checkout success when unpaid", () => {
    expect(
      shouldRedirectAccountOnboardingToBilling({
        apiBaseURL: "https://api.local",
        busy: false,
        user,
        isOnboardingRoute: true,
        onboardingSetupMode: "account",
        billingAccess: "unpaid",
        isCheckoutSuccessRoute: false,
      }),
    ).toBe(true);

    expect(
      shouldRedirectAccountOnboardingToBilling({
        apiBaseURL: "https://api.local",
        busy: false,
        user,
        isOnboardingRoute: true,
        onboardingSetupMode: "account",
        billingAccess: "unpaid",
        isCheckoutSuccessRoute: true,
      }),
    ).toBe(false);

    expect(
      shouldRedirectAccountOnboardingToBilling({
        apiBaseURL: "https://api.local",
        busy: false,
        user,
        isOnboardingRoute: true,
        onboardingSetupMode: "project",
        billingAccess: "unpaid",
        isCheckoutSuccessRoute: false,
      }),
    ).toBe(false);
  });
});
