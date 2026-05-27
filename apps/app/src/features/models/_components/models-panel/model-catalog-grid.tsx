import { ModelCard } from "@/components/shared/model-card";
import { cn } from "@/lib/utils";

import {
  isProviderUsableWithCredentials,
  type ProviderCredentialLookup,
} from "../../_lib/catalog-client";
import type {
  LLMProviderCredentialStatus,
  ModelCatalogItem,
} from "../../_lib/model-access";

type ModelCatalogGridProps = {
  models: ModelCatalogItem[];
  selectedModelIdSet: Set<string>;
  selectionLimit: number;
  isDeveloperPlan: boolean;
  providerCredentialsReady: boolean;
  providerCredentials: LLMProviderCredentialStatus[];
  providerCredentialLookup: ProviderCredentialLookup;
  onToggleModel: (modelId: string) => void;
};

export function ModelCatalogGrid({
  models,
  selectedModelIdSet,
  selectionLimit,
  isDeveloperPlan,
  providerCredentialsReady,
  providerCredentials,
  providerCredentialLookup,
  onToggleModel,
}: ModelCatalogGridProps) {
  return (
    <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(220px,1fr))] items-stretch gap-4">
      {models.map((model) => {
        const isSelected = selectedModelIdSet.has(model.id);
        const disabledByPlan =
          !isSelected && selectedModelIdSet.size >= selectionLimit;
        const disabledByApiKey =
          isDeveloperPlan &&
          providerCredentialsReady &&
          !isProviderUsableWithCredentials(
            model.provider,
            providerCredentials,
            providerCredentialLookup,
          );
        const disabled = disabledByPlan || disabledByApiKey;

        return (
          <div key={model.id} className={cn("h-full min-w-0", disabled && "opacity-70")}>
            <ModelCard
              name={model.name}
              description={model.description}
              icon={model.icon}
              selected={isSelected}
              onClick={() => onToggleModel(model.id)}
              modelGroup={model.modelGroup}
              size="large"
              disabled={disabled}
              disabledLabel={
                disabledByApiKey
                  ? "Cle API requise"
                  : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}
