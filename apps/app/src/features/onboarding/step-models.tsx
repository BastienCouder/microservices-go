import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { ModelCard } from "@/components/shared/model-card";
import {
  pushErrorToast,
  pushSuccessToast,
  pushWarningToast,
} from "@/components/ui/toast-actions";
import {
  createProviderCredentialLookup,
  getCatalogDefaultSelection,
  getProviderCredentialOptions,
  getProviderKeyRequirements,
  isProviderUsableWithCredentials,
  loadLLMProviderCredentials,
  loadOnboardingModelCatalog,
  sortCatalogItemsByProvider,
} from "@/features/models/_lib/catalog-client";
import {
  type LLMProviderCredentialStatus,
  type ModelCatalogItem,
} from "@/features/models/_lib/model-access";
import { ProviderApiKeysPanel } from "@/features/models/_components/provider-keys/provider-api-keys-panel";
import { useProviderCredentialMutations } from "@/features/models/_lib/models-panel/use-provider-credential-mutations";
import {
  clearPersistedOnboardingState,
  useOnboarding,
} from "@/hooks/use-onboarding";
import { appQueryKeys } from "@/lib/query-keys";
import { loadBillingEntitlements } from "@/shared/billing";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { getBillingPlanLabel } from "@/shared/billing-plan";
import { useResolvedBillingOrganizationId } from "@/shared/use-resolved-billing-organization-id";
import { createOnboardingProject } from "./onboarding-api";
import { invalidateOrganizationScope } from "@/shared/api/query-refresh";
import {
  buildScopedHref,
  readSelectedOrganizationID,
  storeSelectedProjectContext,
} from "@/shared/selection";
import { OnboardingStep, OnboardingStepFooter } from "./step-shell";

type StepModelsProps = {
  apiBaseURL: string;
  organizationId?: string;
  hideBack?: boolean;
  nextLabel?: string;
};

const EMPTY_MODEL_CATALOG: ModelCatalogItem[] = [];
const EMPTY_PROVIDER_CREDENTIALS: LLMProviderCredentialStatus[] = [];
const ONBOARDING_MODEL_SELECTION_LIMIT = 3;

function formatCreditCost(
  creditCost: number,
  t: (key: string, options?: any) => string,
) {
  const normalized = Math.max(1, Math.floor(creditCost));
  return t("creditCost", { count: normalized });
}

