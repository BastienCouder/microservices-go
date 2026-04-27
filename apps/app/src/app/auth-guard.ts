import type { UserProfile } from "@/shared/models";

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
  projectCount: number | null;
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
  projectCount,
}: ShouldRedirectToOnboardingInput): boolean {
  if (apiBaseURL.trim() === "") {
    return false;
  }
  if (busy || user === null || isOnboardingRoute) {
    return false;
  }
  if (projectCount === null) {
    return false;
  }
  return projectCount === 0;
}
