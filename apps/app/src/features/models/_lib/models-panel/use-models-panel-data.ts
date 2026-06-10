import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { appQueryKeys } from "@/lib/query-keys";
import { loadBillingEntitlements } from "@/shared/billing";
import { isDeveloperBillingPlan } from "@/shared/billing-plan";
import { resolveProjectTokenToContext } from "@/shared/project-token-resolution";

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
const PROJECT_TOKEN_CONTEXT_CACHE_VERSION = "v2";

type UseModelsPanelDataOptions = {
  apiBaseURL: string;
  organizationId: string;
  hintedProjectToken: string;
};

type ResolvedSelectedProject = {
  selectedProjectId: string;
  hasMissingHintedProject: boolean;
};

export function resolveSelectedProjectForModels(
  projects: Array<Pick<ModelsProjectSummary, "id" | "slug">>,
  hintedProjectToken: string,
): ResolvedSelectedProject {
  const normalizedHint = hintedProjectToken.trim();
  if (normalizedHint === "") {
    return {
      selectedProjectId: projects[0]?.id ?? "",
      hasMissingHintedProject: false,
    };
  }

  const matchedProject = projects.find((project) => project.id === normalizedHint);
  if (!matchedProject) {
    return {
      selectedProjectId: "",
      hasMissingHintedProject: true,
    };
  }

  return {
    selectedProjectId: matchedProject.id,
    hasMissingHintedProject: false,
  };
}

export function useModelsPanelData({
  apiBaseURL,
  organizationId,
  hintedProjectToken,
}: UseModelsPanelDataOptions) {
  const normalizedHintedProjectToken = hintedProjectToken.trim();
  const resolvedProjectContextQuery = useQuery({
    queryKey: [
      "project-token-context",
      PROJECT_TOKEN_CONTEXT_CACHE_VERSION,
      apiBaseURL,
      organizationId,
      normalizedHintedProjectToken,
    ],
    enabled: apiBaseURL.trim() !== "" && normalizedHintedProjectToken !== "",
    queryFn: ({ signal }) =>
      resolveProjectTokenToContext(apiBaseURL, {
        projectToken: normalizedHintedProjectToken,
        organizationId,
        signal,
      }),
  });
  const effectiveOrganizationId =
    resolvedProjectContextQuery.data?.organizationId ||
    organizationId;
  const hasRequiredScope =
    apiBaseURL.trim() !== "" && effectiveOrganizationId !== "";
  const projectsCatalogQuery = useQuery({
    queryKey: appQueryKeys.modelsProjectCatalog(
      apiBaseURL,
      effectiveOrganizationId,
    ),
    enabled: hasRequiredScope,
    refetchOnMount: "always",
    queryFn: ({ signal }) =>
      loadProjectsAndCatalog(apiBaseURL, effectiveOrganizationId, { signal }),
  });
  const billingQuery = useQuery({
    queryKey: appQueryKeys.billingQuota(apiBaseURL, effectiveOrganizationId),
    enabled: hasRequiredScope,
    queryFn: ({ signal }) =>
      loadBillingEntitlements(apiBaseURL, effectiveOrganizationId, { signal }),
  });

  const projects = projectsCatalogQuery.data?.projects ?? EMPTY_PROJECTS;
  const catalog = projectsCatalogQuery.data?.catalog ?? EMPTY_MODEL_CATALOG;
  const selectedProjectResolution = useMemo(() => {
    if (!effectiveOrganizationId) {
      return {
        selectedProjectId: "",
        hasMissingHintedProject: false,
      };
    }
    return resolveSelectedProjectForModels(projects, hintedProjectToken);
  }, [effectiveOrganizationId, hintedProjectToken, projects]);
  const { selectedProjectId, hasMissingHintedProject } = selectedProjectResolution;
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const currentPlan = billingQuery.data?.plan ?? null;
  const planLabel = currentPlan ? getPlanLabel(currentPlan) : null;
  const billingSelectionLimit = billingQuery.data?.modelSelectionLimit ?? 0;
  const selectionLimit =
    billingQuery.data
      ? billingSelectionLimit > 0
        ? billingSelectionLimit
        : catalog.length
      : 0;
  const isDeveloperPlan = isDeveloperBillingPlan(currentPlan);
  const showDeveloperUpgradeBanner =
    !isDeveloperPlan && !billingQuery.isLoading && !billingQuery.error;
  const providerCredentialsQuery = useQuery({
    queryKey: appQueryKeys.llmProviderCredentials(
      apiBaseURL,
      effectiveOrganizationId,
      selectedProjectId,
    ),
    enabled: isDeveloperPlan && hasRequiredScope && selectedProjectId !== "",
    queryFn: ({ signal }) =>
      loadLLMProviderCredentials(
        apiBaseURL,
        effectiveOrganizationId,
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
      effectiveOrganizationId,
      selectedProjectId,
    ),
    enabled: hasRequiredScope && selectedProjectId !== "",
    queryFn: ({ signal }) =>
      loadProjectModels(apiBaseURL, effectiveOrganizationId, selectedProjectId, signal),
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
    (normalizedHintedProjectToken !== "" &&
      resolvedProjectContextQuery.isLoading &&
      !resolvedProjectContextQuery.data) ||
    projectsCatalogQuery.isLoading ||
    (projectsCatalogQuery.isFetching && !projectsCatalogQuery.data) ||
    (selectedProjectId !== "" &&
      (projectModelsQuery.isLoading ||
        (projectModelsQuery.isFetching && !projectModelsQuery.data)));
  const queryError = useMemo(() => {
    if (!effectiveOrganizationId) {
      if (
        normalizedHintedProjectToken !== "" &&
        resolvedProjectContextQuery.isFetched &&
        !resolvedProjectContextQuery.data
      ) {
        return "Le projet demande est introuvable.";
      }
      if (normalizedHintedProjectToken === "" && !organizationId) {
        return null;
      }
      return null;
    }
    if (
      hasMissingHintedProject &&
      !projectsCatalogQuery.isLoading &&
      !projectsCatalogQuery.isFetching
    ) {
      return "Le projet demande est introuvable dans cette organisation.";
    }
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
    effectiveOrganizationId,
    hasMissingHintedProject,
    organizationId,
    normalizedHintedProjectToken,
    projectsCatalogQuery.isFetching,
    projectsCatalogQuery.isLoading,
    projectModelsQuery.data,
    projectModelsQuery.error,
    projectsCatalogQuery.data,
    projectsCatalogQuery.error,
    resolvedProjectContextQuery.data,
    resolvedProjectContextQuery.isFetched,
    selectedProjectId,
  ]);

  const loadingCatalog =
    ((normalizedHintedProjectToken !== "" &&
      resolvedProjectContextQuery.isLoading &&
      !resolvedProjectContextQuery.data)) ||
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
    effectiveOrganizationId,
    selectedProjectId,
    selectedProject,
    hasMissingHintedProject,
    planLabel,
    selectionLimit,
    isDeveloperPlan,
    showDeveloperUpgradeBanner,
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
