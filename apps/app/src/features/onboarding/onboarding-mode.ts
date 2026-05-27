import { readRouteQueryParam } from "@/shared/selection";
import type { OnboardingInitialState } from "@/hooks/use-onboarding";

export type OnboardingSetupMode = "account" | "project" | "resume";

export function getOnboardingSetupMode(routeSearch: string): OnboardingSetupMode {
  const setupMode = readRouteQueryParam(routeSearch, "setup");
  if (setupMode === "account" || setupMode === "project") {
    return setupMode;
  }
  return "resume";
}

export function shouldStartFreshOnboarding(routeSearch: string): boolean {
  return getOnboardingSetupMode(routeSearch) !== "resume";
}

export function createFreshOnboardingInitialState(): OnboardingInitialState {
  return {
    step: 1,
    organizationName: "",
    websiteUrl: "",
    attributionSource: "",
    brandName: "",
    brandShortDescription: "",
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
