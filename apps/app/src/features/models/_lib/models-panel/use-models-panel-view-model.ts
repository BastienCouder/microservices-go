import { useCallback, useMemo, useState } from "react";

import { buildScopedHref } from "@/shared/selection";

import {
  getProviderCredentialOptions,
  getProviderKeyRequirements,
  isProviderUsableWithCredentials,
  sortCatalogItemsByProvider,
} from "../catalog-client";
import { readSelectedOrganizationId } from "../model-access";
import { readProjectIdFromSearch } from "./models-panel-route";
import { useModelsPanelData } from "./use-models-panel-data";
import { useProviderCredentialMutations } from "./use-provider-credential-mutations";
import { useSaveProjectModelsMutation } from "./use-save-project-models-mutation";

type UseModelsPanelViewModelOptions = {
  apiBaseURL: string;
  routeSearch: string;
};

const API_KEY_PROJECT_REQUIRED_SAVE =
  "Selectionnez un projet avant d'enregistrer une cle API.";
const API_KEY_PROJECT_REQUIRED_DELETE =
  "Selectionnez un projet avant de supprimer une cle API.";

export const PROVIDER_API_KEY_TEXTS = {
  empty: "Selectionnez un modele pour voir les fournisseurs a configurer.",
  configured: "Cle configuree",
  missing: "Cle requise",
  connect: "Connecter",
  manage: "Gerer la cle",
  delete: "Supprimer la cle",
  fieldLabel: "Cle API",
  placeholder: "Coller la cle API",
  save: "Enregistrer",
  saving: "Enregistrement...",
};

