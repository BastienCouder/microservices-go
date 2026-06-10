import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildScopedHref,
  readOrganizationIdFromSearch,
  readProjectTokenFromSearch,
  readSelectedProjectID,
  readSelectedOrganizationID,
  SELECTED_CONTEXT_CHANGE_EVENT,
} from "@/shared/selection";
import { pushErrorToast, pushSuccessToast } from "@/components/ui/toast-actions";

import {
  getProviderCredentialOptions,
  getProviderKeyRequirements,
  isProviderUsableWithCredentials,
  sortCatalogItemsByProvider,
} from "../catalog-client";
import { useModelsPanelData } from "./use-models-panel-data";
import { useProviderCredentialMutations } from "./use-provider-credential-mutations";
import { useSaveProjectModelsMutation } from "./use-save-project-models-mutation";
import { useSelectedOrganizationPermissions } from "@/shared/organization-permissions";

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

function readOrganizationId(routeSearch: string): string {
  const routeOrganizationId = readOrganizationIdFromSearch(routeSearch);
  if (routeOrganizationId !== "") {
    return routeOrganizationId;
  }
  return readSelectedOrganizationID();
}

function readCanonicalProjectToken(routeSearch: string): string {
  const routeProjectToken = readProjectTokenFromSearch(routeSearch);
  if (routeProjectToken !== "") {
    return routeProjectToken;
  }
  return readSelectedProjectID();
}

