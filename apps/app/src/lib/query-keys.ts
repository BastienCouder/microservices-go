const DEFAULT_PROJECT_ID = "__default__";
const DEFAULT_ORGANIZATION_ID = "__default_org__";

const projectIdOrDefault = (projectId: string | null) =>
  projectId ?? DEFAULT_PROJECT_ID;

const organizationIdOrDefault = (organizationId: string | null) =>
  organizationId ?? DEFAULT_ORGANIZATION_ID;

export const appQueryKeys = {
  session: (apiBaseURL: string) =>
    ["session", apiBaseURL] as const,

  monitoring: (
    apiBaseURL: string,
    projectId: string | null,
    mode: string,
    historyScope = "active_only",
  ) =>
    [
      "monitoring",
      apiBaseURL,
      projectIdOrDefault(projectId),
      mode,
      historyScope,
    ] as const,

  promptQuota: (
    apiBaseURL: string,
    organizationId: string,
    projectId: string | null,
  ) =>
    [
      "prompt-quota",
      apiBaseURL,
      organizationId,
      projectIdOrDefault(projectId),
    ] as const,

  perception: (
    apiBaseURL: string,
    projectId: string | null,
    mode: string,
  ) =>
    [
      "perception",
      apiBaseURL,
      projectIdOrDefault(projectId),
      mode,
    ] as const,

  optimizationErrors: (
    apiBaseURL: string,
    projectId: string | null,
  ) =>
    [
      "optimization-errors",
      apiBaseURL,
      projectIdOrDefault(projectId),
    ] as const,

  traffic: (
    apiBaseURL: string,
    projectId: string | null,
    organizationId: string | null,
    period: string,
    search = "",
    engine = "all",
  ) =>
    [
      "traffic",
      apiBaseURL,
      organizationIdOrDefault(organizationId),
      projectIdOrDefault(projectId),
      period,
      search,
      engine,
    ] as const,

  optimizeActions: (
    apiBaseURL: string,
    projectId: string | null,
  ) =>
    [
      "optimize-actions",
      apiBaseURL,
      projectIdOrDefault(projectId),
    ] as const,

  modelsCatalog: (
    apiBaseURL: string,
    organizationId: string,
    scope: "active" | "all" = "active",
  ) =>
    [
      "models",
      "catalog",
      apiBaseURL,
      organizationId,
      scope,
    ] as const,

  modelsProjectCatalog: (
    apiBaseURL: string,
    organizationId: string,
    scope: "active" | "all" = "active",
  ) =>
    [
      "models",
      "project-catalog",
      apiBaseURL,
      organizationId,
      scope,
    ] as const,

  projectModels: (
    apiBaseURL: string,
    organizationId: string,
    projectId: string,
  ) =>
    [
      "models",
      "project",
      apiBaseURL,
      organizationId,
      projectId,
    ] as const,

  llmProviderCredentials: (
    apiBaseURL: string,
    organizationId: string,
    projectId: string,
  ) =>
    [
      "models",
      "llm-provider-credentials",
      apiBaseURL,
      organizationId,
      projectId,
    ] as const,

  billingQuota: (
    apiBaseURL: string,
    organizationId: string,
  ) =>
    [
      "billing",
      "quota",
      apiBaseURL,
      organizationId,
    ] as const,

  billingPlans: (
    apiBaseURL: string,
    organizationId: string,
  ) =>
    [
      "billing",
      "plans",
      apiBaseURL,
      organizationId,
    ] as const,

  billingPricingTiers: (
    apiBaseURL: string,
    organizationId: string,
  ) =>
    [
      "billing",
      "pricing-tiers",
      apiBaseURL,
      organizationId,
    ] as const,

  billingCreditCostSettings: (
    apiBaseURL: string,
    organizationId: string,
  ) =>
    [
      "billing",
      "credit-cost-settings",
      apiBaseURL,
      organizationId,
    ] as const,

  promptsPage: (
    apiBaseURL: string,
    organizationId: string,
    projectId: string,
    page: number,
    pageSize: number,
    search: string,
  ) =>
    [
      "prompts",
      apiBaseURL,
      organizationId,
      projectId,
      page,
      pageSize,
      search,
    ] as const,

  promptsCatalog: (
    apiBaseURL: string,
    organizationId: string,
    projectId: string,
    search: string,
    sort: string,
    direction: string,
  ) =>
    [
      "prompts",
      "catalog",
      apiBaseURL,
      organizationId,
      projectId,
      search,
      sort,
      direction,
    ] as const,

  organizations: (apiBaseURL: string, _userId?: string | number | null) =>
    [
      "organizations",
      apiBaseURL,
    ] as const,

  organizationHierarchy: (
    apiBaseURL: string,
    organizationId: string,
  ) =>
    [
      "organizations",
      "hierarchy",
      apiBaseURL,
      organizationId,
    ] as const,

  projectContextHierarchies: (
    apiBaseURL: string,
    organizationIdsKey: string,
  ) =>
    [
      "organizations",
      "project-context-hierarchies",
      apiBaseURL,
      organizationIdsKey,
    ] as const,

  organizationResources: (
    apiBaseURL: string,
    organizationId: string,
  ) =>
    [
      "organizations",
      "resources",
      apiBaseURL,
      organizationId,
    ] as const,

  organizationAPIKeys: (
    apiBaseURL: string,
    organizationId: string,
  ) =>
    [
      "organizations",
      "api-keys",
      apiBaseURL,
      organizationId,
    ] as const,

  projectDetails: (
    apiBaseURL: string,
    organizationId: string,
    projectId: string,
  ) =>
    [
      "projects",
      "details",
      apiBaseURL,
      organizationId,
      projectId,
    ] as const,
};
