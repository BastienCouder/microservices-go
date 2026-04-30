import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { ModelCard } from "@/components/shared/model-card";
import { pushErrorToast, pushSuccessToast } from "@/components/ui/toast-actions";
import {
  createProviderCredentialLookup,
  getCatalogDefaultSelection,
  getProviderCredentialOptions,
  getProviderKeyRequirements,
  isProviderUsableWithCredentials,
  loadLLMProviderCredentials,
  loadModelCatalog,
  sortCatalogItemsByProvider,
} from "@/features/models/_lib/catalog-client";
import {
  readSelectedOrganizationId,
  type LLMProviderCredentialStatus,
  type ModelCatalogItem,
} from "@/features/models/_lib/model-access";
import { ProviderApiKeysPanel } from "@/features/models/_components/provider-keys/provider-api-keys-panel";
import { useProviderCredentialMutations } from "@/features/models/_lib/models-panel/use-provider-credential-mutations";
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

const EMPTY_MODEL_CATALOG: ModelCatalogItem[] = [];
const EMPTY_PROVIDER_CREDENTIALS: LLMProviderCredentialStatus[] = [];

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
  const [organizationId] = useState(readSelectedOrganizationId);
  const didApplyDefaultsRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [providerKeyDrafts, setProviderKeyDrafts] = useState<
    Record<string, string>
  >({});
  const normalizedApiBaseURL = apiBaseURL.trim();

  const billingQuery = useQuery({
    queryKey: appQueryKeys.billingQuota(apiBaseURL, organizationId),
    enabled: normalizedApiBaseURL !== "" && organizationId !== "",
    queryFn: ({ signal }) =>
      loadBillingEntitlements(apiBaseURL, organizationId, { signal }),
  });
  const plan = billingQuery.data?.plan ?? null;
  const requiresProjectProviderCredentials = false;

  const catalogQuery = useQuery({
    queryKey: appQueryKeys.modelsCatalog(apiBaseURL, organizationId, "active"),
    enabled: normalizedApiBaseURL !== "" && organizationId !== "",
    queryFn: ({ signal }) =>
      loadModelCatalog(apiBaseURL, organizationId, {
        activeOnly: true,
        signal,
      }),
  });

  const providerCredentialsQuery = useQuery({
    queryKey: appQueryKeys.llmProviderCredentials(
      apiBaseURL,
      organizationId,
      "__onboarding__",
    ),
    enabled:
      requiresProjectProviderCredentials &&
      normalizedApiBaseURL !== "" &&
      organizationId !== "",
    queryFn: ({ signal }) =>
      loadLLMProviderCredentials(
        apiBaseURL,
        organizationId,
        "__onboarding__",
        signal,
      ),
  });

  const {
    pendingProvider,
    saveProviderCredential,
    deleteProviderCredential,
    saveProviderCredentialMutation,
    deleteProviderCredentialMutation,
  } = useProviderCredentialMutations({
    apiBaseURL,
    organizationId,
    projectId: "__onboarding__",
    onSaveSuccess: (credential) => {
      setProviderKeyDrafts((current) => ({
        ...current,
        [credential.provider]: "",
      }));
      const nextMessage = t("modelsDeveloperKeysSaved");
      pushSuccessToast(nextMessage);
    },
    onDeleteSuccess: (credential) => {
      setProviderKeyDrafts((current) => ({
        ...current,
        [credential.provider]: "",
      }));
      const nextMessage = t("modelsDeveloperKeysDeleted");
      pushSuccessToast(nextMessage);
    },
    onSaveError: (mutationError) => {
      const nextMessage =
        mutationError instanceof Error
          ? mutationError.message
          : t("modelsDeveloperKeysSaveError");
      pushErrorToast(new Error(nextMessage), nextMessage);
    },
    onDeleteError: (mutationError) => {
      const nextMessage =
        mutationError instanceof Error
          ? mutationError.message
          : t("modelsDeveloperKeysDeleteError");
      pushErrorToast(new Error(nextMessage), nextMessage);
    },
  });

  const catalog = catalogQuery.data ?? EMPTY_MODEL_CATALOG;
  useEffect(() => {
    if (catalogQuery.error instanceof Error) {
      pushErrorToast(catalogQuery.error, t("modelsEmpty"));
    }
  }, [catalogQuery.error, t]);

  useEffect(() => {
    if (providerCredentialsQuery.error instanceof Error) {
      pushErrorToast(providerCredentialsQuery.error, t("modelsDeveloperKeysSaveError"));
    }
  }, [providerCredentialsQuery.error, t]);

  const providerCredentials =
    providerCredentialsQuery.data ?? EMPTY_PROVIDER_CREDENTIALS;
  const providerCredentialLookup = useMemo(
    () => createProviderCredentialLookup(providerCredentials),
    [providerCredentials],
  );
  const providerCredentialsReady =
    !requiresProjectProviderCredentials ||
    providerCredentialsQuery.isFetched ||
    providerCredentialsQuery.isError;
  const selectionLimit = billingQuery.data?.modelSelectionLimit ?? 0;
  const selectedModelIdSet = useMemo(
    () => new Set(selectedModels),
    [selectedModels],
  );
  const catalogById = useMemo(
    () => new Map(catalog.map((model) => [model.id, model])),
    [catalog],
  );
  const allowedModelIds = useMemo(
    () => new Set(catalog.map((model) => model.id)),
    [catalog],
  );
  const usableModelIds = useMemo(
    () =>
      new Set(
        catalog
          .filter(
            (model) =>
              model.isActive &&
              (!requiresProjectProviderCredentials ||
                !providerCredentialsReady ||
                isProviderUsableWithCredentials(
                  model.provider,
                  providerCredentials,
                  providerCredentialLookup,
                )),
          )
          .map((model) => model.id),
      ),
    [
      catalog,
      providerCredentials,
      providerCredentialLookup,
      providerCredentialsReady,
      requiresProjectProviderCredentials,
    ],
  );
  const selectableModels = useMemo(
    () => sortCatalogItemsByProvider(catalog.filter((model) => model.isActive)),
    [catalog],
  );
  const filteredModels = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();
    if (normalizedSearchQuery === "") return selectableModels;

    return selectableModels.filter((model) =>
      [model.name, model.description, model.modelGroup]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearchQuery)),
    );
  }, [searchQuery, selectableModels]);
  const selectedCount = useMemo(
    () =>
      selectedModels.filter(
        (modelId) => allowedModelIds.has(modelId) && usableModelIds.has(modelId),
      ).length,
    [allowedModelIds, selectedModels, usableModelIds],
  );

  useEffect(() => {
    if (selectedModels.length === 0) return;
    if (requiresProjectProviderCredentials && !providerCredentialsReady) return;

    const filteredSelection = selectedModels.filter(
      (modelId) => allowedModelIds.has(modelId) && usableModelIds.has(modelId),
    );
    const boundedSelection =
      selectionLimit > 0
        ? filteredSelection.slice(0, selectionLimit)
        : filteredSelection;
    if (!sameStringArray(boundedSelection, selectedModels)) {
      setSelectedModels(boundedSelection);
    }
  }, [
    allowedModelIds,
    providerCredentialsReady,
    requiresProjectProviderCredentials,
    selectedModels,
    selectionLimit,
    setSelectedModels,
    usableModelIds,
  ]);

  useEffect(() => {
    if (didApplyDefaultsRef.current || !catalogQuery.isSuccess) return;
    if (requiresProjectProviderCredentials && !providerCredentialsReady) return;

    didApplyDefaultsRef.current = true;
    if (selectedModels.length > 0) return;

    const defaultCatalog = sortCatalogItemsByProvider(
      requiresProjectProviderCredentials
        ? catalog.filter((model) => usableModelIds.has(model.id))
        : catalog,
    );
    const defaultSelection = getCatalogDefaultSelection(defaultCatalog, 3);
    if (defaultSelection.length > 0) {
      setSelectedModels(defaultSelection);
    }
  }, [
    catalog,
    catalogQuery.isSuccess,
    providerCredentialsReady,
    requiresProjectProviderCredentials,
    selectedModels.length,
    setSelectedModels,
    usableModelIds,
  ]);

  const toggleModel = useCallback(
    (modelId: string) => {
      const model = catalogById.get(modelId);

      if (selectedModelIdSet.has(modelId)) {
        setSelectedModels(selectedModels.filter((id) => id !== modelId));
        return;
      }

      if (!model) {
        return;
      }

      if (requiresProjectProviderCredentials && !providerCredentialsReady) {
        pushSuccessToast(t("modelsDeveloperKeysLoading"));
        return;
      }

      if (
        requiresProjectProviderCredentials &&
        !isProviderUsableWithCredentials(
          model.provider,
          providerCredentials,
          providerCredentialLookup,
        )
      ) {
        const nextMessage = t("modelsDeveloperKeysRequired", {
          providers: `${model.provider} / OpenRouter`,
        });
        pushErrorToast(new Error(nextMessage), nextMessage);
        return;
      }

      if (selectionLimit > 0 && selectedCount >= selectionLimit) {
        return;
      }

      setSelectedModels([...selectedModels, modelId]);
    },
    [
      catalogById,
      providerCredentialLookup,
      providerCredentials,
      providerCredentialsReady,
      requiresProjectProviderCredentials,
      selectedCount,
      selectedModels,
      selectedModelIdSet,
      selectionLimit,
      setSelectedModels,
      t,
    ],
  );
  const planLabel = plan ? t(getBillingPlanTranslationKey(plan)) : null;
  const providerKeyRequirements = useMemo(
    () =>
      requiresProjectProviderCredentials
        ? getProviderKeyRequirements(
            catalog,
            selectedModels,
            providerCredentials,
            providerCredentialLookup,
          )
        : [],
    [
      catalog,
      providerCredentialLookup,
      providerCredentials,
      requiresProjectProviderCredentials,
      selectedModels,
    ],
  );
  const providerCredentialOptions = useMemo(
    () =>
      requiresProjectProviderCredentials
        ? getProviderCredentialOptions(
            catalog,
            providerCredentials,
            providerCredentialLookup,
          )
        : [],
    [
      catalog,
      providerCredentialLookup,
      providerCredentials,
      requiresProjectProviderCredentials,
    ],
  );
  const missingProviderLabels = providerKeyRequirements
    .filter((requirement) => !requirement.hasApiKey)
    .map((requirement) => requirement.label);
  const developerPlanMissingKeys =
    requiresProjectProviderCredentials &&
    providerCredentialsReady &&
    selectedCount > 0 &&
    missingProviderLabels.length > 0;
  const canContinue =
    selectedCount > 0 &&
    !developerPlanMissingKeys &&
    (!requiresProjectProviderCredentials || providerCredentialsReady);

  const providerApiKeyTexts = useMemo(
    () => ({
      empty: t("modelsDeveloperKeysEmpty"),
      configured: t("modelsDeveloperKeysConfigured"),
      missing: t("modelsDeveloperKeysMissing"),
      connect: t("modelsDeveloperKeysConnect"),
      manage: t("modelsDeveloperKeysManage"),
      delete: t("modelsDeveloperKeysDelete"),
      fieldLabel: t("modelsDeveloperKeysFieldLabel"),
      fieldHint: t("modelsDeveloperKeysFieldHint"),
      placeholder: t("modelsDeveloperKeysPlaceholder"),
      save: t("modelsDeveloperKeysSave"),
      saving: t("modelsDeveloperKeysSaving"),
    }),
    [t],
  );

  const updateProviderKeyDraft = useCallback((provider: string, value: string) => {
    setProviderKeyDrafts((current) => ({
      ...current,
      [provider]: value,
    }));
  }, []);

  const saveProviderKey = useCallback(
    (provider: string) => {
      const apiKey = providerKeyDrafts[provider]?.trim() ?? "";
      if (!apiKey) return;

      saveProviderCredential(provider, apiKey);
    },
    [providerKeyDrafts, saveProviderCredential],
  );

  const deleteProviderKey = useCallback(
    (provider: string) => {
      deleteProviderCredential(provider);
    },
    [deleteProviderCredential],
  );

  let content = (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {filteredModels.map((model) => {
        const selected = selectedModelIdSet.has(model.id);
        const disabledByApiKey =
          requiresProjectProviderCredentials &&
          providerCredentialsReady &&
          !isProviderUsableWithCredentials(
            model.provider,
            providerCredentials,
            providerCredentialLookup,
          );

        return (
          <div key={model.id}>
            <ModelCard
              name={model.name}
              description={model.description}
              icon={model.icon}
              selected={selected}
              onClick={() => toggleModel(model.id)}
              modelGroup={model.modelGroup}
              size="large"
              disabled={disabledByApiKey}
              disabledLabel={
                disabledByApiKey ? t("modelsDeveloperModelDisabled") : undefined
              }
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
      <div className="rounded-md border border-dashed border-border/70 px-4 py-8 text-sm text-muted-foreground">
        {t("modelsEmpty")}
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
          nextDisabled={!canContinue}
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

      {requiresProjectProviderCredentials ? (
        <div className="flex flex-col gap-3">
          <ProviderApiKeysPanel
            requirements={providerCredentialOptions}
            drafts={providerKeyDrafts}
            pendingProvider={pendingProvider}
            disabled={
              saveProviderCredentialMutation.isPending ||
              deleteProviderCredentialMutation.isPending ||
              providerCredentialsQuery.isFetching
            }
            onDraftChange={updateProviderKeyDraft}
            onSave={saveProviderKey}
            onDelete={deleteProviderKey}
            texts={providerApiKeyTexts}
          />
          {developerPlanMissingKeys ? (
            <p className="text-sm text-destructive">
              {t("modelsDeveloperKeysRequired", {
                providers: missingProviderLabels.join(", "),
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      <Input
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder={t("modelsSearchPlaceholder")}
      />

      {content}
    </OnboardingStep>
  );
}
