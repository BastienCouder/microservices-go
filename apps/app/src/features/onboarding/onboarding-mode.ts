import {
  readOrganizationIdFromSearch,
  readRouteQueryParam,
  readSelectedOrganizationID,
} from "@/shared/selection";
import type { OnboardingInitialState } from "@/hooks/use-onboarding";

export type OnboardingSetupMode = "account" | "project" | "resume";

export const ACCOUNT_SETUP_SEARCH = "?setup-account";
export const PROJECT_SETUP_SEARCH = "?setup=project";
const PENDING_ACCOUNT_SETUP_ORGANIZATION_KEY =
  "app:pending-account-setup-organization-id";

export function readPendingAccountSetupOrganizationId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage
      .getItem(PENDING_ACCOUNT_SETUP_ORGANIZATION_KEY)
      ?.trim() ?? "";
  } catch {
    return "";
  }
}

export function markAccountSetupPending(organizationId: string): void {
  if (typeof window === "undefined") return;
  const normalizedOrganizationId = organizationId.trim();
  if (!normalizedOrganizationId) return;
  try {
    window.sessionStorage.setItem(
      PENDING_ACCOUNT_SETUP_ORGANIZATION_KEY,
      normalizedOrganizationId,
    );
  } catch {
    // The checkout URL still keeps the current navigation in account setup.
  }
}

export function clearPendingAccountSetup(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_ACCOUNT_SETUP_ORGANIZATION_KEY);
  } catch {
    // Ignore storage cleanup failures after onboarding completion.
  }
}

export function getOnboardingSetupMode(routeSearch: string): OnboardingSetupMode {
  const normalized = routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch;
  const params = new URLSearchParams(normalized);
  if (params.has("setup-account") || params.get("checkout") === "success") {
    return "account";
  }

  const setupMode = readRouteQueryParam(routeSearch, "setup");
  if (setupMode === "account" || setupMode === "project") {
    return setupMode;
  }
  return "resume";
}

export function shouldStartFreshOnboarding(routeSearch: string): boolean {
  const setupMode = getOnboardingSetupMode(routeSearch);
  if (setupMode === "resume") return false;
  if (setupMode === "account" && readPendingAccountSetupOrganizationId()) {
    return false;
  }
  return true;
}

export function resolveOnboardingOrganizationId(routeSearch: string): string {
  return (
    readOrganizationIdFromSearch(routeSearch) ||
    readSelectedOrganizationID()
  ).trim();
}

export function createFreshOnboardingInitialState(): OnboardingInitialState {
  return {
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
  };
}
