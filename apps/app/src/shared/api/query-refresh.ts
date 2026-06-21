import type { QueryClient } from "@tanstack/react-query";

import { appQueryKeys } from "@/lib/query-keys";

type QueryKeyInput = readonly unknown[];

export async function invalidateQueryKeys(
  queryClient: QueryClient,
  keys: readonly QueryKeyInput[],
): Promise<void> {
  await Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

export function organizationScopeQueryKeys(
  apiBaseURL: string,
  organizationId: string,
): QueryKeyInput[] {
  return [
    appQueryKeys.organizationResources(apiBaseURL, organizationId),
    appQueryKeys.organizationHierarchy(apiBaseURL, organizationId),
    ["organizations", apiBaseURL],
    ["organizations", "project-context-hierarchies", apiBaseURL],
  ];
}

export function projectScopeQueryKeys(
  apiBaseURL: string,
  organizationId: string,
  projectId: string,
): QueryKeyInput[] {
  return [
    appQueryKeys.projectDetails(apiBaseURL, organizationId, projectId),
    appQueryKeys.projectModels(apiBaseURL, organizationId, projectId),
    appQueryKeys.llmProviderCredentials(apiBaseURL, organizationId, projectId),
    appQueryKeys.promptQuota(apiBaseURL, organizationId, projectId),
    ["monitoring", apiBaseURL, organizationId, projectId],
    ["perception", apiBaseURL, organizationId, projectId],
    appQueryKeys.optimizationErrors(apiBaseURL, projectId, organizationId),
    ["traffic", apiBaseURL, organizationId, projectId],
    ["optimize-actions", apiBaseURL, projectId],
    ["prompts", apiBaseURL, organizationId, projectId],
    ["prompts", "catalog", apiBaseURL, organizationId, projectId],
  ];
}

export async function invalidateOrganizationScope(
  queryClient: QueryClient,
  apiBaseURL: string,
  organizationId: string,
): Promise<void> {
  await invalidateQueryKeys(
    queryClient,
    organizationScopeQueryKeys(apiBaseURL, organizationId),
  );
}

export async function invalidateProjectScope(
  queryClient: QueryClient,
  apiBaseURL: string,
  organizationId: string,
  projectId: string,
): Promise<void> {
  await invalidateQueryKeys(
    queryClient,
    projectScopeQueryKeys(apiBaseURL, organizationId, projectId),
  );
}
