import { SELECTED_ORG_KEY } from "@/shared/selection";
import {
  getBillingPlanLabel,
  type SimulatedPlan,
} from "@/shared/billing-plan";

export type ModelsProjectSummary = {
  id: string;
  slug: string;
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

export type LLMProviderCredentialStatus = {
  provider: string;
  label: string;
  hasApiKey: boolean;
  updatedAt: string;
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

export type OpenRouterModelSyncInput = {
  onlyFree?: boolean;
  minContext?: number;
  supportsTools?: boolean;
  variant?: "all" | "chat" | "instruct";
  providers?: string[];
  searchQuery?: string;
  activateImported?: boolean;
  purgeUnsupportedProviders?: boolean;
  purgeMissingModels?: boolean;
};

export type OpenRouterModelSyncResult = {
  imported: number;
  created: number;
  updated: number;
  purged: number;
  models: ModelCatalogItem[];
};

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
