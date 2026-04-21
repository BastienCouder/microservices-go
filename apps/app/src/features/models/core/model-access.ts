import { SELECTED_ORG_KEY } from "@/shared/selection";
import {
  getBillingPlanLabel,
  type SimulatedPlan,
} from "@/shared/billing-plan";

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
export type { SimulatedPlan };
export const getPlanLabel = getBillingPlanLabel;

export function readSelectedOrganizationId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(SELECTED_ORG_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}