export function useModelsPanelViewModel({
  apiBaseURL,
  routeSearch,
}: UseModelsPanelViewModelOptions) {
  const [organizationId] = useState(readSelectedOrganizationId);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [providerKeyDrafts, setProviderKeyDrafts] = useState<Record<string, string>>({});
  const hintedProjectToken = useMemo(
    () => readProjectIdFromSearch(routeSearch),
    [routeSearch],
  );
  const data = useModelsPanelData({
    apiBaseURL,
    organizationId,
    hintedProjectToken,
  });

  const saveModelsMutation = useSaveProjectModelsMutation({
    apiBaseURL,
    organizationId,
    selectedProjectId: data.selectedProjectId,
    onSuccessMessage: (nextMessage) => {
      setError(null);
      setMessage(nextMessage);
    },
    onErrorMessage: setError,
  });
  const providerMutations = useProviderCredentialMutations({
    apiBaseURL,
    organizationId,
    projectId: data.selectedProjectId,
    onSaveSuccess: (credential) => {
      setProviderKeyDrafts((current) => ({ ...current, [credential.provider]: "" }));
      setError(null);
      setMessage(`Cle API ${credential.label} enregistree.`);
    },
    onDeleteSuccess: (credential) => {
      setProviderKeyDrafts((current) => ({ ...current, [credential.provider]: "" }));
      setError(null);
      setMessage(`Cle API ${credential.label} supprimee.`);
    },
    onSaveError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Impossible d'enregistrer la cle API LLM.",
      );
    },
    onDeleteError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Impossible de supprimer la cle API LLM.",
      );
    },
  });

  const providerCredentialOptions = useMemo(
    () =>
      getProviderCredentialOptions(
        data.catalog,
        data.providerCredentials,
        data.providerCredentialLookup,
      ),
    [data.catalog, data.providerCredentialLookup, data.providerCredentials],
  );
  const providerKeyRequirements = useMemo(
    () =>
      getProviderKeyRequirements(
        data.catalog,
        data.selectedModelIds,
        data.providerCredentials,
        data.providerCredentialLookup,
      ),
    [
      data.catalog,
      data.providerCredentialLookup,
      data.providerCredentials,
      data.selectedModelIds,
    ],
  );
  const missingProviderLabels = useMemo(
    () =>
      providerKeyRequirements
        .filter((requirement) => !requirement.hasApiKey)
        .map((requirement) => requirement.label),
    [providerKeyRequirements],
  );
  const filteredCatalog = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const items = normalizedSearch
      ? data.catalog.filter((model) =>
          [
            model.modelGroup,
            model.name,
            model.provider,
            model.providerModelId,
            model.description,
          ].some((value) => value.toLowerCase().includes(normalizedSearch)),
        )
      : data.catalog;

    return sortCatalogItemsByProvider(items);
  }, [data.catalog, search]);
  const redirectHref = useMemo(() => {
    if (!data.selectedProject) return null;

    const hintedProject = hintedProjectToken.trim();
    if (hintedProject === data.selectedProject.slug) return null;

    return buildScopedHref(`/models${routeSearch}`, {
      project: data.selectedProject.slug,
    });
  }, [data.selectedProject, hintedProjectToken, routeSearch]);

  const developerPlanMissingKeys =
    data.isDeveloperPlan &&
    data.providerCredentialsReady &&
    data.selectedModelIds.length > 0 &&
    missingProviderLabels.length > 0;
  const providerKeysDisabled =
    providerMutations.saveProviderCredentialMutation.isPending ||
    providerMutations.deleteProviderCredentialMutation.isPending ||
    data.providerCredentialsQuery.isFetching ||
    data.selectedProjectId === "";
  const saveDisabled =
    saveModelsMutation.isPending ||
    data.loading ||
    !data.selectedProject ||
    data.selectedModelIds.length === 0 ||
    (data.isDeveloperPlan && !data.providerCredentialsReady) ||
    developerPlanMissingKeys;

  const updateProviderKeyDraft = useCallback((provider: string, value: string) => {
    setProviderKeyDrafts((current) => ({ ...current, [provider]: value }));
  }, []);
  const saveProviderKey = useCallback(
    (provider: string) => {
      if (!data.selectedProjectId) {
        setError(API_KEY_PROJECT_REQUIRED_SAVE);
        return;
      }

      const apiKey = providerKeyDrafts[provider]?.trim();
      if (apiKey) providerMutations.saveProviderCredential(provider, apiKey);
    },
    [data.selectedProjectId, providerKeyDrafts, providerMutations],
  );
  const deleteProviderKey = useCallback(
    (provider: string) => {
      if (!data.selectedProjectId) {
        setError(API_KEY_PROJECT_REQUIRED_DELETE);
        return;
      }

      providerMutations.deleteProviderCredential(provider);
    },
    [data.selectedProjectId, providerMutations],
  );
  const toggleProjectModel = useCallback(
    (modelId: string) => {
      const isSelected = data.selectedModelIdSet.has(modelId);

      if (isSelected) {
        data.setSelectedModelIds((current) =>
          current.filter((value) => value !== modelId),
        );
        setMessage(null);
        return;
      }

      const model = data.catalogById.get(modelId);
      if (!model) return;
      if (data.isDeveloperPlan && !data.providerCredentialsReady) {
        setMessage("Chargement des cles API fournisseur...");
        return;
      }
      if (
        data.isDeveloperPlan &&
        !isProviderUsableWithCredentials(
          model.provider,
          data.providerCredentials,
          data.providerCredentialLookup,
        )
      ) {
        setMessage(
          `Ajoutez une cle API pour ${model.provider} ou OpenRouter avant d'utiliser ce modele.`,
        );
        return;
      }
      if (data.selectedModelIdSet.size >= data.selectionLimit) {
        setMessage(
          data.planLabel
            ? `${data.planLabel} permet jusqu'a ${data.selectionLimit} modele${
                data.selectionLimit > 1 ? "s" : ""
              }.`
            : "La limite de votre plan a ete atteinte.",
        );
        return;
      }

      data.setSelectedModelIds((current) => [...current, modelId]);
      setMessage(null);
    },
    [data],
  );
  const saveSelectedModels = useCallback(() => {
    void saveModelsMutation.mutateAsync(data.selectedModelIds);
  }, [data.selectedModelIds, saveModelsMutation]);

  return {
    organizationId,
    search,
    setSearch,
    loading: data.loading,
    redirectHref,
    displayError: error ?? data.queryError,
    message,
    selectedModelIds: data.selectedModelIds,
    selectedModelIdSet: data.selectedModelIdSet,
    selectedProject: data.selectedProject,
    filteredCatalog,
    selectionLimit: data.selectionLimit,
    planLabel: data.planLabel,
    isDeveloperPlan: data.isDeveloperPlan,
    showDeveloperUpgradeBanner: data.showDeveloperUpgradeBanner,
    providerCredentialOptions,
    providerKeyDrafts,
    pendingProvider: providerMutations.pendingProvider,
    providerKeysDisabled,
    updateProviderKeyDraft,
    saveProviderKey,
    deleteProviderKey,
    developerPlanMissingKeys,
    missingProviderLabels,
    providerCredentials: data.providerCredentials,
    providerCredentialLookup: data.providerCredentialLookup,
    providerCredentialsReady: data.providerCredentialsReady,
    loadingCatalog: data.loadingCatalog,
    loadingPlan: data.loadingPlan,
    loadingProviderCredentials: data.loadingProviderCredentials,
    loadingProjectModels: data.loadingProjectModels,
    saveDisabled,
    isSavingModels: saveModelsMutation.isPending,
    saveSelectedModels,
    toggleProjectModel,
  };
}
