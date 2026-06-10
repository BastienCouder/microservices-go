import { storeSelectedOrganizationID } from "@/shared/selection";

export function buildCreateProjectOnboardingHref(): string {
  const params = new URLSearchParams({ setup: "project" });
  return `/onboarding?${params.toString()}`;
}

export function prepareCreateProjectOnboardingContext(organizationId: string): void {
  const normalizedOrganizationId = organizationId.trim();
  if (normalizedOrganizationId) {
    storeSelectedOrganizationID(normalizedOrganizationId);
  }
}
