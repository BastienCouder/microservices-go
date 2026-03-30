import { SELECTED_ORG_KEY } from "@/shared/selection";

export type SimulatedPlan = "starter" | "growth" | "pro" | "agency-enterprise";

export type ModelsProjectSummary = {
  id: string;
  name: string;
  brandName: string;
  status: string;
};

export type ModelCatalogItem = {
  id: string;
  modelGroup: string;
  name: string;
  provider: string;
  providerModelId: string;
  iconKey: string;
  description: string;
  icon: string;
  isActive: boolean;
  supportsLiveSearch: boolean;
};

export type CatalogModelPayload = {
  id: string;
  displayName: string;
  provider: string;
  groupName: string;
  iconKey: string;
  providerModelId: string;
  isActive: boolean;
  supportsLiveSearch: boolean;
};

export type CatalogModelUpdatePayload = Partial<Omit<CatalogModelPayload, "id">>;

export { SELECTED_ORG_KEY };
export const SIM_PLAN_KEY_PREFIX = "simulated-billing-plan:";

export function normalizeStoredPlan(rawPlan: string | null): SimulatedPlan {
  if (rawPlan === "starter" || rawPlan === "growth" || rawPlan === "pro" || rawPlan === "agency-enterprise") {
    return rawPlan;
  }
  if (rawPlan === "free") return "starter";
  if (rawPlan === "pro-monthly") return "growth";
  if (rawPlan === "pro-yearly") return "pro";
  return "starter";
}

export function getPlanLabel(plan: SimulatedPlan): string {
  if (plan === "starter") return "Demarrage";
  if (plan === "growth") return "Croissance";
  if (plan === "pro") return "Pro";
  return "Agence / Entreprise";
}

export function getPlanLimit(plan: SimulatedPlan, availableModelsCount: number): number {
  if (availableModelsCount <= 0) return 0;
  if (plan === "starter") return Math.min(3, availableModelsCount);
  if (plan === "growth") return Math.min(6, availableModelsCount);
  return availableModelsCount;
}

export function readSelectedOrganizationId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(SELECTED_ORG_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}
