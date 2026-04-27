import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { appQueryKeys } from "@/lib/query-keys";
import { loadBillingEntitlements } from "@/shared/billing";
import { isDeveloperBillingPlan } from "@/shared/billing-plan";
import { findBySlugOrId } from "@/shared/public-slugs";

import {
  createProviderCredentialLookup,
  isProviderUsableWithCredentials,
  loadLLMProviderCredentials,
  loadProjectModels,
  loadProjectsAndCatalog,
} from "../catalog-client";
import {
  getPlanLabel,
  type LLMProviderCredentialStatus,
  type ModelCatalogItem,
  type ModelsProjectSummary,
} from "../model-access";
import { useProjectModelSelection } from "./use-project-model-selection";

const EMPTY_PROJECTS: ModelsProjectSummary[] = [];
const EMPTY_MODEL_CATALOG: ModelCatalogItem[] = [];
const EMPTY_PROVIDER_CREDENTIALS: LLMProviderCredentialStatus[] = [];

type UseModelsPanelDataOptions = {
  apiBaseURL: string;
  organizationId: string;
  hintedProjectToken: string;
};

export function useModelsPanelData({
  apiBaseURL,
  organizationId,
  hintedProjectToken,
}: UseModelsPanelDataOptions) {
  const hasRequiredScope = apiBaseURL.trim() !== "" && organizationId !== "";
  const projectsCatalogQuery = useQuery({
    queryKey: appQueryKeys.modelsCatalog(apiBaseURL, organizationId),
    enabled: hasRequiredScope,
    queryFn: ({ signal }) =>
      loadProjectsAndCatalog(apiBaseURL, organizationId, { signal }),
  });
  const billingQuery = useQuery({
    queryKey: appQueryKeys.billingQuota(apiBaseURL, organizationId),
    enabled: hasRequiredScope,
    queryFn: ({ signal }) =>
      loadBillingEntitlements(apiBaseURL, organizationId, { signal }),
  });

  const projects = projectsCatalogQuery.data?.projects ?? EMPTY_PROJECTS;
  const catalog = projectsCatalogQuery.data?.catalog ?? EMPTY_MODEL_CATALOG;
  const selectedProjectId = useMemo(() => {
    if (!organizationId) return "";
    return findBySlugOrId(projects, hintedProjectToken)?.id || projects[0]?.id || "";
  }, [hintedProjectToken, organizationId, projects]);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const currentPlan = billingQuery.data?.plan ?? null;
  const planLabel = currentPlan ? getPlanLabel(currentPlan) : null;
  const isDeveloperPlan = isDeveloperBillingPlan(currentPlan);
  const showDeveloperUpgradeBanner =
    !isDeveloperPlan && !billingQuery.isLoading && !billingQuery.error;
  const selectionLimit = useMemo(() => {
    const limit = billingQuery.data?.modelSelectionLimit ?? 0;
    return limit > 0 ? limit : catalog.length;
  }, [billingQuery.data?.modelSelectionLimit, catalog.length]);

  const providerCredentialsQuery = useQuery({
    queryKey: appQueryKeys.llmProviderCredentials(
      apiBaseURL,
      organizationId,
      selectedProjectId,
    ),
    enabled: isDeveloperPlan && hasRequiredScope && selectedProjectId !== "",
    queryFn: ({ signal }) =>
      loadLLMProviderCredentials(
        apiBaseURL,
        organizationId,
        selectedProjectId,
        signal,
      ),
  });
  const providerCredentials =
    providerCredentialsQuery.data ?? EMPTY_PROVIDER_CREDENTIALS;
  const providerCredentialLookup = useMemo(
    () => createProviderCredentialLookup(providerCredentials),
    [providerCredentials],
  );
  const providerCredentialsReady =
    !isDeveloperPlan ||
    providerCredentialsQuery.isFetched ||
    providerCredentialsQuery.isError;

  const catalogModelIDs = useMemo(
    () => new Set(catalog.map((model) => model.id)),
    [catalog],
  );
  const catalogById = useMemo(
    () => new Map(catalog.map((model) => [model.id, model])),
    [catalog],
  );
  const usableModelIDs = useMemo(
    () =>
      new Set(
        catalog
          .filter((model) => {
            if (!model.isActive) return false;
            if (!isDeveloperPlan || !providerCredentialsReady) return true;
            return isProviderUsableWithCredentials(
              model.provider,
              providerCredentials,
              providerCredentialLookup,
            );
          })
          .map((model) => model.id),
      ),
    [
      catalog,
      isDeveloperPlan,
      providerCredentialLookup,
      providerCredentials,
      providerCredentialsReady,
    ],
  );

  const projectModelsQuery = useQuery({
    queryKey: appQueryKeys.projectModels(
      apiBaseURL,
      organizationId,
      selectedProjectId,
    ),
    enabled: hasRequiredScope && selectedProjectId !== "",
    queryFn: ({ signal }) =>
      loadProjectModels(apiBaseURL, organizationId, selectedProjectId, signal),
  });
  const { selectedModelIds, setSelectedModelIds } = useProjectModelSelection({
    projectId: selectedProjectId,
    serverModelIds: projectModelsQuery.data,
    catalogModelIDs,
    usableModelIDs,
    enforceUsableFilter: !isDeveloperPlan || providerCredentialsReady,
  });
  const selectedModelIdSet = useMemo(
    () => new Set(selectedModelIds),
    [selectedModelIds],
  );
  const loading =
    projectsCatalogQuery.isLoading ||
    (projectsCatalogQuery.isFetching && !projectsCatalogQuery.data) ||
    (selectedProjectId !== "" &&
      (projectModelsQuery.isLoading ||
        (projectModelsQuery.isFetching && !projectModelsQuery.data)));
  const queryError = useMemo(() => {
    if (!organizationId) return null;
    if (projectsCatalogQuery.error instanceof Error && !projectsCatalogQuery.data) {
      return projectsCatalogQuery.error.message;
    }
    if (
      selectedProjectId &&
      projectModelsQuery.error instanceof Error &&
      !projectModelsQuery.data
    ) {
      return projectModelsQuery.error.message;
    }
    return null;
  }, [
    organizationId,
    projectModelsQuery.data,
    projectModelsQuery.error,
    projectsCatalogQuery.data,
    projectsCatalogQuery.error,
      selectedProjectId,
  ]);

  const loadingCatalog =
    projectsCatalogQuery.isLoading ||
    (projectsCatalogQuery.isFetching && !projectsCatalogQuery.data);
  const loadingPlan =
    billingQuery.isLoading || (billingQuery.isFetching && !billingQuery.data);
  const loadingProviderCredentials =
    isDeveloperPlan &&
    selectedProjectId !== "" &&
    (providerCredentialsQuery.isLoading ||
      (providerCredentialsQuery.isFetching && !providerCredentialsQuery.data));
  const loadingProjectModels =
    selectedProjectId !== "" &&
    (projectModelsQuery.isLoading ||
      (projectModelsQuery.isFetching && !projectModelsQuery.data));

  return {
    catalog,
    catalogById,
    selectedProjectId,
    selectedProject,
    planLabel,
    isDeveloperPlan,
    showDeveloperUpgradeBanner,
    selectionLimit,
    providerCredentialsQuery,
    providerCredentials,
    providerCredentialLookup,
    providerCredentialsReady,
    loadingCatalog,
    loadingPlan,
    loadingProviderCredentials,
    loadingProjectModels,
    selectedModelIds,
    selectedModelIdSet,
    setSelectedModelIds,
    loading,
    queryError,
  };
}
