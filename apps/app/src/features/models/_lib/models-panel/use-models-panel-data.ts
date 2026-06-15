import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { appQueryKeys } from "@/lib/query-keys";
import { loadBillingEntitlements } from "@/shared/billing";
import { isDeveloperBillingPlan } from "@/shared/billing-plan";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { resolveProjectTokenToContext } from "@/shared/project-token-resolution";
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
const PROJECT_TOKEN_CONTEXT_CACHE_VERSION = "v2";

type UseModelsPanelDataOptions = {
  apiBaseURL: string;
  organizationId: string;
  hintedProjectToken: string;
  deferScopedLoadsUntilProjectContextResolves?: boolean;
};

type ResolvedSelectedProject = {
  selectedProjectId: string;
  hasMissingHintedProject: boolean;
};

function isNumericOrganizationID(value: string): boolean {
  return /^[0-9]+$/.test(value.trim());
}

export function resolveBillingOrganizationIdForModels(
  projects: Array<Pick<ModelsProjectSummary, "id" | "organizationId">>,
  selectedProjectId: string,
  effectiveOrganizationId: string,
): string {
  const selectedProjectOrganizationId =
    projects.find((project) => project.id === selectedProjectId)?.organizationId ?? "";
  if (isNumericOrganizationID(selectedProjectOrganizationId)) {
    return selectedProjectOrganizationId.trim();
  }

  const firstProjectOrganizationId = projects[0]?.organizationId ?? "";
  if (isNumericOrganizationID(firstProjectOrganizationId)) {
    return firstProjectOrganizationId.trim();
  }

  return isNumericOrganizationID(effectiveOrganizationId)
    ? effectiveOrganizationId.trim()
    : "";
}

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

  const matchedProject = findBySlugOrId(projects, normalizedHint);
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
  deferScopedLoadsUntilProjectContextResolves = false,
}: UseModelsPanelDataOptions) {
  const { t } = useScopedI18n("models");
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
  const resolvedHintedProjectToken =
    resolvedProjectContextQuery.data?.projectId || hintedProjectToken;
  const shouldWaitForResolvedProjectContext =
    deferScopedLoadsUntilProjectContextResolves &&
    normalizedHintedProjectToken !== "" &&
    resolvedProjectContextQuery.fetchStatus !== "idle" &&
    !resolvedProjectContextQuery.isFetched &&
    !resolvedProjectContextQuery.isError;
  const effectiveOrganizationId =
    resolvedProjectContextQuery.data?.organizationId ||
    organizationId;
  const hasRequiredScope =
    apiBaseURL.trim() !== "" &&
    effectiveOrganizationId !== "" &&
    !shouldWaitForResolvedProjectContext;
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
  const projects = projectsCatalogQuery.data?.projects ?? EMPTY_PROJECTS;
  const catalog = projectsCatalogQuery.data?.catalog ?? EMPTY_MODEL_CATALOG;
  const selectedProjectResolution = useMemo(() => {
    if (!effectiveOrganizationId) {
      return {
        selectedProjectId: "",
        hasMissingHintedProject: false,
      };
    }
    return resolveSelectedProjectForModels(projects, resolvedHintedProjectToken);
  }, [effectiveOrganizationId, projects, resolvedHintedProjectToken]);
  const { selectedProjectId, hasMissingHintedProject } = selectedProjectResolution;
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const billingOrganizationId = useMemo(
    () =>
      resolveBillingOrganizationIdForModels(
        projects,
        selectedProjectId,
        effectiveOrganizationId,
      ),
    [effectiveOrganizationId, projects, selectedProjectId],
  );
  const billingQuery = useQuery({
    queryKey: appQueryKeys.billingQuota(apiBaseURL, billingOrganizationId),
    enabled: apiBaseURL.trim() !== "" && billingOrganizationId !== "",
    queryFn: ({ signal }) =>
      loadBillingEntitlements(apiBaseURL, billingOrganizationId, { signal }),
  });
  const currentPlan = billingQuery.data?.plan ?? null;
  const planLabel = currentPlan ? getPlanLabel(currentPlan) : null;
  const billingSelectionLimit = billingQuery.data?.modelSelectionLimit ?? 0;
  const resolvedSelectionLimit = billingQuery.data
    ? billingSelectionLimit > 0
      ? billingSelectionLimit
      : catalog.length
    : null;
  const selectionLimit =
    resolvedSelectionLimit ??
    catalog.length;
  const selectionLimitReady =
    resolvedSelectionLimit !== null;
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
      shouldWaitForResolvedProjectContext &&
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
        return t("requestedProjectNotFound");
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
      return t("requestedProjectNotFoundInOrganization");
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
    t,
  ]);

  const loadingCatalog =
    ((normalizedHintedProjectToken !== "" &&
      shouldWaitForResolvedProjectContext &&
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
    selectionLimitReady,
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