export function useModelsPanelViewModel({
  apiBaseURL,
  routeSearch,
}: UseModelsPanelViewModelOptions) {
  const [organizationId, setOrganizationId] = useState(() =>
    readOrganizationId(routeSearch),
  );
  const [storedProjectToken, setStoredProjectToken] = useState(() =>
    readCanonicalProjectToken(routeSearch),
  );
  const permissions = useSelectedOrganizationPermissions({ apiBaseURL, routeSearch });
  const [search, setSearch] = useState("");
  const [providerKeyDrafts, setProviderKeyDrafts] = useState<Record<string, string>>({});
  const hintedProjectToken = useMemo(
    () => readProjectTokenFromSearch(routeSearch) || storedProjectToken,
    [routeSearch, storedProjectToken],
  );

  useEffect(() => {
    setOrganizationId(readOrganizationId(routeSearch));
    setStoredProjectToken(readCanonicalProjectToken(routeSearch));
  }, [routeSearch]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncOrganizationId = () => {
      setOrganizationId(readOrganizationId(routeSearch));
      setStoredProjectToken(readCanonicalProjectToken(routeSearch));
    };

    window.addEventListener(SELECTED_CONTEXT_CHANGE_EVENT, syncOrganizationId);
    return () => {
      window.removeEventListener(SELECTED_CONTEXT_CHANGE_EVENT, syncOrganizationId);
    };
  }, [routeSearch]);

  const data = useModelsPanelData({
    apiBaseURL,
    organizationId,
    hintedProjectToken,
  });

  const saveModelsMutation = useSaveProjectModelsMutation({
    apiBaseURL,
    organizationId: data.effectiveOrganizationId,
    selectedProjectId: data.selectedProjectId,
    onSuccessMessage: (nextMessage) => {
      pushSuccessToast(nextMessage);
    },
    onErrorMessage: (nextMessage) => {
      pushErrorToast(new Error(nextMessage), nextMessage);
    },
  });
  const providerMutations = useProviderCredentialMutations({
    apiBaseURL,
    organizationId: data.effectiveOrganizationId,
    projectId: data.selectedProjectId,
    onSaveSuccess: (credential) => {
      setProviderKeyDrafts((current) => ({ ...current, [credential.provider]: "" }));
      pushSuccessToast(`Cle API ${credential.label} enregistree.`);
    },
    onDeleteSuccess: (credential) => {
      setProviderKeyDrafts((current) => ({ ...current, [credential.provider]: "" }));
      pushSuccessToast(`Cle API ${credential.label} supprimee.`);
    },
    onSaveError: (mutationError) => {
      pushErrorToast(mutationError, "Impossible d'enregistrer la cle API LLM.");
    },
    onDeleteError: (mutationError) => {
      pushErrorToast(mutationError, "Impossible de supprimer la cle API LLM.");
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
    if (data.loadingCatalog || data.hasMissingHintedProject) {
      return null;
    }
    if (!data.selectedProject) return null;

    const hintedProject = hintedProjectToken.trim();
    if (hintedProject === data.selectedProject.id) {
      return null;
    }

    if (hintedProject !== "" && hintedProject !== data.selectedProject.slug) {
      return null;
    }

    return buildScopedHref("/models", {
      project: data.selectedProject.id,
    });
  }, [
    data.hasMissingHintedProject,
    data.loadingCatalog,
    data.selectedProject,
    hintedProjectToken,
  ]);

  const developerPlanMissingKeys =
    data.isDeveloperPlan &&
    data.providerCredentialsReady &&
    data.selectedModelIds.length > 0 &&
    missingProviderLabels.length > 0;
  const providerKeysDisabled =
    providerMutations.saveProviderCredentialMutation.isPending ||
    providerMutations.deleteProviderCredentialMutation.isPending ||
    data.providerCredentialsQuery.isFetching ||
    data.selectedProjectId === "" ||
    !permissions.canEdit;
  const saveDisabled =
    saveModelsMutation.isPending ||
    data.loading ||
    !data.selectedProject ||
    !permissions.canEdit ||
    data.selectedModelIds.length === 0 ||
    (data.isDeveloperPlan && !data.providerCredentialsReady) ||
    developerPlanMissingKeys;

  const updateProviderKeyDraft = useCallback((provider: string, value: string) => {
    setProviderKeyDrafts((current) => ({ ...current, [provider]: value }));
  }, []);
  const saveProviderKey = useCallback(
    (provider: string) => {
      if (!permissions.canEdit) return;
      if (!data.selectedProjectId) {
        pushErrorToast(
          new Error(API_KEY_PROJECT_REQUIRED_SAVE),
          API_KEY_PROJECT_REQUIRED_SAVE,
        );
        return;
      }

      const apiKey = providerKeyDrafts[provider]?.trim();
      if (apiKey) providerMutations.saveProviderCredential(provider, apiKey);
    },
    [data.selectedProjectId, permissions.canEdit, providerKeyDrafts, providerMutations],
  );
  const deleteProviderKey = useCallback(
    (provider: string) => {
      if (!permissions.canEdit) return;
      if (!data.selectedProjectId) {
        pushErrorToast(
          new Error(API_KEY_PROJECT_REQUIRED_DELETE),
          API_KEY_PROJECT_REQUIRED_DELETE,
        );
        return;
      }

      providerMutations.deleteProviderCredential(provider);
    },
    [data.selectedProjectId, permissions.canEdit, providerMutations],
  );
  const toggleProjectModel = useCallback(
    (modelId: string) => {
      if (!permissions.canEdit) return;
      const isSelected = data.selectedModelIdSet.has(modelId);

      if (isSelected) {
        data.setSelectedModelIds((current) =>
          current.filter((value) => value !== modelId),
        );
        return;
      }

      const model = data.catalogById.get(modelId);
      if (!model) return;
      if (data.isDeveloperPlan && !data.providerCredentialsReady) {
        pushSuccessToast("Chargement des cles API fournisseur...");
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
        const nextMessage = `Ajoutez une cle API pour ${model.provider} ou OpenRouter avant d'utiliser ce modele.`;
        pushErrorToast(
          new Error(nextMessage),
          nextMessage,
        );
        return;
      }
      if (data.selectedModelIdSet.size >= data.selectionLimit) {
        const nextMessage =
          data.planLabel
            ? `${data.planLabel} permet jusqu'a ${data.selectionLimit} modele${
                data.selectionLimit > 1 ? "s" : ""
              }.`
            : "La limite de votre plan a ete atteinte.";
        pushErrorToast(new Error(nextMessage), nextMessage);
        return;
      }
      data.setSelectedModelIds((current) => [...current, modelId]);
    },
    [data, permissions.canEdit],
  );
  const saveSelectedModels = useCallback(() => {
    if (!permissions.canEdit) return;
    void saveModelsMutation.mutateAsync(data.selectedModelIds);
  }, [data.selectedModelIds, permissions.canEdit, saveModelsMutation]);

  return {
    organizationId: data.effectiveOrganizationId || organizationId,
    effectiveOrganizationId: data.effectiveOrganizationId,
    search,
    setSearch,
    loading: data.loading,
    redirectHref,
    displayError: data.queryError,
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
    canEdit: permissions.canEdit,
    saveDisabled,
    isSavingModels: saveModelsMutation.isPending,
    saveSelectedModels,
    toggleProjectModel,
  };
}
