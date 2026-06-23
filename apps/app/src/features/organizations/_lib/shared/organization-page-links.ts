import { PROJECT_SETUP_SEARCH } from "@/features/onboarding/onboarding-mode";
import { storeSelectedOrganizationID } from "@/shared/selection";

export function buildCreateProjectOnboardingHref(): string {
  return `/onboarding${PROJECT_SETUP_SEARCH}`;
}

export function prepareCreateProjectOnboardingContext(organizationId: string): void {
  const normalizedOrganizationId = organizationId.trim();
  if (normalizedOrganizationId) {
    storeSelectedOrganizationID(normalizedOrganizationId);
  }
}
