import type { UserProfile } from "@/shared/models";
import type { OnboardingSetupMode } from "@/features/onboarding/onboarding-mode";

type ShouldRedirectUnauthenticatedInput = {
  apiBaseURL: string;
  busy: boolean;
  user: UserProfile | null;
};

type ShouldRedirectToOnboardingInput = {
  apiBaseURL: string;
  busy: boolean;
  user: UserProfile | null;
  isOnboardingRoute: boolean;
  isBillingRoute?: boolean;
  isInvitationRoute?: boolean;
  billingAccess?: BillingAccessState;
  projectCount: number | null;
};

type ShouldRedirectAwayFromAccountOnboardingInput = {
  apiBaseURL: string;
  busy: boolean;
  user: UserProfile | null;
  isOnboardingRoute: boolean;
  onboardingSetupMode: OnboardingSetupMode;
  projectCount: number | null;
};

export type BillingAccessState =
  | "loading"
  | "unknown"
  | "missing_organization"
  | "unpaid"
  | "paid";

type ShouldRedirectToBillingGateInput = {
  apiBaseURL: string;
  busy: boolean;
  user: UserProfile | null;
  isBillingRoute: boolean;
  isInvitationRoute: boolean;
  billingAccess: BillingAccessState;
};

export function shouldRedirectUnauthenticated({
  apiBaseURL,
  busy,
  user,
}: ShouldRedirectUnauthenticatedInput): boolean {
  if (apiBaseURL.trim() === "") {
    return false;
  }
  if (busy) {
    return false;
  }
  return user === null;
}

export function shouldRedirectToOnboarding({
  apiBaseURL,
  busy,
  user,
  isOnboardingRoute,
  isBillingRoute = false,
  isInvitationRoute = false,
  billingAccess = "unknown",
  projectCount,
}: ShouldRedirectToOnboardingInput): boolean {
  if (apiBaseURL.trim() === "") {
    return false;
  }
  if (
    busy ||
    user === null ||
    isOnboardingRoute ||
    isBillingRoute ||
    isInvitationRoute
  ) {
    return false;
  }
  if (billingAccess === "missing_organization") {
    return true;
  }
  if (projectCount === null) {
    return false;
  }
  return projectCount === 0;
}

export function shouldRedirectAwayFromAccountOnboarding({
  apiBaseURL,
  busy,
  user,
  isOnboardingRoute,
  onboardingSetupMode,
  projectCount,
}: ShouldRedirectAwayFromAccountOnboardingInput): boolean {
  if (apiBaseURL.trim() === "") {
    return false;
  }
  if (busy || user === null || !isOnboardingRoute) {
    return false;
  }
  if (onboardingSetupMode !== "account") {
    return false;
  }
  if (projectCount === null) {
    return false;
  }
  return projectCount > 0;
}

export function shouldRedirectToBillingGate({
  apiBaseURL,
  busy,
  user,
  isBillingRoute,
  isInvitationRoute,
  billingAccess,
}: ShouldRedirectToBillingGateInput): boolean {
  if (apiBaseURL.trim() === "") {
    return false;
  }
  if (busy || user === null || isBillingRoute || isInvitationRoute) {
    return false;
  }
  return billingAccess === "missing_organization" || billingAccess === "unpaid";
}