function sameStringArray(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function StepModels({
  apiBaseURL,
  organizationId: providedOrganizationId,
  hideBack = false,
  nextLabel,
}: StepModelsProps) {
  const {
    organizationName,
    websiteUrl,
    attributionSource,
    brandName,
    brandDescription,
    industry,
    competitors,
    selectedPrompts,
    selectedModels,
    setSelectedModels,
    prevStep,
  } = useOnboarding();
  const { t } = useScopedI18n("onboarding");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const organizationId = providedOrganizationId?.trim() ?? "";
  const didApplyDefaultsRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [creationError, setCreationError] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [providerKeyDrafts, setProviderKeyDrafts] = useState<
    Record<string, string>
  >({});
  const normalizedApiBaseURL = apiBaseURL.trim();
  const billingOrganization = useResolvedBillingOrganizationId({
    apiBaseURL,
    organizationId,
  });

  const requiresProjectProviderCredentials = false;

  const billingQuery = useQuery({
    queryKey: appQueryKeys.billingQuota(apiBaseURL, billingOrganization.organizationId),
    enabled:
      normalizedApiBaseURL !== "" &&
      billingOrganization.organizationId !== "",
    queryFn: ({ signal }) =>
      loadBillingEntitlements(apiBaseURL, billingOrganization.organizationId, { signal }),
  });

  const catalogQuery = useQuery({
    queryKey: appQueryKeys.modelsCatalog(
      apiBaseURL,
      "__onboarding__",
      "active",
    ),
    enabled: normalizedApiBaseURL !== "",
    queryFn: ({ signal }) =>
      loadOnboardingModelCatalog(apiBaseURL, {
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
  const planLabel = billingQuery.data?.plan
    ? getBillingPlanLabel(billingQuery.data.plan)
    : "";
  const billingSelectionLimit = billingQuery.data?.modelSelectionLimit ?? 0;
  const selectionLimit =
    organizationId && billingQuery.data
      ? billingSelectionLimit > 0
        ? billingSelectionLimit
        : catalog.length
      : ONBOARDING_MODEL_SELECTION_LIMIT;
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
  const selectedModelIdsForSubmit = useMemo(
    () =>
      selectedModels.filter(
        (modelId) => allowedModelIds.has(modelId) && usableModelIds.has(modelId),
      ),
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
    const defaultSelection = getCatalogDefaultSelection(
      defaultCatalog,
      selectionLimit > 0 ? selectionLimit : ONBOARDING_MODEL_SELECTION_LIMIT,
    );
    if (defaultSelection.length > 0) {
      setSelectedModels(defaultSelection);
    }
  }, [
    catalog,
    catalogQuery.isSuccess,
    providerCredentialsReady,
    requiresProjectProviderCredentials,
    selectionLimit,
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
  const developerPlanMissingKeysMessage = developerPlanMissingKeys
    ? t("modelsDeveloperKeysRequired", {
        providers: missingProviderLabels.join(", "),
      })
    : "";
  const canContinue =
    selectedCount > 0 &&
    !developerPlanMissingKeys &&
    (!requiresProjectProviderCredentials || providerCredentialsReady) &&
    !isCreatingProject;
  const catalogErrorMessage =
    catalogQuery.error instanceof Error ? catalogQuery.error.message : "";

  const finishOnboarding = useCallback(async () => {
    if (!canContinue || isCreatingProject) return;

    setCreationError(null);
    setIsCreatingProject(true);

    try {
      const resolvedOrganizationId =
        organizationId || readSelectedOrganizationID();
      const result = await createOnboardingProject(apiBaseURL, {
        organizationId: resolvedOrganizationId,
        organizationName,
        brandName,
        websiteUrl,
        attributionSource,
        brandDescription,
        industry,
        competitors,
        prompts: selectedPrompts,
        modelIds: selectedModelIdsForSubmit,
      });

      storeSelectedProjectContext({
        organizationId: result.organizationId,
        projectId: result.projectId,
      });
      clearPersistedOnboardingState();
      if (result.warnings.length > 0) {
        pushWarningToast(result.warnings.join(" "));
      }
      await invalidateOrganizationScope(
        queryClient,
        apiBaseURL,
        result.organizationId,
      );
      queryClient.removeQueries({
        queryKey: ["route-project-guard", apiBaseURL],
      });
      navigate(
        buildScopedHref("/monitoring", {
          project: result.projectSlug,
          org: null,
        }),
        { replace: true },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("createProjectError");
      setCreationError(message);
      pushErrorToast(error, t("createProjectError"));
    } finally {
      setIsCreatingProject(false);
    }
  }, [
    apiBaseURL,
    attributionSource,
    brandDescription,
    brandName,
    canContinue,
    competitors,
    industry,
    isCreatingProject,
    navigate,
    organizationId,
    organizationName,
    queryClient,
    selectedModelIdsForSubmit,
    selectedPrompts,
    t,
    websiteUrl,
  ]);

  useEffect(() => {
    if (developerPlanMissingKeysMessage) {
      pushWarningToast(developerPlanMissingKeysMessage);
    }
  }, [developerPlanMissingKeysMessage]);

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
      showKey: t("showApiKey"),
      hideKey: t("hideApiKey"),
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
        const disabledByPlan =
          !selected && selectionLimit > 0 && selectedCount >= selectionLimit;
        const disabledByApiKey =
          requiresProjectProviderCredentials &&
          providerCredentialsReady &&
          !isProviderUsableWithCredentials(
            model.provider,
            providerCredentials,
            providerCredentialLookup,
          );
        const disabled = disabledByApiKey || disabledByPlan;

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
              disabled={disabled}
              metaLabel={formatCreditCost(model.creditCost, t)}
              disabledLabel={
                disabledByApiKey
                  ? t("modelsDeveloperModelDisabled")
                  : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );

  if (normalizedApiBaseURL === "") {
    content = (
      <div className="rounded-md border border-dashed border-border/70 px-4 py-8 text-sm text-muted-foreground">
        {t("missingApiConfiguration")}
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
        {catalogErrorMessage}
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
          onNext={finishOnboarding}
          nextDisabled={!canContinue}
          nextLabel={
            isCreatingProject
              ? t("creatingProject")
              : nextLabel ?? t("createProject")
          }
        />
      }
    >
      {creationError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {creationError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-[24px] border border-border/70 bg-muted/20 px-4 py-3">
        <span className="text-sm font-medium text-foreground">
          {t("modelsSelectedWithLimit", {
            count: selectedCount,
            limit: selectionLimit,
          })}
        </span>
        {planLabel ? (
          <span className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            {t("modelsCurrentPlan", { plan: planLabel })}
          </span>
        ) : null}
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
