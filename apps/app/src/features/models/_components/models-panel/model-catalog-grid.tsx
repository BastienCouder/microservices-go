import { ModelCard } from "@/components/shared/model-card";
import { cn } from "@/lib/utils";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

import {
  isProviderUsableWithCredentials,
  type ProviderCredentialLookup,
} from "../../_lib/catalog-client";
import type {
  LLMProviderCredentialStatus,
  ModelCatalogItem,
} from "../../_lib/model-access";

function formatCreditCost(
  creditCost: number,
  t: (key: string, options?: any) => string,
) {
  const normalized = Math.max(1, Math.floor(creditCost));
  return t("creditCost", { count: normalized });
}

type ModelCatalogGridProps = {
  models: ModelCatalogItem[];
  selectedModelIdSet: Set<string>;
  selectionLimit: number;
  selectionLimitReady: boolean;
  isDeveloperPlan: boolean;
  providerCredentialsReady: boolean;
  providerCredentials: LLMProviderCredentialStatus[];
  providerCredentialLookup: ProviderCredentialLookup;
  canEdit: boolean;
  onToggleModel: (modelId: string) => void;
};

export function ModelCatalogGrid({
  models,
  selectedModelIdSet,
  selectionLimit,
  selectionLimitReady,
  isDeveloperPlan,
  providerCredentialsReady,
  providerCredentials,
  providerCredentialLookup,
  canEdit,
  onToggleModel,
}: ModelCatalogGridProps) {
  const { t } = useScopedI18n("models");

  return (
    <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(220px,1fr))] items-stretch gap-4">
      {models.map((model) => {
        const isSelected = selectedModelIdSet.has(model.id);
        const disabledByPlan =
          selectionLimitReady &&
          !isSelected &&
          selectedModelIdSet.size >= selectionLimit;
        const disabledByApiKey =
          isDeveloperPlan &&
          providerCredentialsReady &&
          !isProviderUsableWithCredentials(
            model.provider,
            providerCredentials,
            providerCredentialLookup,
          );
        const disabled = !canEdit || disabledByPlan || disabledByApiKey;

        return (
          <div key={model.id} className={cn("h-full min-w-0", disabled && "opacity-70")}>
            <ModelCard
              name={model.name}
              description={model.description}
              icon={model.icon}
              selected={isSelected}
              onClick={canEdit ? () => onToggleModel(model.id) : () => undefined}
              modelGroup={model.modelGroup}
              size="large"
              variant="models"
              disabled={disabled}
              metaLabel={formatCreditCost(model.creditCost, t)}
              disabledLabel={
                disabledByApiKey
                  ? t("apiKeyRequired")
                  : !canEdit
                    ? t("readOnly")
                  : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}
