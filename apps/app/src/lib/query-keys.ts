export const appQueryKeys = {
  session: (apiBaseURL: string) => ["session", apiBaseURL] as const,
  dashboard: (
    apiBaseURL: string,
    projectId: string | null,
    mode: string,
    historyScope = "active_only",
  ) => ["dashboard", apiBaseURL, projectId ?? "__default__", mode, historyScope] as const,
  perception: (apiBaseURL: string, projectId: string | null, mode: string) =>
    ["perception", apiBaseURL, projectId ?? "__default__", mode] as const,
  modelsCatalog: (apiBaseURL: string, organizationId: string) =>
    ["models", "catalog", apiBaseURL, organizationId] as const,
  projectModels: (apiBaseURL: string, organizationId: string, projectId: string) =>
    ["models", "project", apiBaseURL, organizationId, projectId] as const,
  promptsPage: (
    apiBaseURL: string,
    organizationId: string,
    projectId: string,
    page: number,
    pageSize: number,
    search: string,
  ) => ["prompts", apiBaseURL, organizationId, projectId, page, pageSize, search] as const,
  promptsCatalog: (
    apiBaseURL: string,
    organizationId: string,
    projectId: string,
    search: string,
    sort: string,
    direction: string,
  ) => ["prompts", "catalog", apiBaseURL, organizationId, projectId, search, sort, direction] as const,
  organizations: (apiBaseURL: string, userId: number | null) =>
    ["organizations", apiBaseURL, userId] as const,
  organizationResources: (apiBaseURL: string, organizationId: string) =>
    ["organizations", "resources", apiBaseURL, organizationId] as const,
};
