import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { ModelCard } from "@/features/monitoring/_components/shared/model-card";
import {
  getCatalogDefaultSelection,
  loadModelCatalog,
} from "@/features/models/core/catalog-client";
import { readSelectedOrganizationId } from "@/features/models/core/model-access";
import { useOnboarding } from "@/hooks/use-onboarding";
import { appQueryKeys } from "@/lib/query-keys";
import { loadBillingEntitlements } from "@/shared/billing";
import { getBillingPlanTranslationKey } from "@/shared/billing-plan";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { OnboardingStep, OnboardingStepFooter } from "./step-shell";

type StepModelsProps = {
  apiBaseURL: string;
  hideBack?: boolean;
  nextLabel?: string;
};

function sameStringArray(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function StepModels({
  apiBaseURL,
  hideBack = false,
  nextLabel = "Start audit",
}: StepModelsProps) {
  const { selectedModels, setSelectedModels, nextStep, prevStep } =
    useOnboarding();
  const { t } = useScopedI18n("onboarding");
  const [organizationId, setOrganizationId] = useState("");
  const [didApplyDefaults, setDidApplyDefaults] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setOrganizationId(readSelectedOrganizationId());
  }, []);

  const billingQuery = useQuery({
    queryKey: appQueryKeys.billingQuota(apiBaseURL, organizationId),
    enabled: apiBaseURL.trim() !== "" && organizationId !== "",
    queryFn: ({ signal }) =>
      loadBillingEntitlements(apiBaseURL, organizationId, { signal }),
  });

  const catalogQuery = useQuery({
    queryKey: appQueryKeys.modelsCatalog(apiBaseURL, organizationId, "active"),
    enabled: apiBaseURL.trim() !== "" && organizationId !== "",
    queryFn: ({ signal }) =>
      loadModelCatalog(apiBaseURL, organizationId, {
        activeOnly: true,
        signal,
      }),
  });

  const catalog = catalogQuery.data ?? [];
  const selectionLimit = billingQuery.data?.modelSelectionLimit ?? 0;
  const allowedModelIds = useMemo(
    () => new Set(catalog.map((model) => model.id)),
    [catalog],
  );

  useEffect(() => {
    if (selectedModels.length === 0) return;

    const filteredSelection = selectedModels.filter((modelId) =>
      allowedModelIds.has(modelId),
    );
    const boundedSelection =
      selectionLimit > 0
        ? filteredSelection.slice(0, selectionLimit)
        : filteredSelection;
    if (!sameStringArray(boundedSelection, selectedModels)) {
      setSelectedModels(boundedSelection);
    }
  }, [allowedModelIds, selectedModels, selectionLimit, setSelectedModels]);

  useEffect(() => {
    if (didApplyDefaults || !catalogQuery.isSuccess) return;

    setDidApplyDefaults(true);
    if (selectedModels.length > 0) return;

    const defaultSelection = getCatalogDefaultSelection(catalog, 3);
    if (defaultSelection.length > 0) {
      setSelectedModels(defaultSelection);
    }
  }, [
    catalog,
    catalogQuery.isSuccess,
    didApplyDefaults,
    selectedModels.length,
    setSelectedModels,
  ]);

  const toggleModel = (modelId: string) => {
    if (selectedModels.includes(modelId)) {
      setSelectedModels(selectedModels.filter((id) => id !== modelId));
      return;
    }

    if (selectionLimit > 0 && selectedCount >= selectionLimit) {
      return;
    }

    setSelectedModels([...selectedModels, modelId]);
  };

  const selectableModels = catalog.filter((model) => model.isActive);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredModels = selectableModels.filter((model) => {
    if (normalizedSearchQuery === "") return true;

    return [model.name, model.description, model.modelGroup]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedSearchQuery));
  });
  const selectedCount = selectedModels.filter((modelId) =>
    allowedModelIds.has(modelId),
  ).length;
  const plan = billingQuery.data?.plan ?? null;
  const planLabel = plan ? t(getBillingPlanTranslationKey(plan)) : null;

  let content = (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {filteredModels.map((model) => {
        const selected = selectedModels.includes(model.id);

        return (
          <div key={model.id}>
            <ModelCard
              name={model.name}
              description={model.description}
              icon={model.icon}
              selected={selected}
              onClick={() => toggleModel(model.id)}
              modelGroup={model.modelGroup}
              size="models"
            />
          </div>
        );
      })}
    </div>
  );

  if (!organizationId) {
    content = (
      <div className="rounded-md border border-dashed border-border/70 px-4 py-8 text-sm text-muted-foreground">
        {t("modelsNoOrganization")}
      </div>
    );
  } else if (catalogQuery.isLoading) {
    content = (
      <div className="rounded-md border border-dashed border-border/70 px-4 py-8 text-sm text-muted-foreground">
        {t("modelsLoading")}
      </div>
    );
  } else if (catalogQuery.error instanceof Error) {
    content = (
      <div className="rounded-md border border-dashed border-border/70 px-4 py-8 text-sm text-destructive">
        {catalogQuery.error.message}
      </div>
    );
  } else if (selectableModels.length === 0) {
    content = (
      <div className="rounded-md border border-dashed border-border/70 px-4 py-8 text-sm text-muted-foreground">
        {t("modelsEmpty")}
      </div>
    );
  } else if (filteredModels.length === 0) {
    content = (
      <div className="rounded-md border border-dashed border-border/70 px-4 py-8 text-sm text-muted-foreground">
        {t("modelsSearchEmpty")}
      </div>
    );
  }

  return (
    <OnboardingStep
      title={t("modelsTitle")}
      description={t("modelsDescription")}
      footer={
        <OnboardingStepFooter
          hideBack={hideBack}
          onBack={prevStep}
          onNext={nextStep}
          // nextDisabled={!canContinue}
          nextLabel={nextLabel === "Start audit" ? t("startAudit") : nextLabel}
        />
      }
    >
      <div className="flex flex-wrap items-center gap-2 rounded-[24px] border border-border/70 bg-muted/20 px-4 py-3">
        <span className="text-sm font-medium text-foreground">
          {t("modelsSelected", { count: selectedCount })}
        </span>
      </div>

      <div className="rounded-md border border-border/70 bg-muted/20 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {t("modelsChangesTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("modelsChangesHint")}
            </p>
          </div>
          {planLabel ? (
            <div className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-foreground">
              {t("modelsCurrentPlan", { plan: planLabel })}
            </div>
          ) : null}
        </div>
      </div>

      <Input
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder={t("modelsSearchPlaceholder")}
      />

      {content}
    </OnboardingStep>
  );
}
