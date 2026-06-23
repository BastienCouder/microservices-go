import {
  readOrganizationIdFromSearch,
  readRouteQueryParam,
  readSelectedOrganizationID,
} from "@/shared/selection";
import type { OnboardingInitialState } from "@/hooks/use-onboarding";

export type OnboardingSetupMode = "account" | "project" | "resume";

export const ACCOUNT_SETUP_SEARCH = "?setup-account";
export const PROJECT_SETUP_SEARCH = "?setup=project";

export function getOnboardingSetupMode(routeSearch: string): OnboardingSetupMode {
  const normalized = routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch;
  const params = new URLSearchParams(normalized);
  if (params.has("setup-account")) {
    return "account";
  }

  const setupMode = readRouteQueryParam(routeSearch, "setup");
  if (setupMode === "account" || setupMode === "project") {
    return setupMode;
  }
  return "resume";
}

export function shouldStartFreshOnboarding(routeSearch: string): boolean {
  return getOnboardingSetupMode(routeSearch) !== "resume";
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
